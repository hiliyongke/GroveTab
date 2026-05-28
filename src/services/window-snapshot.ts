/**
 * WindowSnapshot — 窗口快照保存/恢复
 *
 * 复用已有的 archive 基础设施，实现窗口快照：
 *   - 保存快照：调用 archiveSelectedTabs 但不关闭标签，创建 source='snapshot' 会话
 *   - 恢复快照：调用 restoreSession，支持恢复到原始窗口/合并到当前窗口
 *   - 快照列表：从 sessions-slice 获取 source='snapshot' 的会话
 */

import { nanoid } from "nanoid";
import type { ArchivedSession, ArchivedTab } from "@/shared/types";
import { queryAllTabs, queryTabGroups } from "@/chrome";
import {
  isArchivableTab,
  toArchivedTab,
  buildDefaultSessionName,
} from "@/services/archive/archive-utils";
import { prependSession, getArchivedSessions } from "@/services/archive/archive-storage";
import { restoreSession } from "@/services/archive/archive-restore";
import { BRAND } from "@/shared/config/brand";

/** 快照存储上限 */
const SNAPSHOT_LIMIT = 50;

/**
 * 保存窗口快照（不关闭标签）
 */
export async function saveWindowSnapshot(
  windowId: number,
  name?: string,
): Promise<ArchivedSession> {
  const allTabs = await queryAllTabs();
  const windowTabs = allTabs.filter((tab) => tab.windowId === windowId);
  const toArchive = windowTabs.filter(isArchivableTab);

  if (toArchive.length === 0) {
    throw new Error("No tabs to snapshot");
  }

  const archivedTabs: ArchivedTab[] = toArchive.map((tab, i) => ({
    ...toArchivedTab(tab),
    index: tab.index ?? i,
    groupId: tab.groupId !== undefined && tab.groupId >= 0 ? tab.groupId : undefined,
  }));

  // 采集 TabGroup 快照
  let tabGroups = undefined;
  try {
    const groups = await queryTabGroups(windowId);
    if (groups.length > 0) {
      const involvedGroupIds = new Set(
        toArchive.map((t) => t.groupId).filter((id): id is number => id !== undefined && id >= 0),
      );
      tabGroups = groups
        .filter((g) => involvedGroupIds.has(g.id))
        .map((g) => ({
          groupId: g.id,
          title: g.title ?? "",
          color: g.color as string,
          collapsed: g.collapsed,
        }));
    }
  } catch (err) {
    console.warn(`${BRAND.logTag} snapshot: queryTabGroups failed`, err);
  }

  const session: ArchivedSession = {
    id: nanoid(10),
    name: name ?? `${buildDefaultSessionName()} (快照)`,
    createdAt: Date.now(),
    tabs: archivedTabs,
    tabCount: archivedTabs.length,
    source: "snapshot",
    ...(tabGroups && tabGroups.length > 0 ? { tabGroups } : {}),
  };

  await prependSession(session);

  // 淘汰超限旧快照（保留手动保存的）
  await pruneOldSnapshots();

  return session;
}

/**
 * 恢复窗口快照
 */
export async function restoreWindowSnapshot(
  sessionId: string,
  strategy: "new_window" | "current_window" = "new_window",
): Promise<{ restored: number }> {
  const outcome = await restoreSession(sessionId, {
    strategy,
    restoreTabGroups: true,
  });
  return { restored: outcome.restored };
}

/**
 * 获取所有快照
 */
export async function getWindowSnapshots(): Promise<ArchivedSession[]> {
  const sessions = await getArchivedSessions();
  return sessions.filter((s) => s.source === "snapshot");
}

/**
 * 淘汰超限旧快照
 */
async function pruneOldSnapshots(): Promise<void> {
  const sessions = await getArchivedSessions();
  const snapshots = sessions.filter((s) => s.source === "snapshot");

  if (snapshots.length <= SNAPSHOT_LIMIT) return;

  // 按时间排序，最旧的在前
  snapshots.sort((a, b) => a.createdAt - b.createdAt);

  const toDelete = snapshots.slice(0, snapshots.length - SNAPSHOT_LIMIT);
  const { deleteSession: svcDeleteSession } =
    await import("@/services/archive/archive-session-management");
  for (const s of toDelete) {
    try {
      await svcDeleteSession(s.id);
    } catch {
      // 静默处理删除失败
    }
  }
}
