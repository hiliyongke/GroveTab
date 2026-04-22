/**
 * ArchiveService — Atomic archive (save all tabs) and restore operations
 */

import { nanoid } from 'nanoid';
import type { ArchivedSession, ArchivedTab } from '@/shared/types';
import { getData, setData } from '@/repositories';
import { queryAllTabs, closeTabs, createTab, getCurrentWindow, getFaviconUrl } from '@/chrome';
import { extractHostname, isSelfNewTabPage, shouldDisplayUrl } from '@/chrome';

const SESSIONS_KEY = 'canopy_sessions';

/** Get all archived sessions */
export async function getArchivedSessions(): Promise<ArchivedSession[]> {
  return (await getData<ArchivedSession[]>(SESSIONS_KEY)) ?? [];
}

/** Save a new archived session */
async function saveSessions(sessions: ArchivedSession[]): Promise<void> {
  await setData(SESSIONS_KEY, sessions);
}

export { saveSessions };

/** Archive all open non-pinned tabs (atomic: write first, then close) */
export async function archiveAllTabs(): Promise<{ session: ArchivedSession; closedCount: number }> {
  const allTabs = await queryAllTabs();

  // Filter: exclude self, pinned, incognito, non-displayable
  const toArchive = allTabs.filter((tab) => {
    if (isSelfNewTabPage(tab)) return false;
    if (tab.pinned) return false;
    if (tab.incognito) return false;
    const url = tab.url || tab.pendingUrl || '';
    if (!shouldDisplayUrl(url)) return false;
    return true;
  });

  if (toArchive.length === 0) {
    throw new Error('No tabs to archive');
  }

  const archivedTabs: ArchivedTab[] = toArchive.map((tab) => {
    const url = tab.url || tab.pendingUrl || '';
    // 归档保存时也把 favicon 改写成扩展同源的 `_favicon/` 入口，
    // 恢复后 `<img>` 渲染不会因原站离线或跨域而污染控制台。
    const extensionFavicon = getFaviconUrl(url);
    return {
      url,
      title: tab.title || '',
      favIconUrl: extensionFavicon || tab.favIconUrl || '',
      hostname: extractHostname(url),
      pinned: tab.pinned,
    };
  });

  const session: ArchivedSession = {
    id: nanoid(10),
    name: `会话 ${new Date().toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
    createdAt: Date.now(),
    tabs: archivedTabs,
    tabCount: archivedTabs.length,
  };

  // Atomic: write to storage FIRST, then close tabs
  const sessions = await getArchivedSessions();
  sessions.unshift(session);
  await saveSessions(sessions);

  // Now close the tabs — 失败也不影响归档完成（快照已保存），仅打 warn
  const tabIds = toArchive.map((t) => t.id).filter((id): id is number => id !== undefined);
  let closedCount = tabIds.length;
  try {
    await closeTabs(tabIds);
  } catch (err) {
    console.warn('[Canopy] archive: close tabs failed after snapshot saved', err);
    closedCount = 0;
  }

  return { session, closedCount };
}

/**
 * 恢复一个归档会话
 *
 * 单个 tab → 在当前窗口直接新开
 * 多个 tab → 分批 30 个：第一批 createWindow，后续 append 到当前窗口
 *
 * 所有 chrome API 调用都经 safeCall 封装，失败会带上下文抛出，
 * 由上层（ArchivePanel）通过 feedback 告知用户。
 */
export async function restoreSession(sessionId: string): Promise<void> {
  const sessions = await getArchivedSessions();
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) throw new Error('Session not found');

  const urls = session.tabs.map((t) => t.url).filter(Boolean);
  if (urls.length === 0) return;

  if (urls.length === 1) {
    await createTab({ url: urls[0] });
    return;
  }

  /**
   * 恢复策略（与 undo 保持一致）：
   *   - 全部在**当前窗口**追加，不再新开窗口
   *   - 顺序 createTab，避免 Chrome 对同窗口瞬时并发建 tab 的限流
   *   - active:false，防止频繁抢焦点
   */
  const currentWindow = await getCurrentWindow();
  const windowId = currentWindow?.id;
  for (const url of urls) {
    await createTab({ url, windowId, active: false });
  }
}

/** Delete an archived session */
export async function deleteSession(sessionId: string): Promise<void> {
  const sessions = await getArchivedSessions();
  const filtered = sessions.filter((s) => s.id !== sessionId);
  await saveSessions(filtered);
}

/** Rename an archived session */
export async function renameSession(sessionId: string, newName: string): Promise<void> {
  const sessions = await getArchivedSessions();
  const session = sessions.find((s) => s.id === sessionId);
  if (session) {
    session.name = newName;
    await saveSessions(sessions);
  }
}
