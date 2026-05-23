/**
 * CompactView — 虚拟化平铺列表（antd 版）
 *
 * 设计：
 *   - 按 lastAccessed 降序；一屏可见 ≥20 条
 *   - 使用 TabItem 统一渲染行，支持多选、右键菜单等交互
 *   - 使用虚拟滚动，支持 500+ Tab 不掉帧
 *   - 容器高度用 `min(100vh - 240px, tabs * 36)`，短列表不撑开，长列表滚动
 */

import { useMemo, useRef, useCallback, memo, type CSSProperties } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTabsStore } from "@/store";
import { TabItem } from "./TabItem";
import { CONFIG } from "@/shared/config";
import styles from "./CompactView.module.less";

const ROW_HEIGHT = CONFIG.ui.rowHeight;
/** 容器最大高度（留给 Header + Hero + pb 的空间） */
const VIEWPORT_RESERVE = CONFIG.ui.viewportReserve;

/**
 * 紧凑视图：虚拟化列表
 *
 * 设计：
 *   - 按 lastAccessed 降序；一屏可见 ≥20 条
 *   - 使用 TabItem 统一渲染行，支持多选、右键菜单等交互
 *   - 使用虚拟滚动，支持 500+ Tab 不掉帧
 *   - 容器高度用 `min(100vh - 240px, tabs * 36)`，短列表不撑开，长列表滚动
 *
 * @returns 紧凑视图 JSX 元素
 */
const CompactView = memo(function CompactView() {
  const tabs = useTabsStore((s) => s.tabs);
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const closeSingleTab = useTabsStore((s) => s.closeSingleTab);

  /** 稳定跳转回调 —— 避免内联函数导致子组件重渲染 */
  const handleJump = useCallback(
    (id: number, wid: number) => {
      void jumpToTab(id, wid);
    },
    [jumpToTab],
  );

  /** 稳定关闭回调 —— 避免内联函数导致子组件重渲染 */
  const handleClose = useCallback(
    (id: number) => {
      void closeSingleTab(id);
    },
    [closeSingleTab],
  );

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

  // 缓存容器样式，避免每次渲染创建新对象
  const containerStyle = useMemo<CSSProperties>(
    () => ({
      maxHeight: containerMaxHeight,
      minHeight: Math.min(sortedTabs.length, 6) * ROW_HEIGHT,
    }),
    [containerMaxHeight, sortedTabs.length],
  );

  // 虚拟化必需的动态高度（无法通过 CSS 实现）
  const spacerHeight = virtualizer.getTotalSize();

  return (
    <div ref={parentRef} className={styles["app-compact-view"]} style={containerStyle}>
      {/* 虚拟化 Spacer：高度必须动态计算，无法使用 CSS Modules */}
      <div className={styles["app-compact-view-spacer"]} style={{ height: spacerHeight } as CSSProperties}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const tab = sortedTabs[virtualRow.index];
          if (!tab) return null;

          // 虚拟化定位：每个 item 需要绝对定位和动态 Y 偏移
          // 这是 @tanstack/react-virtual 的标准用法，无法通过 CSS 实现
          const itemStyle: CSSProperties = {
            height: ROW_HEIGHT,
            transform: `translateY(${virtualRow.start}px)`,
          };

          return (
            <div key={tab.id} className={styles["app-compact-view-item"]} style={itemStyle}>
              <TabItem
                tab={tab}
                onJump={handleJump}
                onClose={handleClose}
                showHostname
                selectable
                visibleTabIds={visibleTabIds}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default CompactView;
