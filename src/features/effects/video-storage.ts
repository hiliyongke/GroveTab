/**
 * video-storage —— 视频背景本地文件存储
 *
 * 为什么不走 chrome.storage.local？
 *   - chrome.storage.local 单条上限 10MB，且不适合二进制 Blob。
 *   - 视频文件可能 10~50MB，最合适的方案是 IndexedDB。
 *
 * 数据结构：
 *   DB:    由应用命名空间统一生成
 *   Store: files
 *   Row:   { key: string, blob: Blob, name: string, savedAt: number }
 *
 * API:
 *   - saveVideoFile(file) → { key }
 *   - loadVideoBlobUrl(key) → blob URL（内存生命周期由调用方管理，记得 revokeObjectURL）
 *   - removeVideoFile(key)
 */

import { APP_RESOURCE_NAMES } from '@/shared/config/storage-keys';

const DB_NAME = APP_RESOURCE_NAMES.videoDb;
const STORE = 'files';
const DB_VERSION = 1;

interface StoredFile {
  key: string;
  blob: Blob;
  name: string;
  savedAt: number;
}

/**
 * 打开 IndexedDB 数据库
 *
 * @returns {Promise<IDBDatabase>} 返回打开的 IndexedDB 数据库实例
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

/**
 * 在 IndexedDB 事务中执行读写操作
 * @param mode - 事务模式（只读/读写）
 * @param fn - 操作回调
 * @returns {Promise<T>} 返回事务操作的结果
 */
async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB op failed'));
    tx.oncomplete = () => db.close();
  });
}

/**
 * 保存文件，返回持久化 key。
 * @param file - 待保存的视频文件
 * @returns {Promise<string>} 返回持久化存储的 key
 */
export async function saveVideoFile(file: File): Promise<string> {
  const key = `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const row: StoredFile = {
    key,
    blob: file,
    name: file.name,
    savedAt: Date.now(),
  };
  await withStore('readwrite', (store) => store.put(row));
  return key;
}

/**
 * 读出文件的 Blob URL（内存态）。调用方不再使用时必须 URL.revokeObjectURL。
 * @param key - 文件持久化 key
 * @returns {Promise<string | null>} 返回 Blob 的 URL 对象，未找到时返回 null
 */
export async function loadVideoBlobUrl(key: string): Promise<string | null> {
  const row = await withStore<StoredFile | undefined>(
    'readonly',
    (store) => store.get(key) as IDBRequest<StoredFile | undefined>,
  );
  if (row === undefined) return null;
  return URL.createObjectURL(row.blob);
}

/**
 * 删除文件。
 * @param key - 待删除文件的 key
 * @returns {Promise<void>}
 */
export async function removeVideoFile(key: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(key));
}
