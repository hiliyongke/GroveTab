/**
 * ArchiveService — Atomic archive (save all tabs) and restore operations
 */

import { nanoid } from 'nanoid';
import type { ArchivedSession, ArchivedTab } from '@/shared/types';
import { getData, setData } from '@/repositories';
import { queryAllTabs, closeTabs } from '@/chrome';
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

  const archivedTabs: ArchivedTab[] = toArchive.map((tab) => ({
    url: tab.url || tab.pendingUrl || '',
    title: tab.title || '',
    favIconUrl: tab.favIconUrl || '',
    hostname: extractHostname(tab.url || ''),
    pinned: tab.pinned,
  }));

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

  // Now close the tabs
  const tabIds = toArchive.map((t) => t.id).filter((id): id is number => id !== undefined);
  try {
    await closeTabs(tabIds);
  } catch {
    // Even if close fails, the archive is already saved
  }

  return { session, closedCount: tabIds.length };
}

/** Restore an archived session (opens in a new window) */
export async function restoreSession(sessionId: string): Promise<void> {
  const sessions = await getArchivedSessions();
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) throw new Error('Session not found');

  const urls = session.tabs.map((t) => t.url);

  if (urls.length === 1) {
    chrome.tabs.create({ url: urls[0] });
  } else {
    // Open in batches of 30 to avoid browser freeze
    const batchSize = 30;
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      if (i === 0) {
        chrome.windows.create({ url: batch });
      } else {
        // Add to the most recently created window
        const currentWindow = await chrome.windows.getCurrent();
        if (currentWindow.id) {
          for (const url of batch) {
            chrome.tabs.create({ windowId: currentWindow.id, url });
          }
        }
      }
    }
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
