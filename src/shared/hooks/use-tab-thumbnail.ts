/**
 * useTabThumbnail - 标签缩略图管理
 *
 * 功能：
 * 1. 使用 chrome.tabs.captureVisibleTab 捕获标签页缩略图
 * 2. 使用 IndexedDB 缓存缩略图（LRU 策略，最多 50 张，TTL 5 分钟）
 * 3. 限并发 3，避免性能问题
 * 4. 后台标签显示占位图
 */

import { useState, useEffect, useCallback, useRef } from "react";

const THUMBNAIL_DB_NAME = "groveTabThumbnails";
const THUMBNAIL_STORE_NAME = "thumbnails";
const MAX_CACHE_SIZE = 50;
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟
const MAX_CONCURRENT_CAPTURES = 3;

interface ThumbnailEntry {
  tabId: number;
  url: string;
  dataUrl: string;
  timestamp: number;
  accessCount: number;
}

// 并发控制信号量
class Semaphore {
  private permits: number;
  private queue: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    return new Promise((resolve) => this.queue.push(resolve));
  }

  release(): void {
    this.permits++;
    const next = this.queue.shift();
    if (next) {
      this.permits--;
      next();
    }
  }
}

const captureSemaphore = new Semaphore(MAX_CONCURRENT_CAPTURES);

// 打开 IndexedDB
async function openThumbnailDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(THUMBNAIL_DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(THUMBNAIL_STORE_NAME)) {
        const store = db.createObjectStore(THUMBNAIL_STORE_NAME, { keyPath: "tabId" });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });
}

// 从 IndexedDB 获取缩略图
async function getThumbnailFromDB(tabId: number): Promise<ThumbnailEntry | null> {
  try {
    const db = await openThumbnailDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(THUMBNAIL_STORE_NAME, "readonly");
      const store = transaction.objectStore(THUMBNAIL_STORE_NAME);
      const request = store.get(tabId);
      request.onsuccess = () => {
        const entry = request.result as ThumbnailEntry | undefined;
        // 检查是否过期
        if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
          resolve(entry);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

// 保存缩略图到 IndexedDB
async function saveThumbnailToDB(entry: ThumbnailEntry): Promise<void> {
  try {
    const db = await openThumbnailDB();
    
    // 先检查缓存数量，如果超过限制则删除最旧的
    const count = await new Promise<number>((resolve, reject) => {
      const transaction = db.transaction(THUMBNAIL_STORE_NAME, "readonly");
      const store = transaction.objectStore(THUMBNAIL_STORE_NAME);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (count >= MAX_CACHE_SIZE) {
      // 删除最旧的条目
      const oldEntries = await new Promise<ThumbnailEntry[]>((resolve, reject) => {
        const transaction = db.transaction(THUMBNAIL_STORE_NAME, "readonly");
        const store = transaction.objectStore(THUMBNAIL_STORE_NAME);
        const index = store.index("timestamp");
        const request = index.openCursor();
        const results: ThumbnailEntry[] = [];
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor && results.length < count - MAX_CACHE_SIZE + 1) {
            results.push(cursor.value);
            cursor.continue();
          } else {
            resolve(results);
          }
        };
        request.onerror = () => reject(request.error);
      });

      const deleteTransaction = db.transaction(THUMBNAIL_STORE_NAME, "readwrite");
      const deleteStore = deleteTransaction.objectStore(THUMBNAIL_STORE_NAME);
      for (const oldEntry of oldEntries) {
        deleteStore.delete(oldEntry.tabId);
      }
    }

    // 保存新条目
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(THUMBNAIL_STORE_NAME, "readwrite");
      const store = transaction.objectStore(THUMBNAIL_STORE_NAME);
      const request = store.put(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // 忽略 IndexedDB 错误
  }
}

// 捕获标签页缩略图
async function captureTabThumbnail(tabId: number): Promise<string | null> {
  await captureSemaphore.acquire();
  try {
    // 获取标签页信息
    const tab = await chrome.tabs.get(tabId);
    
    // 后台标签或休眠标签返回 null
    if (tab.discarded || !tab.active) {
      return null;
    }

    // 捕获可见区域
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "png",
      quality: 80,
    });
    
    return dataUrl;
  } catch {
    return null;
  } finally {
    captureSemaphore.release();
  }
}

export interface UseTabThumbnailOptions {
  tabId: number;
  url: string;
  enabled?: boolean;
}

export function useTabThumbnail({ tabId, url, enabled = true }: UseTabThumbnailOptions) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isMounted = useRef(true);

  const loadThumbnail = useCallback(async () => {
    if (!enabled) return;
    
    setIsLoading(true);
    
    try {
      // 1. 先尝试从缓存获取
      const cached = await getThumbnailFromDB(tabId);
      if (cached && isMounted.current) {
        setThumbnail(cached.dataUrl);
        setIsLoading(false);
        return;
      }

      // 2. 捕获新缩略图
      const dataUrl = await captureTabThumbnail(tabId);
      
      if (dataUrl && isMounted.current) {
        setThumbnail(dataUrl);
        
        // 3. 保存到缓存
        await saveThumbnailToDB({
          tabId,
          url,
          dataUrl,
          timestamp: Date.now(),
          accessCount: 1,
        });
      }
    } catch {
      // 忽略错误
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [tabId, url, enabled]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return {
    thumbnail,
    isLoading,
    loadThumbnail,
    hasThumbnail: !!thumbnail,
  };
}

// 清理过期缓存
export async function cleanupThumbnailCache(): Promise<void> {
  try {
    const db = await openThumbnailDB();
    const now = Date.now();
    
    const entriesToDelete = await new Promise<number[]>((resolve, reject) => {
      const transaction = db.transaction(THUMBNAIL_STORE_NAME, "readonly");
      const store = transaction.objectStore(THUMBNAIL_STORE_NAME);
      const request = store.openCursor();
      const toDelete: number[] = [];
      
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const entry = cursor.value as ThumbnailEntry;
          if (now - entry.timestamp > CACHE_TTL) {
            toDelete.push(entry.tabId);
          }
          cursor.continue();
        } else {
          resolve(toDelete);
        }
      };
      request.onerror = () => reject(request.error);
    });

    if (entriesToDelete.length > 0) {
      const deleteTransaction = db.transaction(THUMBNAIL_STORE_NAME, "readwrite");
      const deleteStore = deleteTransaction.objectStore(THUMBNAIL_STORE_NAME);
      for (const tabId of entriesToDelete) {
        deleteStore.delete(tabId);
      }
    }
  } catch {
    // 忽略错误
  }
}
