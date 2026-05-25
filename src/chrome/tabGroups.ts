/**
 * Chrome API — Tab Groups Promise 化封装
 *
 * 所有调用点统一通过这里访问 `chrome.tabGroups` / `chrome.tabs.group` / `chrome.tabs.ungroup`，
 * 便于在极旧 Chrome、无权限或非扩展上下文中做能力检测和错误归一化。
 */

import { safeCall } from "./tabs";

/** Chrome 原生 Tab Group 颜色。`@types/chrome` 当前未导出 ColorEnum，项目内显式维护字面量联合。 */
export type ChromeTabGroupColor =
  | "grey"
  | "blue"
  | "red"
  | "yellow"
  | "green"
  | "pink"
  | "purple"
  | "cyan"
  | "orange";

/** Chrome 原生 Tab Group 信息 */
export interface ChromeTabGroup {
  id: number;
  title?: string;
  color: ChromeTabGroupColor;
  collapsed: boolean;
  windowId: number;
}

export type ChromeTabGroupUpdateProperties = Omit<chrome.tabGroups.UpdateProperties, "color"> & {
  color?: ChromeTabGroupColor;
};
export interface ChromeTabsGroupOptions extends Omit<chrome.tabs.GroupOptions, "tabIds"> {
  tabIds: number | number[];
}

function normalizeTabIds(tabIds: number | number[]): number | [number, ...number[]] {
  if (Array.isArray(tabIds)) {
    if (tabIds.length === 0) {
      throw new Error("tabs.group: tabIds cannot be empty");
    }
    return tabIds as [number, ...number[]];
  }
  return tabIds;
}

/** 判断当前运行环境是否支持 `chrome.tabGroups`。 */
function isTabGroupsAvailable(): boolean {
  return (
    typeof chrome !== "undefined" &&
    chrome.tabGroups !== undefined &&
    typeof chrome.tabGroups.query === "function" &&
    typeof chrome.tabGroups.update === "function" &&
    typeof chrome.tabGroups.move === "function" &&
    chrome.tabs !== undefined &&
    typeof chrome.tabs.group === "function" &&
    typeof chrome.tabs.ungroup === "function"
  );
}

function assertTabGroupsAvailable(label: string): void {
  if (!isTabGroupsAvailable()) {
    throw new Error(`${label}: chrome.tabGroups is unavailable`);
  }
}

/**
 * 获取 Tab Group 列表。
 *
 * 为兼容无权限/非扩展上下文，查询失败时返回空数组；写操作仍会抛出错误交由上层反馈。
 */
export async function queryTabGroups(windowId?: number): Promise<ChromeTabGroup[]> {
  try {
    if (!isTabGroupsAvailable()) return [];
    const queryInfo: chrome.tabGroups.QueryInfo = {};
    if (windowId != null) queryInfo.windowId = windowId;
    return safeCall("tabGroups.query", () => chrome.tabGroups.query(queryInfo));
  } catch {
    return [];
  }
}

/** 更新 Tab Group 标题、颜色或折叠状态。 */
export async function updateTabGroup(
  groupId: number,
  updateProperties: ChromeTabGroupUpdateProperties,
): Promise<ChromeTabGroup> {
  assertTabGroupsAvailable("tabGroups.update");
  const group = await safeCall("tabGroups.update", () =>
    chrome.tabGroups.update(groupId, updateProperties),
  );
  if (!group) throw new Error("tabGroups.update: updated group was not returned");
  return group as ChromeTabGroup;
}

/** 将标签加入已有分组，或在指定窗口创建新分组。 */
export async function groupTabs(options: ChromeTabsGroupOptions): Promise<number> {
  assertTabGroupsAvailable("tabs.group");
  return safeCall("tabs.group", () =>
    chrome.tabs.group({ ...options, tabIds: normalizeTabIds(options.tabIds) }),
  );
}

/** 将标签从当前 Tab Group 中移出。 */
export async function ungroupTabs(tabIds: number | number[]): Promise<void> {
  assertTabGroupsAvailable("tabs.ungroup");
  await safeCall("tabs.ungroup", () => chrome.tabs.ungroup(normalizeTabIds(tabIds)));
}

/** 创建新 Tab Group，并可选地立即设置标题、颜色与折叠状态。 */
export async function createTabGroup(
  tabIds: number | number[],
  createProperties?: chrome.tabs.GroupOptions["createProperties"],
  updateProperties?: ChromeTabGroupUpdateProperties,
): Promise<ChromeTabGroup> {
  const groupId = await groupTabs({ tabIds, createProperties });
  if (updateProperties !== undefined) {
    return updateTabGroup(groupId, updateProperties);
  }

  const groups = await queryTabGroups(createProperties?.windowId);
  const group = groups.find((item) => item.id === groupId);
  if (group === undefined) {
    throw new Error(`tabs.group: created group ${groupId} was not found`);
  }
  return group;
}
