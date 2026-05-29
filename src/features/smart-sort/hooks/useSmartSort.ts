import { useMemo, useCallback } from "react";
import type { LiveTab } from "@/shared/types";
import type { SortMode } from "../types";
import { useSmartSortStore } from "@/store";

/** 排序时需要的外部数据（异步获取，由调用方传入） */
export interface SortContext {
  /** URL → 今日访问次数（来自 chrome.history） */
  visitCountMap?: Map<string, number>;
  /** URL → 今日使用时长 ms（来自 FocusTimeData） */
  focusTimeMap?: Map<string, number>;
}

/** 获取标签的排序键值 */
export function getSortValue(tab: LiveTab, mode: SortMode, ctx: SortContext = {}): number {
  switch (mode) {
    case "recency":
      return tab.lastAccessed ?? 0;

    case "frequency":
      return ctx.visitCountMap?.get(tab.url) ?? 0;

    case "time":
      return ctx.focusTimeMap?.get(tab.url) ?? 0;

    case "manual":
      return 0; // 在排序时特殊处理

    case "domain":
      return 0; // 在排序时特殊处理（字符串比较，不用数值）

    case "title":
      return 0; // 在排序时特殊处理（字符串比较，不用数值）

    case "default":
    default:
      return 0;
  }
}

/** 根据模式排序标签 */
export function sortTabs(
  tabs: LiveTab[],
  mode: SortMode,
  pinnedTabIds: number[],
  ctx: SortContext = {},
): LiveTab[] {
  if (mode === "default") {
    return [...tabs];
  }

  return [...tabs].sort((a, b) => {
    // 手动置顶模式：置顶标签始终在最前面
    if (mode === "manual") {
      const aPinned = pinnedTabIds.includes(a.id);
      const bPinned = pinnedTabIds.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      // 都是置顶或都不是，按最近访问排序
      return (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0);
    }

    // 域名排序：按 hostname 字母序
    if (mode === "domain") {
      return a.hostname.localeCompare(b.hostname);
    }

    // 标题排序：按 title 字母序
    if (mode === "title") {
      return a.title.localeCompare(b.title);
    }

    // 其他模式：直接按对应维度降序
    const valueA = getSortValue(a, mode, ctx);
    const valueB = getSortValue(b, mode, ctx);
    return valueB - valueA;
  });
}

interface UseSmartSortOptions {
  /** 排序模式 */
  mode?: SortMode;
}

interface UseSmartSortReturn {
  /** 排序后的标签列表 */
  sortedTabs: LiveTab[];
  /** 置顶标签 */
  pinTab: (tabId: number) => void;
  /** 取消置顶 */
  unpinTab: (tabId: number) => void;
  /** 切换置顶状态 */
  togglePin: (tabId: number) => void;
  /** 检查是否置顶 */
  isPinned: (tabId: number) => boolean;
}

/**
 * 智能排序 Hook - 明确的排序规则
 *
 * 支持的排序规则：
 * - default: 默认顺序（不排序）
 * - recency: 最近访问优先
 * - frequency: 使用频率优先
 * - time: 停留时长优先
 * - manual: 手动置顶优先
 */
export function useSmartSort(
  tabs: LiveTab[],
  options: UseSmartSortOptions = {},
): UseSmartSortReturn {
  const { mode = "default" } = options;

  const pinnedTabIds = useSmartSortStore((s) => s.pinnedTabIds);
  const addPinnedTab = useSmartSortStore((s) => s.addPinnedTab);
  const removePinnedTab = useSmartSortStore((s) => s.removePinnedTab);
  const togglePinnedTab = useSmartSortStore((s) => s.togglePinnedTab);

  // 置顶/取消置顶
  const pinTab = useCallback(
    (tabId: number) => {
      addPinnedTab(tabId);
    },
    [addPinnedTab],
  );

  const unpinTab = useCallback(
    (tabId: number) => {
      removePinnedTab(tabId);
    },
    [removePinnedTab],
  );

  const togglePin = useCallback(
    (tabId: number) => {
      togglePinnedTab(tabId);
    },
    [togglePinnedTab],
  );

  const isPinned = useCallback(
    (tabId: number) => {
      return pinnedTabIds.includes(tabId);
    },
    [pinnedTabIds],
  );

  // 排序后的标签列表
  const sortedTabs = useMemo(() => {
    return sortTabs(tabs, mode, pinnedTabIds);
  }, [tabs, mode, pinnedTabIds]);

  return {
    sortedTabs,
    pinTab,
    unpinTab,
    togglePin,
    isPinned,
  };
}
