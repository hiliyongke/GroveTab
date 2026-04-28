/**
 * 归档服务。
 *
 * 统一负责会话快照的创建、持久化与恢复，避免 UI、Popup、Service Worker
 * 分别维护各自的归档实现，导致数据写入不一致。
 *
 * 同时集成 IndexedDB 自动降级：
 * 当 `chrome.storage.local` 使用率超过阈值时，归档数据自动迁移到 IndexedDB，
 * 后续读写透明路由到 IDB，不影响上层调用方。
 */

import { nanoid } from 'nanoid';
import type { ArchivedSession, ArchivedTab } from '@/shared/types';
import { CONFIG } from '@/shared/config';
import { getData, setData } from '@/repositories';
import { queryAllTabs, queryTabs, closeTabs, createTab, getCurrentWindow, getFaviconUrl } from '@/chrome';
import { extractHostname, isSelfNewTabPage, shouldDisplayUrl } from '@/chrome';
import { filterSafeExternalUrls } from '@/shared/utils/url-safety';
import {
  shouldFallbackToIDB,
  hasIDBData,
  getSessionsFromIDB,
  saveSessionsToIDB,
  autoFallbackIfNeeded,
} from '@/shared/utils/idb-fallback';

const SESSIONS_KEY = 'canopy_sessions';

/** 归档结果：快照一定已落盘，关闭标签页可能部分失败。 */
export interface ArchiveOperationResult {
  session: ArchivedSession;
  archivedCount: number;
  closedCount: number;
}

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

/** 获取全部归档会话（自动路由到 IDB 或 `chrome.storage.local`）。 */
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
async function saveSessions(sessions: ArchivedSession[]): Promise<void> {
  if (useIDB) {
    return saveSessionsToIDB(sessions);
  }
  await setData(SESSIONS_KEY, sessions);
}

export { saveSessions };

/** 判断标签页是否允许归档。 */
function isArchivableTab(tab: chrome.tabs.Tab): boolean {
  if (isSelfNewTabPage(tab)) return false;
  if (tab.pinned) return false;
  if (tab.incognito) return false;
  const url = tab.url ?? tab.pendingUrl ?? '';
  return shouldDisplayUrl(url);
}

/** 把 Chrome 标签页转换为归档快照条目。 */
function toArchivedTab(tab: chrome.tabs.Tab): ArchivedTab {
  const url = tab.url ?? tab.pendingUrl ?? '';
  const extensionFavicon = getFaviconUrl(url);
  return {
    url,
    title: tab.title ?? '',
    favIconUrl: extensionFavicon !== '' ? extensionFavicon : (tab.favIconUrl ?? ''),
    hostname: extractHostname(url),
    pinned: tab.pinned,
  };
}

/** 生成默认会话名，优先复用扩展 i18n 文案。 */
function buildDefaultSessionName(): string {
  const locale = typeof chrome === 'undefined'
    ? 'zh-CN'
    : (chrome.i18n?.getUILanguage?.() ?? 'zh-CN');
  const dateStr = new Date().toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const localized = typeof chrome === 'undefined'
    ? ''
    : (chrome.i18n?.getMessage?.('archive_session_name', [dateStr]) ?? '');
  return localized !== '' ? localized : `会话 ${dateStr}`;
}

/** 持久化一个新会话到会话列表头部。 */
async function prependSession(session: ArchivedSession): Promise<void> {
  const sessions = await getArchivedSessions();
  sessions.unshift(session);
  await saveSessions(sessions);
}

/**
 * 归档一组标签页。
 *
 * 流程：
 * 1. 过滤掉不可归档的标签页
 * 2. 先把快照写入持久化存储
 * 3. 再关闭真实标签页
 *
 * 即使关闭阶段失败，也保证归档快照已经可恢复。
 */
async function archiveTabs(tabs: chrome.tabs.Tab[]): Promise<ArchiveOperationResult> {
  const toArchive = tabs.filter(isArchivableTab);
  if (toArchive.length === 0) {
    throw new Error('No tabs to archive');
  }

  const archivedTabs = toArchive.map(toArchivedTab);
  const session: ArchivedSession = {
    id: nanoid(10),
    name: buildDefaultSessionName(),
    createdAt: Date.now(),
    tabs: archivedTabs,
    tabCount: archivedTabs.length,
  };

  await prependSession(session);

  const tabIds = toArchive.map((tab) => tab.id).filter((id): id is number => id !== undefined);
  let closedCount = tabIds.length;
  try {
    await closeTabs(tabIds);
  } catch (err) {
    console.warn('[Canopy] archive: close tabs failed after snapshot saved', err);
    closedCount = 0;
  }

  return {
    session,
    archivedCount: archivedTabs.length,
    closedCount,
  };
}

/** 归档所有可归档标签页。 */
export async function archiveAllTabs(): Promise<ArchiveOperationResult> {
  return archiveTabs(await queryAllTabs());
}

/** 归档当前窗口的可归档标签页。 */
export async function archiveCurrentWindowTabs(): Promise<ArchiveOperationResult> {
  return archiveTabs(await queryTabs({ currentWindow: true }));
}

/** 归档指定 ID 的标签页。 */
export async function archiveSelectedTabs(tabIds: number[]): Promise<ArchiveOperationResult> {
  const targetIds = new Set(tabIds);
  const allTabs = await queryAllTabs();
  return archiveTabs(allTabs.filter((tab) => tab.id !== undefined && targetIds.has(tab.id)));
}

/**
 * 恢复一个归档会话。
 *
 * 恢复策略（F-14 扩展）：
 * - `new_window`（默认，新窗口打开全部）
 * - `current_window`（追加到当前窗口末尾）
 * - `partial`（由调用方先过滤 tabs，再传 urls 子集）
 *
 * > 30 Tab 分批恢复（10 / 批，100ms 间隔），减少 Chrome 限流与卡顿。
 */
export type RestoreStrategy = 'new_window' | 'current_window' | 'partial';

export interface RestoreOptions {
  strategy?: RestoreStrategy;
  /** partial 策略下仅恢复这些 URL；其它策略忽略 */
  urls?: string[];
  /** 进度回调 */
  onProgress?: (done: number, total: number) => void;
  /** 取消信号：置为 true 时停止后续批次 */
  shouldCancel?: () => boolean;
  /** 单批大小（默认 10） */
  batchSize?: number;
  /** 批间隔 ms（默认 100） */
  batchInterval?: number;
}

export interface RestoreOutcome {
  restored: number;
  batches: number;
  cancelled: boolean;
}

export async function restoreSession(
  sessionId: string,
  options: RestoreOptions = {},
): Promise<RestoreOutcome> {
  const sessions = await getArchivedSessions();
  const session = sessions.find((s) => s.id === sessionId);
  if (session === undefined) throw new Error('Session not found');

  const sessionUrls = filterSafeExternalUrls(session.tabs.map((tab) => tab.url).filter((url): url is string => url !== ''));
  const strategy: RestoreStrategy = options.strategy ?? 'new_window';
  const targetUrls = filterSafeExternalUrls(strategy === 'partial' ? (options.urls ?? sessionUrls) : sessionUrls);
  if (targetUrls.length === 0) return { restored: 0, batches: 0, cancelled: false };

  const batchSize = options.batchSize ?? 10;
  const batchInterval = options.batchInterval ?? 100;

  /** 确定 targetWindowId：new_window 开新窗、current_window 用当前 */
  let targetWindowId: number | undefined;
  if (strategy === 'new_window') {
    // 单 tab 走 createTab({url})，默认在当前窗口；其余情况新窗口承载
    if (targetUrls.length === 1) {
      await createTab({ url: targetUrls[0] });
      options.onProgress?.(1, 1);
      return { restored: 1, batches: 1, cancelled: false };
    }
    if (typeof chrome !== 'undefined' && chrome.windows !== undefined) {
      try {
        const w = await chrome.windows.create({ url: targetUrls[0], focused: true });
        targetWindowId = w?.id;
        options.onProgress?.(1, targetUrls.length);
        // 第一个已在 chrome.windows.create 中创建，下面从 index 1 开始
        const restUrls = targetUrls.slice(1);
        return await batchCreateTabs(restUrls, targetWindowId, batchSize, batchInterval, options, 1);
      } catch (err) {
        console.warn('[archive] new_window failed, fallback current window', err);
      }
    }
  }

  // current_window 或 new_window 失败回落：拿当前窗口
  if (targetWindowId === undefined) {
    const currentWindow = await getCurrentWindow();
    targetWindowId = currentWindow?.id;
  }
  return batchCreateTabs(targetUrls, targetWindowId, batchSize, batchInterval, options, 0);
}

async function batchCreateTabs(
  urls: string[],
  windowId: number | undefined,
  batchSize: number,
  batchInterval: number,
  options: RestoreOptions,
  startDone: number,
): Promise<RestoreOutcome> {
  let done = startDone;
  let batches = 0;
  const total = urls.length + startDone;
  for (let i = 0; i < urls.length; i += batchSize) {
    if (options.shouldCancel?.() === true) {
      return { restored: done, batches, cancelled: true };
    }
    const slice = urls.slice(i, i + batchSize);
    for (const url of slice) {
      if (options.shouldCancel?.() === true) {
        return { restored: done, batches, cancelled: true };
      }
      try {
        await createTab({ url, windowId, active: false });
        done += 1;
        options.onProgress?.(done, total);
      } catch (err) {
        console.warn('[archive] createTab failed', err);
      }
    }
    batches += 1;
    if (i + batchSize < urls.length) {
      await new Promise((r) => setTimeout(r, batchInterval));
    }
  }
  return { restored: done, batches, cancelled: false };
}

/** 删除一个归档会话。 */
export async function deleteSession(sessionId: string): Promise<void> {
  const sessions = await getArchivedSessions();
  const filtered = sessions.filter((session) => session.id !== sessionId);
  await saveSessions(filtered);
}

/** 重命名一个归档会话。 */
export async function renameSession(sessionId: string, newName: string): Promise<void> {
  const sessions = await getArchivedSessions();
  const session = sessions.find((item) => item.id === sessionId);
  if (session !== undefined) {
    session.name = newName;
    await saveSessions(sessions);
  }
}

/**
 * 合并多个归档会话为一个新会话（F-14）。
 *
 * 合并策略：
 *   · URL 按"忽略 #hash + utm/fbclid/gclid"去重
 *   · 创建新会话替代源会话（源会话全部删除）
 *   · 返回新会话供 Undo 记录
 */
export async function mergeSessions(sessionIds: string[], newName: string): Promise<ArchivedSession> {
  const sessions = await getArchivedSessions();
  const merging = sessions.filter((s) => sessionIds.includes(s.id));
  if (merging.length < 2) throw new Error('Need at least 2 sessions to merge');

  const seen = new Set<string>();
  const mergedTabs: ArchivedTab[] = [];
  for (const s of merging) {
    for (const tab of s.tabs) {
      const key = canonicalUrlKey(tab.url);
      if (seen.has(key)) continue;
      seen.add(key);
      mergedTabs.push(tab);
    }
  }

  const newSession: ArchivedSession = {
    id: nanoid(10),
    name: newName.trim() !== '' ? newName.trim() : buildDefaultSessionName(),
    createdAt: Date.now(),
    tabs: mergedTabs,
    tabCount: mergedTabs.length,
    source: 'manual',
  };

  const remaining = sessions.filter((s) => !sessionIds.includes(s.id));
  await saveSessions([newSession, ...remaining]);
  return newSession;
}

function canonicalUrlKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    const params = new URLSearchParams();
    for (const [k, v] of u.searchParams.entries()) {
      if (!/^(utm_\w+|fbclid|gclid)$/i.test(k)) params.set(k, v);
    }
    u.search = params.toString();
    u.searchParams.sort();
    return u.toString().replace(/\/+$/, '');
  } catch {
    return url;
  }
}

/**
 * 导出单个会话为可下载的 JSON 对象（F-14 分享）。
 * 调用方负责触发浏览器下载。
 */
export async function exportSingleSession(sessionId: string): Promise<{ filename: string; content: string } | null> {
  const sessions = await getArchivedSessions();
  const session = sessions.find((s) => s.id === sessionId);
  if (session === undefined) return null;
  const payload = {
    __canopy: 'session-export',
    version: 1,
    exportedAt: Date.now(),
    session,
  };
  return {
    filename: `canopy-session-${session.id}.json`,
    content: JSON.stringify(payload, null, 2),
  };
}

/**
 * 创建隐藏的自动快照会话（F-23）。
 * 调用方传入已经过滤好的 tabs（通常是当前窗口的非 pin/非隐私 Tab）。
 */
export async function createAutoSnapshot(tabs: chrome.tabs.Tab[]): Promise<ArchivedSession | null> {
  const toArchive = tabs.filter(isArchivableTab);
  if (toArchive.length === 0) return null;
  const archivedTabs = toArchive.map(toArchivedTab);
  const now = new Date();
  const dateStr = now.toLocaleString(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const session: ArchivedSession = {
    id: nanoid(10),
    name: `自动快照 · ${dateStr}`,
    createdAt: now.getTime(),
    tabs: archivedTabs,
    tabCount: archivedTabs.length,
    hidden: true,
    source: 'auto',
  };
  const sessions = await getArchivedSessions();
  sessions.unshift(session);
  // FIFO 上限：hidden 超过配置值自动删除最老
  const hiddenList = sessions.filter((s) => s.hidden === true);
  const maxHidden = CONFIG.business.maxAutoSnapshotHidden ?? 20;
  if (hiddenList.length > maxHidden) {
    const toRemove = new Set(hiddenList.slice(maxHidden).map((s) => s.id));
    const pruned = sessions.filter((s) => !toRemove.has(s.id));
    await saveSessions(pruned);
  } else {
    await saveSessions(sessions);
  }
  return session;
}
