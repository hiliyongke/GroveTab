/**
 * 归档服务 - 归档操作
 *
 * 负责标签页归档的核心业务流程：过滤可归档标签页、创建快照、
 * 持久化会话、关闭真实标签页。保证即使关闭阶段失败，归档快照也已可恢复。
 */

import { nanoid } from "nanoid";
import type { ArchivedSession, ArchivedTabGroup, ArchivedWindowBounds } from "@/shared/types";
import { queryAllTabs, queryTabs, closeTabs, queryTabGroups, getCurrentWindow } from "@/chrome";
import { BRAND } from "@/shared/config/brand";
import { isArchivableTab, toArchivedTab, buildDefaultSessionName } from "./archive-utils";
import { prependSession } from "./archive-storage";

/** 归档结果：快照一定已落盘，关闭标签页可能部分失败。 */
export interface ArchiveOperationResult {
  session: ArchivedSession;
  archivedCount: number;
  closedCount: number;
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
    throw new Error("No tabs to archive");
  }

  // 记录原始顺序索引，用于高保真恢复
  const archivedTabs = toArchive.map((tab, i) => ({
    ...toArchivedTab(tab),
    index: tab.index ?? i,
    groupId: tab.groupId !== undefined && tab.groupId >= 0 ? tab.groupId : undefined,
  }));

  // 采集 TabGroup 快照（任务4：高保真结构化归档）
  let tabGroups: ArchivedTabGroup[] | undefined;
  try {
    const windowId = toArchive[0]?.windowId;
    const groups = await queryTabGroups(windowId);
    if (groups.length > 0) {
      // 只保留本次归档涉及的 group
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
    console.warn(`${BRAND.logTag} archive: queryTabGroups failed`, err);
  }

  // 采集窗口边界快照（任务4：高保真结构化归档）
  let windowBounds: ArchivedWindowBounds | undefined;
  try {
    const win = await getCurrentWindow();
    if (win) {
      windowBounds = {
        left: win.left ?? 0,
        top: win.top ?? 0,
        width: win.width ?? 1280,
        height: win.height ?? 800,
        state: (win.state ?? "normal") as string,
      };
    }
  } catch (err) {
    console.warn(`${BRAND.logTag} archive: getCurrentWindow failed`, err);
  }

  const session: ArchivedSession = {
    id: nanoid(10),
    name: buildDefaultSessionName(),
    createdAt: Date.now(),
    tabs: archivedTabs,
    tabCount: archivedTabs.length,
    ...(tabGroups && tabGroups.length > 0 ? { tabGroups } : {}),
    ...(windowBounds ? { windowBounds } : {}),
  };

  await prependSession(session);

  const tabIds = toArchive.map((tab) => tab.id).filter((id): id is number => id !== undefined);
  let closedCount = tabIds.length;
  try {
    await closeTabs(tabIds);
  } catch (err) {
    console.warn(`${BRAND.logTag} archive: close tabs failed after snapshot saved`, err);
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
