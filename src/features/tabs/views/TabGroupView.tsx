/**
 * TabGroupView — Chrome 原生 Tab Group 视图（重构版）
 *
 * 一级按 Chrome 原生 Tab Group 分组，未分组标签归入"未分组"卡片。
 * 对标 DomainGroupView 的成熟度：
 *   - GroupCardShell 卡片 + masonry 多列布局
 *   - 搜索过滤（组名 + 标签标题/URL）
 *   - 排序（名称/数量/最近访问）
 *   - 虚拟滚动（分组 > 20 时启用）
 *   - Toolbar（搜索 + 排序 + 折叠开关）
 *
 * 拖拽支持：
 *   - 基于 @dnd-kit/core 实现标签跨分组拖放
 *   - 支持拖到其他标签组、解分组、跨窗口移动
 *   - 与浏览器实时同步
 */

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Empty, Flex } from "antd";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  closestCorners,
} from "@dnd-kit/core";
import { useTabsStore, useSettingsStore } from "@/store";
import { useTabActions } from "@/shared/hooks/use-tab-actions";
import type { ChromeTabGroupColor } from "@/chrome";
import { getColumnVars } from "@/shared/utils/flow-columns";
import { useT } from "@/shared/i18n";
import { TabGroupCard, type TabGroupData } from "../components/TabGroupCard";
import { DraggableTabItem } from "../components/DraggableTabItem";
import { DroppableGroupCard, type TabGroupDropData } from "../components/DroppableGroupCard";
import { TabGroupToolbar } from "../toolbar/TabGroupToolbar";
import { moveTabs } from "@/chrome/tabs";
import { groupTabs, ungroupTabs } from "@/chrome/tabGroups";
import { swBroadcast } from "@/shared/utils/sw-broadcast";
import { feedback } from "@/shared/ui/feedback";
import styles from "../styles/items.module.less";

const DOMAIN_COLUMN_MIN_WIDTH = 320;
const DOMAIN_COLUMN_GAP = 16;
const DOMAIN_COLUMN_MAX_AUTO = 8;
const VIRTUALIZATION_THRESHOLD = 20;

function getAutoColumnCount(containerWidth: number, groupCount: number): number {
  if (groupCount <= 0 || containerWidth <= 0) return 1;
  const fitCount = Math.floor(
    (containerWidth + DOMAIN_COLUMN_GAP) / (DOMAIN_COLUMN_MIN_WIDTH + DOMAIN_COLUMN_GAP),
  );
  return Math.min(groupCount, Math.max(1, fitCount), DOMAIN_COLUMN_MAX_AUTO);
}

/** 按 Chrome 原生 Tab Group 分组 */
function groupTabsByChromeGroup(
  tabs: typeof useTabsStore extends { getState: () => { tabs: infer T } } ? T : never,
  t: (key: string) => string,
): TabGroupData[] {
  const map = new Map<number, TabGroupData>();

  for (const tab of tabs) {
    const gid = tab.groupId ?? -1;
    if (!map.has(gid)) {
      // 同一个 groupId 可能跨窗口，拆分为独立的 key
      const groupKey = gid === -1 ? -1 : gid;
      map.set(groupKey, {
        groupId: gid,
        title: gid === -1 ? t("tabGroup.ungrouped") : (tab.groupTitle ?? t("tabGroup.unnamed")),
        color: (gid === -1 ? "grey" : (tab.groupColor ?? "grey")) as ChromeTabGroupColor,
        // 明确处理 undefined → false，避免 undefined 导致 React 渲染异常
        collapsed: gid === -1 ? false : tab.groupCollapsed === true,
        windowId: tab.windowId,
        tabs: [],
      });
    }
    map.get(gid)!.tabs.push(tab);
  }

  // 未分组排最后
  const result = Array.from(map.values());
  const ungrouped = result.find((g) => g.groupId === -1);
  const grouped = result.filter((g) => g.groupId !== -1);
  return [...grouped, ...(ungrouped ? [ungrouped] : [])];
}

function splitIntoFlowColumns(groups: TabGroupData[], columnCount: number): TabGroupData[][] {
  const safeColumnCount = Math.max(1, columnCount);
  const columns = Array.from({ length: safeColumnCount }, () => [] as TabGroupData[]);
  const columnHeights = Array.from({ length: safeColumnCount }, () => 0);

  groups.forEach((group) => {
    let targetColumnIndex = 0;
    for (let index = 1; index < columnHeights.length; index += 1) {
      if (columnHeights[index]! < columnHeights[targetColumnIndex]!) {
        targetColumnIndex = index;
      }
    }
    columns[targetColumnIndex]!.push(group);
    columnHeights[targetColumnIndex]! += group.tabs.length + 1;
  });

  return columns;
}

/** 估算单个 TabGroupCard 的高度（展开状态） */
function estimateGroupHeight(group: TabGroupData): number {
  return 56 + group.tabs.length * 44 + 16;
}

/** 虚拟化列组件 */
interface VirtualColumnProps {
  groups: TabGroupData[];
  useVirtual: boolean;
  visibleTabIds: number[];
  onJump: (tabId: number, windowId: number) => void;
  onClose: (tabId: number) => void;
}

function VirtualColumn({
  groups,
  useVirtual,
  visibleTabIds,
  onJump,
  onClose,
}: VirtualColumnProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: groups.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => estimateGroupHeight(groups[index]!),
    overscan: 3,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  const virtualItems = virtualizer.getVirtualItems();

  const renderGroupCard = (group: TabGroupData) => (
    <DroppableGroupCard
      id={`tab-group:${group.groupId}`}
      data={
        {
          kind: "tab-group",
          groupId: group.groupId,
          windowId: group.windowId,
        } satisfies TabGroupDropData
      }
      className={styles["app-domain-masonry-item"]}
    >
      <TabGroupCard
        group={group}
        renderTabItem={(tab) => (
          <DraggableTabItem
            key={tab.id}
            tab={tab}
            visibleTabIds={visibleTabIds}
            onJump={onJump}
            onClose={onClose}
            showHostname
            selectable
          />
        )}
      />
    </DroppableGroupCard>
  );

  if (!useVirtual) {
    return (
      <div className={styles["app-domain-masonry-column"]}>
        {groups.map((group) => (
          <div key={`${group.groupId}-${group.windowId}`}>{renderGroupCard(group)}</div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={`${styles["app-domain-masonry-column"]} ${styles["domain-group-scroll-area"]}`}
    >
      <div
        className={styles["domain-group-virtual-container"]}
        style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        {virtualItems.map((virtualItem) => {
          const group = groups[virtualItem.index]!;
          return (
            <div
              key={`${group.groupId}-${group.windowId}`}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              className={`${styles["app-domain-masonry-item"]} ${styles["domain-group-virtual-item"]}`}
              style={{
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderGroupCard(group)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Chrome Tab Group 视图
 */
export function TabGroupView() {
  const { t } = useT();
  const tabs = useTabsStore((s) => s.tabs);
  const { jumpToTab, closeSingleTab } = useTabActions();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [filterQuery, setFilterQuery] = useState("");

  const forcedColumns = useSettingsStore((s) => {
    const v = s.settings.domainGroupColumns;
    return typeof v === "number" && v >= 1 && v <= 6 ? v : null;
  });
  const sortBy = useSettingsStore((s) => s.settings.tabGroupSortBy ?? "tabCount");
  const loadAllTabs = useTabsStore((s) => s.loadAllTabs);

  // 按 Chrome 原生 Tab Group 分组
  const groups = useMemo(() => groupTabsByChromeGroup(tabs, t), [tabs, t]);

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node || forcedColumns !== null) return;

    const updateWidth = () => {
      setContainerWidth(node.clientWidth);
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const width = entry?.contentRect.width ?? node.clientWidth;
      setContainerWidth(width);
    });
    observer.observe(node);

    return () => observer.disconnect();
  }, [forcedColumns, groups.length]);

  // 排序
  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => {
      // 未分组始终排最后
      if (a.groupId === -1) return 1;
      if (b.groupId === -1) return -1;

      switch (sortBy) {
        case "name":
          return a.title.localeCompare(b.title);
        case "recentAccess": {
          const aMax = Math.max(...a.tabs.map((tab) => tab.lastAccessed || 0));
          const bMax = Math.max(...b.tabs.map((tab) => tab.lastAccessed || 0));
          return bMax - aMax;
        }
        case "tabCount":
        default:
          return b.tabs.length - a.tabs.length;
      }
    });
  }, [groups, sortBy]);

  // 搜索过滤（组名 + 标签标题/URL）
  const filteredGroups = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    if (!query) return sortedGroups;
    return sortedGroups.filter((group) => {
      if (group.title.toLowerCase().includes(query)) return true;
      return group.tabs.some(
        (tab) => tab.title.toLowerCase().includes(query) || tab.url.toLowerCase().includes(query),
      );
    });
  }, [sortedGroups, filterQuery]);

  const columnCount = forcedColumns ?? getAutoColumnCount(containerWidth, filteredGroups.length);
  const columns = splitIntoFlowColumns(filteredGroups, columnCount);
  const useVirtualization = filteredGroups.length > VIRTUALIZATION_THRESHOLD;

  const visibleTabIds = useMemo(() => tabs.map((tab) => tab.id), [tabs]);

  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  // 处理拖放结束
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const dragId = String(active.id);
    const dropId = String(over.id);

    // 只处理标签拖放
    if (!dragId.startsWith("tab:")) return;

    const tabId = Number(dragId.replace("tab:", ""));
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    // 解析放置目标
    if (!dropId.startsWith("tab-group:")) return;

    const targetGroupId = Number(dropId.replace("tab-group:", ""));

    // 如果已经在同一分组，不需要操作
    if (tab.groupId === targetGroupId) return;

    try {
      // 找到目标分组的窗口 ID
      const targetGroup = groups.find((g) => g.groupId === targetGroupId);
      const targetWindowId = targetGroup?.windowId ?? tab.windowId;

      if (targetGroupId === -1) {
        // 拖到未分组 - 解分组
        if (tab.groupId !== -1) {
          await ungroupTabs(tabId);
          // 如果需要跨窗口移动
          if (tab.windowId !== targetWindowId) {
            await moveTabs([tabId], targetWindowId, -1);
          }
          swBroadcast("tab-ungrouped", {
            id: tabId,
            windowId: targetWindowId,
            previousGroupId: tab.groupId,
          });
          feedback.success(t("标签已移出分组"));
        }
      } else {
        // 拖到其他分组 - 移动并分组
        if (tab.windowId !== targetWindowId) {
          await moveTabs([tabId], targetWindowId, -1);
        }
        await groupTabs({ tabIds: tabId, groupId: targetGroupId });
        swBroadcast("tab-grouped", {
          id: tabId,
          windowId: targetWindowId,
          groupId: targetGroupId,
        });
        feedback.success(t("标签已移动到分组"));
      }

      void loadAllTabs({ silent: true });
    } catch (err) {
      feedback.error(t("标签移动失败"), err);
      void loadAllTabs({ silent: true });
    }
  };

  if (tabs.length === 0) {
    return <Empty description={t("没有打开的标签页")} className={styles["app-tab-group-empty"]} />;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={(event) => {
        void handleDragEnd(event);
      }}
    >
      <Flex vertical gap="middle">
        <TabGroupToolbar
          filterQuery={filterQuery}
          onFilterChange={setFilterQuery}
        />
        {sortedGroups.length === 0 ? null : (
          <div
            ref={containerRef}
            className={styles["app-domain-masonry"]}
            style={getColumnVars(columnCount)}
          >
            {filteredGroups.length === 0 ? (
              <Empty description={t("tabGroup.noResults")} />
            ) : (
              columns.map((columnGroups, columnIndex) => (
                <VirtualColumn
                  key={columnIndex}
                  groups={columnGroups}
                  useVirtual={useVirtualization}
                  visibleTabIds={visibleTabIds}
                  onJump={(tabId, windowId) => void jumpToTab(tabId, windowId)}
                  onClose={(tabId) => void closeSingleTab(tabId)}
                />
              ))
            )}
          </div>
        )}
      </Flex>
    </DndContext>
  );
}
