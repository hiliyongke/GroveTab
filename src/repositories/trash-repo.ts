/**
 * TrashRepo — 回收站数据层
 *
 * 提供回收站的增删改查和自动清理功能。
 * v1.4: 迁移到 archive 服务层，以 ArchivedSession（source='trash'）存储回收项。
 */

import { getArchivedSessions, saveSessions, deleteSession } from "@/services/archive";
import { prependSession } from "@/services/archive/archive-storage";
import type { TrashedItem, TrashedTab } from "@/shared/types/trash";
import type { ArchivedSession, ArchivedTab } from "@/shared/types";
import { translate } from "@/shared/i18n/core";

const MAX_TRASH_ITEMS = 200;
const TRASH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天自动过期

/** Helper: 将 ArchivedTab 映射为 TrashedTab（补齐旧字段默认值）。 */
function toTrashedTab(tab: ArchivedTab): TrashedTab {
  return {
    id: 0, // 归档 Tab 不保留原始 tab id
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl,
    hostname: tab.hostname,
    pinned: tab.pinned,
    windowId: 0,
    groupId: tab.groupId ?? -1,
  };
}

/** Helper: 将 ArchivedSession（source='trash'）映射为 TrashedItem。 */
function sessionToTrashedItem(session: ArchivedSession): TrashedItem {
  return {
    id: session.id,
    name: session.name,
    trashedAt: session.createdAt,
    tabs: session.tabs.map(toTrashedTab),
  };
}

/** 获取回收站所有条目 */
export async function getTrashItems(): Promise<TrashedItem[]> {
  const sessions = await getArchivedSessions();
  const now = Date.now();

  const trashSessions = sessions.filter((s) => s.source === "trash");
  const valid: ArchivedSession[] = [];
  const expiredIds: string[] = [];

  for (const s of trashSessions) {
    if (now - s.createdAt < TRASH_TTL_MS) {
      valid.push(s);
    } else {
      expiredIds.push(s.id);
    }
  }

  // 自动清理过期项（惰性清理，仅在读取时触发）
  if (expiredIds.length > 0) {
    const idSet = new Set(expiredIds);
    const remaining = sessions.filter((s) => !idSet.has(s.id));
    await saveSessions(remaining);
  }

  return valid
    .map(sessionToTrashedItem)
    .sort((a, b) => b.trashedAt - a.trashedAt);
}

/** 将标签页放入回收站 */
export async function addToTrash(tabs: TrashedTab[]): Promise<TrashedItem[]> {
  if (tabs.length === 0) return getTrashItems();

  const hostname = tabs[0]?.hostname ?? translate("未知");
  const name =
    tabs.length === 1
      ? `${hostname} · ${tabs[0]?.title ?? ""}`.slice(0, 80)
      : translate("{hostname} · {count} 个标签", { hostname, count: tabs.length });

  const now = Date.now();
  const archivedTabs: ArchivedTab[] = tabs.map((tab) => ({
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl ?? "",
    hostname: tab.hostname,
    pinned: tab.pinned,
    groupId: tab.groupId,
  }));

  const session: ArchivedSession = {
    id: `trash-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    createdAt: now,
    tabs: archivedTabs,
    tabCount: archivedTabs.length,
    source: "trash",
  };

  await prependSession(session);

  // 执行 FIFO 上限裁剪：超出 MAX_TRASH_ITEMS 的最旧项将被移除
  const allSessions = await getArchivedSessions();
  const trashItems = allSessions
    .filter((s) => s.source === "trash")
    .sort((a, b) => b.createdAt - a.createdAt);

  if (trashItems.length > MAX_TRASH_ITEMS) {
    const toDelete = trashItems.slice(MAX_TRASH_ITEMS);
    const deleteIds = new Set(toDelete.map((s) => s.id));
    const remaining = allSessions.filter((s) => !deleteIds.has(s.id));
    await saveSessions(remaining);
  }

  return getTrashItems();
}

/** 从回收站恢复条目（移除该回收项） */
export async function removeFromTrash(itemId: string): Promise<TrashedItem[]> {
  await deleteSession(itemId);
  return getTrashItems();
}

/** 清空回收站 */
export async function clearTrash(): Promise<void> {
  const sessions = await getArchivedSessions();
  const trashIds = sessions
    .filter((s) => s.source === "trash")
    .map((s) => s.id);

  if (trashIds.length === 0) return;

  const idSet = new Set(trashIds);
  const remaining = sessions.filter((s) => !idSet.has(s.id));
  await saveSessions(remaining);
}

/** 手动清理过期条目，返回删除数量 */
export async function pruneTrash(): Promise<number> {
  const sessions = await getArchivedSessions();
  const now = Date.now();

  const trashSessions = sessions.filter((s) => s.source === "trash");
  const expired = trashSessions.filter((s) => now - s.createdAt >= TRASH_TTL_MS);

  if (expired.length === 0) return 0;

  const expiredIds = new Set(expired.map((s) => s.id));
  const remaining = sessions.filter((s) => !expiredIds.has(s.id));
  await saveSessions(remaining);

  return expired.length;
}
