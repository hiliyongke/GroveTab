import { discardTab as chromeDiscardTab, getFaviconUrl } from '@/chrome';
import { extractHostname, isSelfNewTabPage, shouldDisplayUrl } from '@/chrome';
import type { ClosedTabSnapshot, LiveTab, WindowInfo } from '@/shared/types';
import type { ChromeTabGroup } from '@/chrome';

/**
 * 标签服务
 *
 * 提供标签数据转换、窗口管理、标签组操作和批量丢弃等核心功能。
 * 作为 Chrome API 与内部数据结构之间的桥梁层，负责数据清洗和格式转换。
 */

/** 批量丢弃结果 */
export interface DiscardBatchResult {
  /** 成功丢弃的标签 ID 列表 */
  succeededIds: number[];
  /** 丢弃失败的标签 ID 列表 */
  failedIds: number[];
}

/**
 * 将 Chrome 标签对象转换为内部 LiveTab 格式
 *
 * 过滤规则：
 * - 忽略无 ID 的标签
 * - 忽略扩展自带的 newtab 页面（避免自引用）
 * - 忽略不应显示的 URL（如 chrome:// 内部页面）
 *
 * @param tab - Chrome 标签对象
 * @param currentWindowId - 当前焦点窗口 ID，用于标记标签是否属于当前窗口
 * @returns 转换后的 LiveTab 对象，若被过滤则返回 null
 */
export function toLiveTab(tab: chrome.tabs.Tab, currentWindowId: number): LiveTab | null {
  if (tab.id == null) return null;

  const url = tab.url ?? tab.pendingUrl ?? '';
  if (isSelfNewTabPage(tab)) return null;
  if (!shouldDisplayUrl(url)) return null;

  const extensionFavicon = getFaviconUrl(url);
  const favIconUrl = extensionFavicon !== '' ? extensionFavicon : (tab.favIconUrl ?? '');

  return {
    id: tab.id,
    url,
    title: tab.title ?? url,
    favIconUrl,
    windowId: tab.windowId,
    incognito: tab.incognito,
    pinned: tab.pinned,
    audible: tab.audible ?? false,
    groupId: tab.groupId ?? -1,
    lastAccessed: tab.lastAccessed ?? 0,
    hostname: extractHostname(url),
    isCurrentWindow: tab.windowId === currentWindowId,
    discarded: tab.discarded ?? false,
  };
}

/**
 * 为 LiveTab 附加标签组信息
 *
 * 若标签属于某个标签组，则从 groupMap 中查找并附加组名和颜色。
 *
 * @param liveTab - 待附加组信息的标签
 * @param groupMap - 标签组 ID → 标签组对象的映射
 * @returns 附加了组信息的新 LiveTab（若标签页属于某个组且组存在）
 */
export function withTabGroupInfo(liveTab: LiveTab, groupMap: Map<number, ChromeTabGroup>): LiveTab {
  if (liveTab.groupId === -1) return liveTab;

  const group = groupMap.get(liveTab.groupId);
  if (group === undefined) return liveTab;

  return {
    ...liveTab,
    groupTitle: group.title,
    groupColor: group.color,
  };
}

/**
 * 将 LiveTab 转换为关闭标签快照
 *
 * 用于"最近关闭"列表的展示和恢复功能。
 * 仅保留恢复所需的最小字段，减少存储占用。
 *
 * @param tab - 待转换的 LiveTab 对象
 * @returns 关闭标签快照对象
 */
export function toClosedTabSnapshot(tab: LiveTab): ClosedTabSnapshot {
  return {
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl,
    windowId: tab.windowId,
    pinned: tab.pinned,
  };
}

/**
 * 构建窗口信息映射表
 *
 * 统计每个窗口的标签数量，并组装 WindowInfo 对象。
 * 用于窗口视图和窗口切换功能。
 *
 * @param allWindows - 所有窗口的 Chrome 窗口对象数组
 * @param allTabs - 所有标签的 Chrome 标签对象数组
 * @returns 窗口 ID → WindowInfo 的映射表
 */
export function buildWindowMap(allWindows: chrome.windows.Window[], allTabs: chrome.tabs.Tab[]): Map<number, WindowInfo> {
  const tabsCountByWindowId = new Map<number, number>();

  for (const tab of allTabs) {
    tabsCountByWindowId.set(tab.windowId, (tabsCountByWindowId.get(tab.windowId) ?? 0) + 1);
  }

  const windowMap = new Map<number, WindowInfo>();
  for (const win of allWindows) {
    if (win.id == null) continue;

    windowMap.set(win.id, {
      id: win.id,
      focused: win.focused,
      type: win.type ?? 'normal',
      incognito: win.incognito,
      tabsCount: tabsCountByWindowId.get(win.id) ?? 0,
    });
  }

  return windowMap;
}

/**
 * 更新标签列表中指定标签的丢弃状态
 *
 * 用于响应 Chrome 的 tab-discarded 事件，同步更新内存中的标签状态。
 *
 * @param tabs - 当前标签列表
 * @param tabId - 状态发生变化的标签 ID
 * @param discarded - 新的丢弃状态
 * @returns 更新后的标签列表（新数组）
 */
export function patchTabDiscardedState(tabs: LiveTab[], tabId: number, discarded: boolean): LiveTab[] {
  return tabs.map((tab) => (
    tab.id === tabId ? { ...tab, discarded } : tab
  ));
}

/**
 * 构建标签组映射表
 *
 * 将标签组数组转换为以组 ID 为键的 Map，便于 O(1) 查找。
 *
 * @param groups - Chrome 标签组对象数组
 * @returns 标签组 ID → ChromeTabGroup 的映射表
 */
export function buildTabGroupMap(groups: ChromeTabGroup[]): Map<number, ChromeTabGroup> {
  const groupMap = new Map<number, ChromeTabGroup>();

  for (const group of groups) {
    groupMap.set(group.id, group);
  }

  return groupMap;
}

/**
 * 批量丢弃标签
 *
 * 使用 Promise.allSettled 并发丢弃多个标签，收集成功和失败的 ID 列表。
 * 适用于"一键释放内存"等批量操作场景。
 *
 * @param tabIds - 待丢弃的标签 ID 数组
 * @returns 包含成功/失败 ID 列表的 Promise
 */
export async function discardTabsBatch(tabIds: number[]): Promise<DiscardBatchResult> {
  const results = await Promise.allSettled(tabIds.map((tabId) => chromeDiscardTab(tabId)));
  const succeededIds: number[] = [];
  const failedIds: number[] = [];

  results.forEach((result, index) => {
    const tabId = tabIds[index];
    if (tabId === undefined) return;

    if (result.status === 'fulfilled') {
      succeededIds.push(tabId);
      return;
    }

    failedIds.push(tabId);
  });

  return { succeededIds, failedIds };
}
