/**
 * CompactView — 虚拟化平铺列表（antd 版）
 *
 * 设计：
 *   - 按 lastAccessed 降序；一屏可见 ≥20 条
 *   - 使用 TabItem 统一渲染行，支持多选、右键菜单等交互
 *   - 使用虚拟滚动，支持 500+ Tab 不掉帧
 *   - 容器高度用 `min(100vh - 240px, tabs * 36)`，短列表不撑开，长列表滚动
 */

import { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Flex } from "antd";
import { cssVars } from "@/shared/utils/css-vars";
import { useTabsStore } from "@/store";
import { TabItem } from "./TabItem";
import { CONFIG } from "@/shared/config";
import styles from "./styles/views.module.less";

const ROW_HEIGHT = CONFIG.ui.rowHeight;
/** 容器最大高度（留给 Header + Hero + pb 的空间） */
const VIEWPORT_RESERVE = CONFIG.ui.viewportReserve;

/**
 * 紧凑视图：虚拟化列表
 */
export function CompactView() {
  const tabs = useTabsStore((s) => s.tabs);
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const closeSingleTab = useTabsStore((s) => s.closeSingleTab);

  const sortedTabs = useMemo(
    () => [...tabs].sort((a, b) => b.lastAccessed - a.lastAccessed),
    [tabs],
  );

  /** 当前视图内所有可见 tab ID 列表（供 Shift 范围选） */
  const visibleTabIds = useMemo(() => sortedTabs.map((t) => t.id), [sortedTabs]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: sortedTabs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  if (sortedTabs.length === 0) return null;

  /** 短列表不撑满视口；长列表按视口高度滚动 */
  const containerMaxHeight = `min(calc(100vh - ${VIEWPORT_RESERVE}px), ${sortedTabs.length * ROW_HEIGHT + 8}px)`;
  const containerStyle: React.CSSProperties = cssVars({
    "--app-compact-max-height": containerMaxHeight,
    "--app-compact-min-height": `${Math.min(sortedTabs.length, 6) * ROW_HEIGHT}px`,
  });
  const spacerStyle = { height: virtualizer.getTotalSize() };

  return (
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
  );
}
