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
import { getData, setData } from '@/repositories';
import { queryAllTabs, queryTabs, closeTabs, createTab, getCurrentWindow, getFaviconUrl } from '@/chrome';
import { extractHostname, isSelfNewTabPage, shouldDisplayUrl } from '@/chrome';
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
 * 恢复策略：
 * - 单个标签页：直接在当前环境打开
 * - 多个标签页：顺序追加到当前窗口，避免 Chrome 对同窗口瞬时并发建 tab 限流
 */
export async function restoreSession(sessionId: string): Promise<void> {
  const sessions = await getArchivedSessions();
  const session = sessions.find((s) => s.id === sessionId);
  if (session === undefined) throw new Error('Session not found');

  const urls = session.tabs.map((tab) => tab.url).filter((url): url is string => url !== '');
  if (urls.length === 0) return;

  if (urls.length === 1) {
    await createTab({ url: urls[0] });
    return;
  }

  const currentWindow = await getCurrentWindow();
  const windowId = currentWindow?.id;
  for (const url of urls) {
    await createTab({ url, windowId, active: false });
  }
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
