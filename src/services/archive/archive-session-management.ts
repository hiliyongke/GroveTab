/**
 * 归档服务 - 会话管理
 *
 * 负责归档会话的 CRUD 操作：删除、重命名、合并、导出、自动快照等。
 */

import { nanoid } from 'nanoid';
import type { ArchivedSession, ArchivedTab } from '@/shared/types';
import { CONFIG } from '@/shared/config';
import { APP_RESOURCE_NAMES } from '@/shared/config/storage-keys';
import { getArchivedSessions, saveSessions } from './archive-storage';
import { buildDefaultSessionName, canonicalUrlKey, isArchivableTab, toArchivedTab } from './archive-utils';

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

/**
 * 导出单个会话为可下载的 JSON 对象（F-14 分享）。
 * 调用方负责触发浏览器下载。
 */
export async function exportSingleSession(sessionId: string): Promise<{ filename: string; content: string } | null> {
  const sessions = await getArchivedSessions();
  const session = sessions.find((s) => s.id === sessionId);
  if (session === undefined) return null;
  const payload = {
    __app: 'session-export',
    version: 1,
    exportedAt: Date.now(),
    session,
  };
  return {
    filename: `${APP_RESOURCE_NAMES.sessionFilePrefix}-${session.id}.json`,
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
