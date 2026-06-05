/**
 * tab-sort-sync — 浏览器标签栏排序同步工具
 *
 * DomainGroupView 和 CompactView 共用，消除 38 行重复代码。
 */

import { moveTabs } from "@/chrome/tabs";
import type { LiveTab } from "@/shared/types";

/**
 * 将排序后的标签顺序同步到浏览器标签栏
 */
export async function syncSortToBrowser(sortedTabs: LiveTab[]): Promise<void> {
  const currentWindow = await chrome.windows.getCurrent();
  const windowId = currentWindow.id;
  if (!windowId) return;

  const windowTabIds = sortedTabs
    .filter((t) => t.windowId === windowId)
    .map((t) => t.id);

  if (windowTabIds.length === 0) return;

  const allWindowTabs = await chrome.tabs.query({ windowId });
  const pinnedCount = allWindowTabs.filter((t) => t.pinned).length;

  try {
    await moveTabs(windowTabIds, windowId, pinnedCount);
  } catch {
    // 忽略移动失败
  }
}

/**
 * 恢复浏览器标签栏的原始顺序
 */
export async function restoreBrowserOrder(originalTabIds: number[]): Promise<void> {
  const currentWindow = await chrome.windows.getCurrent();
  const windowId = currentWindow.id;
  if (!windowId) return;

  const allWindowTabs = await chrome.tabs.query({ windowId });
  const currentTabIds = new Set(allWindowTabs.map((t) => t.id));
  const validIds = originalTabIds.filter((id) => currentTabIds.has(id));
  if (validIds.length === 0) return;

  const pinnedCount = allWindowTabs.filter((t) => t.pinned).length;

  try {
    await moveTabs(validIds, windowId, pinnedCount);
  } catch {
    // 忽略恢复失败
  }
}
