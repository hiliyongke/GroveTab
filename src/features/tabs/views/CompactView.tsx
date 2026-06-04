/**
 * CompactView — 虚拟化平铺列表（antd 版）
 *
 * 设计：
 *   - 支持 6 种排序规则（默认/最近访问/使用频率/停留时长/手动置顶/按域名）
 *   - 双向同步：排序后立即更新 store UI + 后台异步同步到浏览器标签栏
 *   - frequency/time 排序从 chrome.history 和 FocusTimeData 读取真实数据
 *   - 切回默认时恢复原始顺序（浏览器 + store）
 *   - 使用虚拟滚动，支持 500+ Tab 不掉帧
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Flex, Empty, Segmented, Tooltip } from "antd";
import { Clock, TrendingUp, Timer, ArrowUpDown, Globe, Type } from "lucide-react";
import { cssVars } from "@/shared/utils/css-vars";
import { useTabsStore, useSmartSortStore } from "@/store";
import { useT } from "@/shared/i18n";
import { TabItem } from "../components/TabItem";
import { CONFIG } from "@/shared/config";
import { moveTabs } from "@/chrome/tabs";
import { sortTabs, type SortContext } from "@/features/smart-sort/hooks/useSmartSort";
import type { SortMode } from "@/features/smart-sort/types";
import type { LiveTab } from "@/shared/types";
import { getFocusTime } from "@/repositories/focus-time-repo";
import { todayStr } from "@/shared/utils/date";
import styles from "../styles/views.module.less";
import toolbarStyles from "../styles/toolbar.module.less";

const ROW_HEIGHT = CONFIG.ui.rowHeight;
/** 容器最大高度（留给 Header + Hero + pb 的空间） */
const VIEWPORT_RESERVE = CONFIG.ui.viewportReserve;

/** 30 天的时间范围（ms） */
const HISTORY_RANGE_MS = 30 * 24 * 3600 * 1000;

interface CompactViewProps {
  filterQuery?: string;
}

/** 排序规则定义 */
const SORT_RULES: Array<{ value: SortMode; label: string; icon: React.ReactNode }> = [
  { value: "default", label: "默认", icon: <ArrowUpDown size={13} /> },
  { value: "recency", label: "最近访问", icon: <Clock size={13} /> },
  { value: "frequency", label: "使用频率", icon: <TrendingUp size={13} /> },
  { value: "time", label: "停留时长", icon: <Timer size={13} /> },
  { value: "domain", label: "按域名", icon: <Globe size={13} /> },
  { value: "title", label: "按标题", icon: <Type size={13} /> },
];

/** 从 chrome.history 批量获取 URL → visitCount 映射 */
async function buildVisitCountMap(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const items = await chrome.history.search({
      text: "",
      maxResults: 5000,
      startTime: Date.now() - HISTORY_RANGE_MS,
    });
    for (const item of items) {
      if (item.url && item.visitCount) {
        map.set(item.url, item.visitCount);
      }
    }
  } catch {
    // history API 不可用时静默降级
  }
  return map;
}

/** 从 FocusTimeData 获取 URL → 今日使用时长映射 */
async function buildFocusTimeMap(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const data = await getFocusTime();
    if (data) {
      const today = todayStr();
      const dayRecord = data.daily.find((r) => r.day === today);
      if (dayRecord) {
        for (const [url, ms] of Object.entries(dayRecord.byUrl)) {
          map.set(url, ms);
        }
      }
    }
  } catch {
    // focus time 数据不可用时静默降级
  }
  return map;
}

/**
 * 将排序后的标签顺序同步到浏览器标签栏
 */
async function syncSortToBrowser(sortedTabs: LiveTab[]): Promise<void> {
  const currentWindow = await chrome.windows.getCurrent();
  const windowId = currentWindow.id;
  if (!windowId) return;

  const windowTabIds = sortedTabs.filter((t) => t.windowId === windowId).map((t) => t.id);

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
async function restoreBrowserOrder(originalTabIds: number[]): Promise<void> {
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

/**
 * 紧凑视图：虚拟化列表 + 排序功能 + 双向同步
 */
export function CompactView({ filterQuery = "" }: CompactViewProps) {
  const { t } = useT();
  const tabs = useTabsStore((s) => s.tabs);
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const closeSingleTab = useTabsStore((s) => s.closeSingleTab);

  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [isSyncing, setIsSyncing] = useState(false);

  // 保存原始标签 ID 顺序（首次排序前快照，切回 default 时恢复）
  const originalTabIdsRef = useRef<number[] | null>(null);

  // 获取置顶标签 ID 列表
  const pinnedTabIds = useSmartSortStore((s) => s.pinnedTabIds);

  // 排序上下文：frequency/time 排序需要的外部数据
  const [sortCtx, setSortCtx] = useState<SortContext>({});

  // 组件挂载时加载排序上下文数据（visitCount / focusTime）
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [visitCountMap, focusTimeMap] = await Promise.all([
        buildVisitCountMap(),
        buildFocusTimeMap(),
      ]);
      if (!cancelled) {
        setSortCtx({ visitCountMap, focusTimeMap });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 排序后的标签（UI 展示用）
  const sortedTabs = useMemo(() => {
    // 先过滤
    const query = filterQuery.trim().toLowerCase();
    const filtered = query
      ? tabs.filter(
          (tab) => tab.title.toLowerCase().includes(query) || tab.url.toLowerCase().includes(query),
        )
      : tabs;

    // default 模式直接返回过滤后的列表（保持浏览器原始顺序）
    if (sortMode === "default") return [...filtered];

    // 其他模式按规则排序
    return sortTabs(filtered, sortMode, pinnedTabIds, sortCtx);
  }, [tabs, filterQuery, sortMode, pinnedTabIds, sortCtx]);

  /** 当前视图内所有可见 tab ID 列表（供 Shift 范围选） */
  const visibleTabIds = useMemo(() => sortedTabs.map((tab) => tab.id), [sortedTabs]);

  /** 排序切换 */
  const handleSortChange = useCallback(
    async (value: string | number) => {
      const newMode = value as SortMode;
      setSortMode(newMode);

      if (newMode !== "default") {
        // 首次排序前保存原始顺序
        if (!originalTabIdsRef.current) {
          originalTabIdsRef.current = tabs.map((t) => t.id);
        }

        // 用完整列表排序
        const sorted = sortTabs(tabs, newMode, pinnedTabIds, sortCtx);

        // 立即更新 store 中的 tabs 顺序（UI 马上生效）
        useTabsStore.setState({ tabs: sorted });

        // 后台异步同步到浏览器
        setIsSyncing(true);
        try {
          await syncSortToBrowser(sorted);
        } catch (err) {
          console.error("[CompactView] Sort sync failed:", err);
        } finally {
          setIsSyncing(false);
        }
      } else if (originalTabIdsRef.current) {
        // 切回默认：恢复 store 中的原始顺序
        const originalIds = originalTabIdsRef.current;
        const idToTab = new Map(tabs.map((t) => [t.id, t]));
        const restored = originalIds
          .map((id) => idToTab.get(id))
          .filter((t): t is LiveTab => t !== undefined);

        useTabsStore.setState({ tabs: restored });
        originalTabIdsRef.current = null;

        // 后台异步恢复浏览器顺序
        setIsSyncing(true);
        try {
          await restoreBrowserOrder(originalIds);
        } catch (err) {
          console.error("[CompactView] Restore order failed:", err);
        } finally {
          setIsSyncing(false);
        }
      }
    },
    [tabs, pinnedTabIds, sortCtx],
  );

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: sortedTabs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  if (tabs.length === 0) return null;

  const containerMaxHeight = `min(calc(100vh - ${VIEWPORT_RESERVE}px), ${sortedTabs.length * ROW_HEIGHT + 8}px)`;
  const containerStyle: React.CSSProperties = cssVars({
    "--app-compact-max-height": containerMaxHeight,
    "--app-compact-min-height": `${Math.min(sortedTabs.length, 6) * ROW_HEIGHT}px`,
  });
  const spacerStyle = { height: virtualizer.getTotalSize() };

  if (sortedTabs.length === 0) {
    return <Empty description={t("search.noDomainResults")} />;
  }

  return (
    <Flex vertical gap="small">
      {/* 排序工具栏 */}
      <Flex align="center" gap="small" className={toolbarStyles["compact-toolbar"]}>
        <span className={toolbarStyles["compact-toolbar-label"]}>排序：</span>
        <Segmented<string>
          size="small"
          value={sortMode}
          onChange={(value) => {
            void handleSortChange(value);
          }}
          options={SORT_RULES.map((rule) => ({
            value: rule.value,
            label: (
              <Tooltip title={getSortTooltip(rule.value)} placement="top">
                <Flex gap={4} align="center" justify="center">
                  {rule.icon}
                  <span>{rule.label}</span>
                </Flex>
              </Tooltip>
            ),
          }))}
          disabled={isSyncing}
        />
        {isSyncing && <span className={toolbarStyles["compact-toolbar-syncing"]}>同步中...</span>}
      </Flex>

      {/* 标签列表 */}
      <Flex ref={parentRef} vertical className={styles["app-compact-view"]} style={containerStyle}>
        <Flex className={styles["app-compact-view-spacer"]} style={spacerStyle}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const tab = sortedTabs[virtualRow.index];
            if (!tab) return null;
            const itemStyle: React.CSSProperties = {
              height: ROW_HEIGHT,
              transform: `translateY(${virtualRow.start}px)`,
            };

            return (
              <Flex key={tab.id} className={styles["app-compact-view-item"]} style={itemStyle}>
                <TabItem
                  tab={tab}
                  onJump={(id, wid) => {
                    void jumpToTab(id, wid);
                  }}
                  onClose={(id) => {
                    void closeSingleTab(id);
                  }}
                  showHostname
                  selectable
                  visibleTabIds={visibleTabIds}
                />
              </Flex>
            );
          })}
        </Flex>
      </Flex>
    </Flex>
  );
}

/** 获取排序规则的提示文本 */
function getSortTooltip(mode: SortMode): string {
  switch (mode) {
    case "default":
      return "按标签原始顺序排列";
    case "recency":
      return "最近访问的标签排在前面";
    case "frequency":
      return "30 天内访问次数多的标签排在前面";
    case "time":
      return "今日使用时长长的标签排在前面";
    case "domain":
      return "按域名（字母序）排列，同一域名的标签相邻";
    case "title":
      return "按标题（字母序）排列";
    case "manual":
      return "手动置顶的标签排在最前面";
    default:
      return "";
  }
}
