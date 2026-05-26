/**
 * 归档服务 - 存储路由
 *
 * 统一负责归档数据的持久化与读取，存储优先级：
 *   1. OPFS（超配额时自动迁移，大容量）
 *   2. IndexedDB（兼容旧数据）
 *   3. chrome.storage.local（默认）
 *
 * 所有写入操作通过 Web Locks API 加全局锁，防止多标签页并发数据竞争。
 */

import type { ArchivedSession } from "@/shared/types";
import { getData, setData } from "@/repositories";
import {
  shouldFallbackToIDB,
  hasIDBData,
  getSessionsFromIDB,
  saveSessionsToIDB,
  autoFallbackIfNeeded,
} from "@/shared/utils/idb-fallback";
import {
  opfsRead,
  opfsWrite,
  isChromeStorageOverQuota,
  withLock,
  LOCK_NAMES,
  isOPFSAvailable,
} from "@/shared/utils/opfs-storage";
import { STORAGE_KEYS } from "@/shared/config/storage-keys";

const SESSIONS_KEY = STORAGE_KEYS.sessions;
const OPFS_SESSIONS_PATH = "archive/sessions.json";

/** 存储路由状态 */
let useIDB = false;
let useOPFS = false;

/**
 * 初始化归档存储路由。
 * 在应用启动时调用，检测是否需要降级并建立路由。
 */
export async function initArchiveStorage(): Promise<void> {
  // 优先检查 OPFS（已迁移过）
  if (isOPFSAvailable()) {
    const opfsData = await opfsRead<ArchivedSession[]>(OPFS_SESSIONS_PATH);
    if (opfsData !== null) {
      useOPFS = true;
      return;
    }
  }

  // 检查 IDB（旧数据兼容）
  const hasIDB = await hasIDBData();
  if (hasIDB) {
    useIDB = true;
    return;
  }

  // 检查是否需要迁移到 OPFS
  if (isOPFSAvailable() && (await isChromeStorageOverQuota())) {
    await migrateToOPFS();
    return;
  }

  // 检查是否需要迁移到 IDB（旧逻辑兼容）
  await autoFallbackIfNeeded();
  useIDB = await hasIDBData();
}

/** 将归档数据从 chrome.storage.local 迁移到 OPFS */
async function migrateToOPFS(): Promise<void> {
  try {
    const sessions = (await getData<ArchivedSession[]>(SESSIONS_KEY)) ?? [];
    if (sessions.length > 0) {
      await opfsWrite(OPFS_SESSIONS_PATH, sessions);
    }
    useOPFS = true;
    console.log(`[Archive] Migrated ${sessions.length} sessions to OPFS`);
  } catch (err) {
    console.error("[Archive] OPFS migration failed, falling back to IDB", err);
    await autoFallbackIfNeeded();
    useIDB = await hasIDBData();
  }
}

/** 获取全部归档会话（自动路由到 OPFS / IDB / chrome.storage.local）。 */
export async function getArchivedSessions(): Promise<ArchivedSession[]> {
  if (useOPFS) {
    return (await opfsRead<ArchivedSession[]>(OPFS_SESSIONS_PATH)) ?? [];
  }
  if (useIDB) {
    return getSessionsFromIDB();
  }
  const sessions = (await getData<ArchivedSession[]>(SESSIONS_KEY)) ?? [];

  // 惰性检测：读取时顺带检查是否需要迁移
  if (!useIDB && !useOPFS) {
    if (isOPFSAvailable() && (await isChromeStorageOverQuota())) {
      await migrateToOPFS();
      if (useOPFS) {
        return (await opfsRead<ArchivedSession[]>(OPFS_SESSIONS_PATH)) ?? [];
      }
    } else {
      const shouldFB = await shouldFallbackToIDB();
      if (shouldFB) {
        await autoFallbackIfNeeded();
        useIDB = await hasIDBData();
        if (useIDB) {
          return getSessionsFromIDB();
        }
      }
    }
  }
  return sessions;
}

/** 保存归档会话（自动路由 + Web Locks 并发保护）。 */
export async function saveSessions(sessions: ArchivedSession[]): Promise<void> {
  await withLock(LOCK_NAMES.archive, async () => {
    if (useOPFS) {
      await opfsWrite(OPFS_SESSIONS_PATH, sessions);
      return;
    }
    if (useIDB) {
      await saveSessionsToIDB(sessions);
      return;
    }
    await setData(SESSIONS_KEY, sessions);
  });
}

/** 将会话插入到列表头部并持久化。 */
export async function prependSession(session: ArchivedSession): Promise<void> {
  await withLock(LOCK_NAMES.archive, async () => {
    // 在锁内读取最新数据，避免并发覆盖
    let sessions: ArchivedSession[];
    if (useOPFS) {
      sessions = (await opfsRead<ArchivedSession[]>(OPFS_SESSIONS_PATH)) ?? [];
    } else if (useIDB) {
      sessions = await getSessionsFromIDB();
    } else {
      sessions = (await getData<ArchivedSession[]>(SESSIONS_KEY)) ?? [];
    }
    sessions.unshift(session);

    if (useOPFS) {
      await opfsWrite(OPFS_SESSIONS_PATH, sessions);
    } else if (useIDB) {
      await saveSessionsToIDB(sessions);
    } else {
      await setData(SESSIONS_KEY, sessions);
    }
  });
}
