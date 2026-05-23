/**
 * Window Tab Operations — 窗口级标签页操作
 *
 * 所有 Chrome API 调用通过 @/chrome safeCall 封装，统一超时和错误归一化。
 */

import { closeTabs, moveTabs, createTab, safeCall } from '@/chrome/tabs';
import type { LiveTab } from '@/shared/types/tab';
import type { GroupColor, SmartSortRule } from '../WindowView/types';

const MOVE_BATCH_SIZE = 10;

/**
 * 按规则对标签页排序
 *
 * 支持多种排序规则：
 *   - domain: 按域名分组排序
 *   - recentAccess: 按最近访问时间排序
 *   - alphabetical: 按标题字母排序
 *   - type: 按类型排序（固定标签 > 组标签 > 普通标签）
 *
 * @param tabs - 待排序的标签页列表
 * @param rule - 排序规则
 * @returns 排序后的标签页 ID 数组
 */
export function sortTabsByRule(tabs: LiveTab[], rule: SmartSortRule): number[] {
  const sorted = [...tabs];

  switch (rule) {
    case 'domain':
      sorted.sort((a, b) => {
        const domainCmp = a.hostname.localeCompare(b.hostname);
        if (domainCmp !== 0) return domainCmp;
        return (a.title ?? '').localeCompare(b.title ?? '');
      });
      break;
    case 'recentAccess':
      sorted.sort((a, b) => {
        const aTime = a.lastAccessed ?? 0;
        const bTime = b.lastAccessed ?? 0;
        return bTime - aTime;
      });
      break;
    case 'alphabetical':
      sorted.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
      break;
    case 'type':
      sorted.sort((a, b) => {
        const typeOrder = (tab: LiveTab) => {
          if (tab.pinned) return 0;
          if (tab.groupId !== undefined && tab.groupId !== -1) return 1;
          return 2;
        };
        const aType = typeOrder(a);
        const bType = typeOrder(b);
        if (aType !== bType) return aType - bType;
        return (a.title ?? '').localeCompare(b.title ?? '');
      });
      break;
  }

  return sorted.map((tab) => tab.id);
}

/**
 * 获取指定分组中的标签页
 *
 * @param tabs - 所有标签页列表
 * @param groupId - 分组 ID（-1 表示未分组）
 * @returns 指定分组中的标签页列表
 */
export function getTabsInGroup(tabs: LiveTab[], groupId: number): LiveTab[] {
  return tabs.filter((tab) => tab.groupId === groupId && tab.groupId !== -1);
}

/**
 * 将标签页合并到指定窗口
 *
 * 批量移动标签页到目标窗口，分批执行以避免 Chrome API 限制。
 *
 * @param tabIds - 待移动的标签页 ID 列表
 * @param targetWindowId - 目标窗口 ID
 * @returns 空的 Promise
 */
export async function mergeTabsIntoWindow(tabIds: number[], targetWindowId: number): Promise<void> {
  for (let i = 0; i < tabIds.length; i += MOVE_BATCH_SIZE) {
    const batch = tabIds.slice(i, i + MOVE_BATCH_SIZE);
    await moveTabs(batch, targetWindowId, -1);
  }
}

/**
 * 关闭指定窗口的所有标签页
 *
 * 批量关闭标签页，返回实际关闭的数量。
 *
 * @param windowTabs - 待关闭的标签页列表
 * @returns 实际关闭的标签页数量
 */
export async function closeWindowTabs(windowTabs: LiveTab[]): Promise<number> {
  const tabIds = windowTabs.map((tab) => tab.id);
  if (tabIds.length > 0) {
    await closeTabs(tabIds);
  }
  return tabIds.length;
}

/**
 * 将单个标签页移动到指定窗口
 *
 * @param tabId - 待移动的标签页 ID
 * @param targetWindowId - 目标窗口 ID
 * @param index - 目标位置索引（-1 表示末尾）
 * @returns 空的 Promise
 */
export async function moveTabToWindow(tabId: number, targetWindowId: number, index = -1): Promise<void> {
  await moveTabs([tabId], targetWindowId, index);
}

/**
 * 复制单个标签页到指定窗口
 *
 * 在原窗口保留标签页，在目标窗口创建副本。
 *
 * @param tab - 待复制的标签页
 * @param targetWindowId - 目标窗口 ID
 * @returns 空的 Promise
 */
export async function copyTabToWindow(tab: LiveTab, targetWindowId: number): Promise<void> {
  await createTab({
    windowId: targetWindowId,
    url: tab.url,
    active: false,
  });
}

/**
 * 将标签页移动到指定标签页之前
 *
 * @param tabId - 待移动的标签页 ID
 * @param targetWindowId - 目标窗口 ID
 * @param targetTabs - 目标窗口的标签页列表
 * @param beforeTabId - 插入位置之前的标签页 ID
 * @returns 空的 Promise
 */
export async function moveTabBeforeTab(tabId: number, targetWindowId: number, targetTabs: LiveTab[], beforeTabId: number): Promise<void> {
  const toIndex = targetTabs.findIndex((tab) => tab.id === beforeTabId);
  await moveTabs([tabId], targetWindowId, toIndex >= 0 ? toIndex : -1);
}

/**
 * 重新排序标签页
 *
 * 按照指定的标签 ID 顺序重新排序标签页。
 *
 * @param tabIds - 按期望顺序排列的标签页 ID 列表
 * @returns 空的 Promise
 */
export async function reorderTabs(tabIds: number[]): Promise<void> {
  for (let i = 0; i < tabIds.length; i += 1) {
    const tabId = tabIds[i];
    if (tabId === undefined) continue;
    await safeCall('tabs.move', () => chrome.tabs.move(tabId, { index: i }));
  }
}

/**
 * 为单个标签页创建新分组
 *
 * @param tabId - 待分组的标签页 ID
 * @returns 新创建的分组 ID
 */
export async function createTabGroup(tabId: number): Promise<number> {
  return safeCall('tabs.group', () =>
    chrome.tabs.group({ tabIds: [tabId] as [number, ...number[]] }),
  );
}

/**
 * 将标签页添加到指定分组
 *
 * @param tabId - 待添加的标签页 ID
 * @param groupId - 目标分组 ID
 * @returns 空的 Promise
 */
export async function addTabToGroup(tabId: number, groupId: number): Promise<void> {
  await safeCall('tabs.group', () =>
    chrome.tabs.group({ groupId, tabIds: [tabId] as [number, ...number[]] }),
  );
}

/**
 * 合并标签分组
 *
 * 将源分组中的标签页合并到目标分组中。
 *
 * @param sourceTabIds - 源分组中的标签页 ID 列表
 * @param targetGroupId - 目标分组 ID
 * @returns 空的 Promise
 */
export async function mergeTabGroups(sourceTabIds: number[], targetGroupId: number): Promise<void> {
  if (sourceTabIds.length === 0) return;

  await safeCall('tabs.group', () =>
    chrome.tabs.group({ groupId: targetGroupId, tabIds: sourceTabIds as [number, ...number[]] }),
  );
}

/**
 * 取消标签页分组
 *
 * 将指定标签页从分组中移除，使其成为普通标签页。
 *
 * @param tabIds - 待取消分组的标签页 ID 列表
 * @returns 空的 Promise
 */
export async function ungroupTabs(tabIds: number[]): Promise<void> {
  await Promise.all(tabIds.map((tabId) =>
    safeCall('tabs.ungroup', () => chrome.tabs.ungroup(tabId)),
  ));
}

/**
 * 将整个分组移动到指定窗口
 *
 * 先取消分组，再将标签页移动到目标窗口，最后重新分组。
 *
 * @param groupTabs - 待移动的分组中的标签页列表
 * @param targetWindowId - 目标窗口 ID
 * @param index - 目标位置索引（-1 表示末尾）
 * @returns 移动后的标签页 ID 列表
 */
export async function moveGroupToWindow(groupTabs: LiveTab[], targetWindowId: number, index = -1): Promise<number[]> {
  const tabIds = groupTabs.map((tab) => tab.id);
  if (tabIds.length === 0) return [];

  await ungroupTabs(tabIds);
  await moveTabs(tabIds, targetWindowId, index);
  return tabIds;
}

/**
 * 重命名标签分组
 *
 * @param groupId - 待重命名的分组 ID
 * @param title - 新分组名称
 * @returns 空的 Promise
 */
export async function renameTabGroup(groupId: number, title: string): Promise<void> {
  await safeCall('tabGroups.update', () => chrome.tabGroups.update(groupId, { title }));
}

/**
 * 重新着色标签分组
 *
 * @param groupId - 待着色的分组 ID
 * @param color - 新分组颜色
 * @returns 空的 Promise
 */
export async function recolorTabGroup(groupId: number, color: GroupColor): Promise<void> {
  await safeCall('tabGroups.update', () => chrome.tabGroups.update(groupId, { color }));
}
