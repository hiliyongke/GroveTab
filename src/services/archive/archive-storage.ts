/**
 * 归档服务 - 存储路由
 *
 * 统一负责归档数据的持久化与读取，集成 IndexedDB 自动降级：
 * 当 chrome.storage.local 使用率超过阈值时，归档数据自动迁移到 IndexedDB，
 * 后续读写透明路由到 IDB，不影响上层调用方。
 */

import type { ArchivedSession } from '@/shared/types';
import { getData, setData } from '@/repositories';
import {
  shouldFallbackToIDB,
  hasIDBData,
  getSessionsFromIDB,
  saveSessionsToIDB,
  autoFallbackIfNeeded,
} from '@/shared/utils/idb-fallback';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';

const SESSIONS_KEY = STORAGE_KEYS.sessions;

/** 是否已降级到 IndexedDB（运行时缓存，避免每次都检测） */
let useIDB = false;

/**
 * 初始化归档存储路由。
 *
 * 在应用启动时调用，检测是否需要降级并建立路由。
 */
export async function initArchiveStorage(): Promise<void> {
  const hasIDB = await hasIDBData();
  if (hasIDB) {
    useIDB = true;
    return;
  }
  await autoFallbackIfNeeded();
  useIDB = await hasIDBData();
}

/** 获取全部归档会话（自动路由到 IDB 或 chrome.storage.local）。 */
export async function getArchivedSessions(): Promise<ArchivedSession[]> {
  if (useIDB) {
    return getSessionsFromIDB();
  }
  const sessions = (await getData<ArchivedSession[]>(SESSIONS_KEY)) ?? [];
  if (!useIDB) {
    const shouldFB = await shouldFallbackToIDB();
    if (shouldFB) {
      await autoFallbackIfNeeded();
      useIDB = await hasIDBData();
      if (useIDB && sessions.length > 0) {
        return getSessionsFromIDB();
      }
    }
  }
  return sessions;
}

/** 保存归档会话（自动路由）。 */
export async function saveSessions(sessions: ArchivedSession[]): Promise<void> {
  if (useIDB) {
    return saveSessionsToIDB(sessions);
  }
  await setData(SESSIONS_KEY, sessions);
}

/** 将会话插入到列表头部并持久化。 */
export async function prependSession(session: ArchivedSession): Promise<void> {
  const sessions = await getArchivedSessions();
  sessions.unshift(session);
  await saveSessions(sessions);
}
