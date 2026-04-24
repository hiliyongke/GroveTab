/**
 * IndexedDB 自动降级存储
 *
 * 当 chrome.storage.local 使用量超过阈值（默认 80%）时，
 * 自动将归档数据（canopy_sessions）迁移到 IndexedDB，
 * 释放 chrome.storage.local 空间给设置等关键数据。
 *
 * 迁移策略：
 *   1. 检测 chrome.storage.local 使用百分比
 *   2. 超过阈值时，读取 canopy_sessions 数据
 *   3. 将数据写入 IndexedDB（canopy-db → sessions store）
 *   4. 从 chrome.storage.local 中删除 canopy_sessions key
 *   5. 后续归档读写自动路由到 IndexedDB
 */

import type { ArchivedSession } from '@/shared/types';
import { CONFIG } from '@/shared/config';

const DB_NAME = 'canopy-db';
const DB_VERSION = CONFIG.cache.dbVersion;
const SESSIONS_STORE = 'sessions';
const QUOTA_THRESHOLD = CONFIG.cache.idbQuotaThreshold; // 可配置阈值

/** IndexedDB 实例缓存 */
let dbInstance: IDBDatabase | null = null;

/** 统一把 IndexedDB 的错误值包装成 Error。 */
function toIDBError(error: unknown, label: string): Error {
  if (error instanceof Error) return error;
  return new Error(`[IDB Fallback] ${label} failed`);
}

/** 归档会话数组的最小类型守卫。 */
function isArchivedSessionArray(value: unknown): value is ArchivedSession[] {
  return Array.isArray(value);
}

/**
 * 打开（或复用）IndexedDB 连接
 */
function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => reject(toIDBError(request.error, 'openDB'));
  });
}

/**
 * 检查是否应该降级到 IndexedDB
 */
export async function shouldFallbackToIDB(): Promise<boolean> {
  try {
    const usedBytes = await chrome.storage.local.getBytesInUse(null);
    const totalBytes = 10 * 1024 * 1024; // chrome.storage.local 上限 10MB
    return (usedBytes / totalBytes) >= QUOTA_THRESHOLD;
  } catch {
    return false;
  }
}

/**
 * 将归档会话从 chrome.storage.local 迁移到 IndexedDB
 *
 * @returns 迁移的会话数量
 */
export async function migrateSessionsToIDB(): Promise<number> {
  // 1. 读取 chrome.storage.local 中的 sessions
  const result = await chrome.storage.local.get('canopy_sessions');
  const rawSessions: unknown = result.canopy_sessions;
  const sessions = isArchivedSessionArray(rawSessions) ? rawSessions : [];

  if (sessions.length === 0) return 0;

  // 2. 写入 IndexedDB
  const db = await openDB();
  const tx = db.transaction(SESSIONS_STORE, 'readwrite');
  const store = tx.objectStore(SESSIONS_STORE);

  for (const session of sessions) {
    store.put(session);
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(toIDBError(tx.error, 'migrateSessionsToIDB'));
  });

  // 3. 从 chrome.storage.local 删除
  await chrome.storage.local.remove('canopy_sessions');

  console.log(`[IDB Fallback] Migrated ${sessions.length} sessions to IndexedDB`);
  return sessions.length;
}

/**
 * 从 IndexedDB 读取所有归档会话
 */
export async function getSessionsFromIDB(): Promise<ArchivedSession[]> {
  const db = await openDB();
  const tx = db.transaction(SESSIONS_STORE, 'readonly');
  const store = tx.objectStore(SESSIONS_STORE);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as ArchivedSession[]);
    request.onerror = () => reject(toIDBError(request.error, 'getSessionsFromIDB'));
  });
}

/**
 * 将归档会话保存到 IndexedDB
 */
export async function saveSessionsToIDB(sessions: ArchivedSession[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(SESSIONS_STORE, 'readwrite');
  const store = tx.objectStore(SESSIONS_STORE);

  // 清空旧数据
  store.clear();
  for (const session of sessions) {
    store.put(session);
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(toIDBError(tx.error, 'saveSessionsToIDB'));
  });
}

/**
 * 检查 IndexedDB 中是否有已迁移的数据
 */
export async function hasIDBData(): Promise<boolean> {
  try {
    const db = await openDB();
    const tx = db.transaction(SESSIONS_STORE, 'readonly');
    const store = tx.objectStore(SESSIONS_STORE);

    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result > 0);
      request.onerror = () => reject(toIDBError(request.error, 'hasIDBData'));
    });
  } catch {
    return false;
  }
}

/**
 * 自动降级：检查并执行迁移
 *
 * 在应用初始化时调用。如果检测到 chrome.storage.local 使用率超过阈值，
 * 且 IndexedDB 中尚无数据，则执行迁移。
 */
export async function autoFallbackIfNeeded(): Promise<void> {
  try {
    const hasIDB = await hasIDBData();
    // 如果 IDB 中已有数据，说明已迁移过，跳过
    if (hasIDB) return;

    const shouldFallback = await shouldFallbackToIDB();
    if (!shouldFallback) return;

    await migrateSessionsToIDB();
  } catch (err) {
    console.error('[IDB Fallback] Auto-migration failed:', err);
  }
}
