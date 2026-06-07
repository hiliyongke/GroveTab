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
import { Flex, Empty, Segmented, Tooltip, Typography } from "antd";
import { Clock, TrendingUp, Timer, ArrowUpDown, Globe, Type } from "lucide-react";
import { cssVars } from "@/shared/utils/css-vars";
import { useTabsStore, useSmartSortStore } from "@/store";
import { useTabActions } from "@/shared/hooks/use-tab-actions";
import { useT } from "@/shared/i18n";
import { TabItem } from "../components/TabItem";
import { CONFIG } from "@/shared/config";
import { syncSortToBrowser, restoreBrowserOrder } from "@/shared/utils/tab-sort-sync";
import { sortTabs, type SortContext } from "@/features/smart-sort/hooks/useSmartSort";
import type { SortMode } from "@/features/smart-sort/types";
import type { LiveTab } from "@/shared/types";
import { getFocusTime } from "@/repositories/focus-time-repo";
import { todayStr } from "@/shared/utils/date";
import { feedback } from "@/shared/ui/feedback";
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
 * 紧凑视图：虚拟化列表 + 排序功能 + 双向同步
 */
export function CompactView({ filterQuery = "" }: CompactViewProps) {
  const { t } = useT();
  const tabs = useTabsStore((s) => s.tabs);
  const { jumpToTab, closeSingleTab } = useTabActions();

  const sortRules = useMemo(
    () => [
      { value: "default" as const,   label: t("默认"),     icon: <ArrowUpDown size={13} /> },
      { value: "recency" as const,   label: t("最近访问"),  icon: <Clock size={13} /> },
      { value: "frequency" as const, label: t("使用频率"),  icon: <TrendingUp size={13} /> },
      { value: "time" as const,      label: t("停留时长"),  icon: <Timer size={13} /> },
      { value: "domain" as const,    label: t("按域名"),     icon: <Globe size={13} /> },
      { value: "title" as const,     label: t("按标题"),     icon: <Type size={13} /> },
    ],
    [t],
  );
  const tooltips: Record<SortMode, string> = useMemo(
    () => ({
      default:   t("按标签原始顺序排列"),
      recency:   t("最近访问的标签排在前面"),
      frequency: t("30 天内访问次数多的标签排在前面"),
      time:      t("今日使用时长长的标签排在前面"),
      domain:    t("按域名（字母序）排列，同一域名的标签相邻"),
      title:     t("按标题（字母序）排列"),
      manual:    t("手动置顶的标签排在最前面"),
    }),
    [t],
  );

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

  /** 稳定回调，避免每次渲染创建新函数破坏 TabItem 的 memo */
  const handleJumpStable = useCallback((id: number, wid: number) => { void jumpToTab(id, wid); }, [jumpToTab]);
  const handleCloseStable = useCallback((id: number) => { void closeSingleTab(id); }, [closeSingleTab]);

  /** 排序切换 */
  const handleSortChange = useCallback(
    async (value: string | number) => {
      const newMode = value as SortMode;
      setSortMode(newMode);

      if (newMode !== "default") {
        if (!originalTabIdsRef.current) {
          originalTabIdsRef.current = tabs.map((t) => t.id);
        }

        const sorted = sortTabs(tabs, newMode, pinnedTabIds, sortCtx);
        // 延迟写入 store，避免阻塞当前渲染
        requestAnimationFrame(() => {
          useTabsStore.setState({ tabs: sorted });
        });

        setIsSyncing(true);
        try {
          await syncSortToBrowser(sorted);
        } catch (err) {
          console.error("[CompactView] Sort sync failed:", err);
          feedback.error(t("sortSyncFailed"));
        } finally {
          setIsSyncing(false);
        }
      } else if (originalTabIdsRef.current) {
        const originalIds = originalTabIdsRef.current;
        const idToTab = new Map(tabs.map((t) => [t.id, t]));
        const restored = originalIds
          .map((id) => idToTab.get(id))
          .filter((t): t is LiveTab => t !== undefined);

        requestAnimationFrame(() => {
          useTabsStore.setState({ tabs: restored });
        });
        originalTabIdsRef.current = null;

        setIsSyncing(true);
        try {
          await restoreBrowserOrder(originalIds);
        } catch (err) {
          console.error("[CompactView] Restore order failed:", err);
          feedback.error(t("restoreOrderFailed"));
        } finally {
          setIsSyncing(false);
        }
      }
    },
    [tabs, pinnedTabIds, sortCtx, jumpToTab, closeSingleTab],
  );

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: sortedTabs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  if (tabs.length === 0) return <Empty description={t("暂无打开的标签页")} />;

  const containerMaxHeight = `min(calc(100vh - ${VIEWPORT_RESERVE}px), ${sortedTabs.length * ROW_HEIGHT + 8}px)`;
  const containerStyle: React.CSSProperties = cssVars({
    "--app-compact-max-height": containerMaxHeight,
    "--app-compact-min-height": `${Math.min(sortedTabs.length, 6) * ROW_HEIGHT}px`,
  });
  const spacerStyle = { height: virtualizer.getTotalSize() };

  if (sortedTabs.length === 0) {
    return <Empty description={t("未找到匹配的域名")} />;
  }

  return (
    <Flex vertical gap="small">
      {/* 排序工具栏 */}
      <Flex align="center" gap="small" className={toolbarStyles["compact-toolbar"]}>
        <span className={toolbarStyles["compact-toolbar-label"]}>{t("排序：")}</span>
        <Segmented<string>
          size="small"
          value={sortMode}
          onChange={(value) => {
            void handleSortChange(value);
          }}
          options={sortRules.map((rule) => ({
            value: rule.value,
            label: (
              <Tooltip title={tooltips[rule.value]} placement="top">
                <Flex gap={4} align="center" justify="center">
                  {rule.icon}
                  <Typography.Text>{rule.label}</Typography.Text>
                </Flex>
              </Tooltip>
            ),
          }))}
          disabled={isSyncing}
        />
        {isSyncing && <span className={toolbarStyles["compact-toolbar-syncing"]}>{t("同步中...")}</span>}
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
                  onJump={handleJumpStable}
                  onClose={handleCloseStable}
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


