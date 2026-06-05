/**
 * WindowView — 多窗口管理视图
 *
 * 按窗口分组展示标签页，支持：
 *   - 搜索过滤（按标签标题/URL）
 *   - 查看每个窗口的标签数量和焦点状态
 *   - 将标签移动到其他窗口
 *   - 合并所有窗口到一个窗口
 *   - 关闭整个窗口
 *   - 拖拽排序窗口卡片 / 跨窗口拖拽标签
 */

import { useMemo, useState, useCallback } from "react";
import { Empty, Flex, Row, Col } from "antd";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";

import type { LiveTab } from "@/shared/types";
import { moveTabs } from "@/chrome/tabs";
import { groupTabs, ungroupTabs } from "@/chrome/tabGroups";
import { swBroadcast } from "@/shared/utils/sw-broadcast";
import { feedback } from "@/shared/ui/feedback";
import { useTabsStore, useSettingsStore, useMetadataStore } from "@/store";
import { useTabActions } from "@/shared/hooks/use-tab-actions";
import { useT } from "@/shared/i18n";
import { WindowToolbar } from "@/features/tabs/toolbar/WindowToolbar";
import type { WindowSortMode } from "@/features/tabs/toolbar/WindowToolbar";
import { WindowCard } from "./WindowCard";
import { WindowBatchActionBar } from "./WindowBatchActionBar";
import { SortableWindowCard } from "./SortableWindowCard";
import type { WindowDragData, WindowDropData } from "./dragTypes";
import styles from "@/features/tabs/styles/views.module.less";

function normalizeWindowCardOrder(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === "number")
    : [];
}

function groupTabsByWindow(tabs: LiveTab[]): Map<number, LiveTab[]> {
  const map = new Map<number, LiveTab[]>();
  for (const tab of tabs) {
    const list = map.get(tab.windowId) ?? [];
    list.push(tab);
    map.set(tab.windowId, list);
  }
  return map;
}

/** 将强制列数映射为 Ant Design Col 的响应式 span / flex-basis */
function getWindowColProps(
  forcedColumns: number | null,
): { xs: number; lg?: number; xl?: number; style?: React.CSSProperties } {
  if (forcedColumns && forcedColumns >= 1 && forcedColumns <= 6) {
    const pct = `${100 / forcedColumns}%`;
    return { xs: 24, style: { flex: `0 0 ${pct}`, maxWidth: pct } };
  }
  // 默认响应式：1 列 → 2 列 → 3 列
  return { xs: 24, lg: 12, xl: 8 };
}

/**
 * 按搜索关键词过滤标签列表（标题/URL 模糊匹配）。
 * 空关键词返回原始列表。
 */
function filterTabs(tabs: LiveTab[], query: string): LiveTab[] {
  if (!query.trim()) return tabs;
  const q = query.trim().toLowerCase();
  return tabs.filter(
    (tab) =>
      tab.title?.toLowerCase().includes(q) ||
      tab.url?.toLowerCase().includes(q) ||
      tab.hostname?.toLowerCase().includes(q),
  );
}

export function WindowView() {
  const tabs = useTabsStore((s) => s.tabs);
  const windows = useTabsStore((s) => s.windows);
  const currentWindowId = useTabsStore((s) => s.currentWindowId);
  const { jumpToTab, closeSingleTab } = useTabActions();
  const handleJump = useCallback((id: number, wid: number) => { void jumpToTab(id, wid); }, [jumpToTab]);
  const handleClose = useCallback((id: number) => { void closeSingleTab(id); }, [closeSingleTab]);
  const loadAllTabs = useTabsStore((s) => s.loadAllTabs);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  // 订阅原始字段（保持引用稳定，避免 selector 每次返回新数组导致 React 无限重渲染 / error #185）
  const rawWindowCardOrder = useSettingsStore((s) => s.settings.windowCardOrder);
  const rawWindowCardColumns = useSettingsStore((s) => s.settings.windowCardColumns);
  const windowCardOrder = useMemo(
    () => normalizeWindowCardOrder(rawWindowCardOrder),
    [rawWindowCardOrder],
  );
  const forcedColumns = useMemo<number | null>(() => {
    return typeof rawWindowCardColumns === "number" &&
      rawWindowCardColumns >= 1 &&
      rawWindowCardColumns <= 6
      ? rawWindowCardColumns
      : null;
  }, [rawWindowCardColumns]);
  const { t } = useT();

  // ── 搜索过滤 ──────────────────────────────
  const [filterQuery, setFilterQuery] = useState("");
  const [sortMode, setSortMode] = useState<WindowSortMode>("manual");

  const windowGroups = useMemo(() => groupTabsByWindow(tabs), [tabs]);

  // 搜索时过滤每个窗口内的标签，无匹配则不渲染该窗口
  const filteredWindowGroups = useMemo(() => {
    if (!filterQuery.trim()) return windowGroups;
    const result = new Map<number, LiveTab[]>();
    for (const [windowId, windowTabs] of windowGroups) {
      const filtered = filterTabs(windowTabs, filterQuery);
      if (filtered.length > 0) {
        result.set(windowId, filtered);
      }
    }
    return result;
  }, [windowGroups, filterQuery]);

  const visibleTabIds = useMemo(() => tabs.map((tab) => tab.id), [tabs]);

  const sortedWindowIds = useMemo(() => {
    const orderIndex = new Map(windowCardOrder.map((id, index) => [id, index]));

    // 按 sortMode 排序
    const windowIds = [...filteredWindowGroups.keys()];

    if (sortMode === "manual") {
      return windowIds.sort((a, b) => {
        if (a === currentWindowId) return -1;
        if (b === currentWindowId) return 1;

        const aOrder = orderIndex.get(a);
        const bOrder = orderIndex.get(b);
        if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
        if (aOrder !== undefined) return -1;
        if (bOrder !== undefined) return 1;

        const aFocused = windows.get(a)?.focused ?? false;
        const bFocused = windows.get(b)?.focused ?? false;
        if (aFocused && !bFocused) return -1;
        if (!aFocused && bFocused) return 1;

        return a - b;
      });
    }

    if (sortMode === "tabCount") {
      return windowIds.sort((a, b) => {
        const aCount = filteredWindowGroups.get(a)?.length ?? 0;
        const bCount = filteredWindowGroups.get(b)?.length ?? 0;
        return bCount - aCount;
      });
    }

    if (sortMode === "name") {
      return windowIds.sort((a, b) => {
        const aAlias = useMetadataStore.getState().windowAliases[a] ?? "";
        const bAlias = useMetadataStore.getState().windowAliases[b] ?? "";
        const aName = aAlias || String(a);
        const bName = bAlias || String(b);
        return aName.localeCompare(bName);
      });
    }

    if (sortMode === "activity") {
      return windowIds.sort((a, b) => {
        const aTabs = filteredWindowGroups.get(a) ?? [];
        const bTabs = filteredWindowGroups.get(b) ?? [];
        const aLatest = Math.max(...aTabs.map((tab) => tab.lastAccessed), 0);
        const bLatest = Math.max(...bTabs.map((tab) => tab.lastAccessed), 0);
        return bLatest - aLatest;
      });
    }

    return windowIds;
  }, [currentWindowId, windowCardOrder, filteredWindowGroups, windows, sortMode]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const dragData = event.active.data.current as WindowDragData | undefined;
    if (!dragData || !event.over) return;

    if (dragData.kind === "window-card") {
      const activeWindowId = Number(String(event.active.id).replace("window-sort:", ""));
      const overWindowId = Number(String(event.over.id).replace("window-sort:", ""));
      if (
        !Number.isFinite(activeWindowId) ||
        !Number.isFinite(overWindowId) ||
        activeWindowId === overWindowId
      )
        return;
      const oldIndex = sortedWindowIds.indexOf(activeWindowId);
      const newIndex = sortedWindowIds.indexOf(overWindowId);
      if (oldIndex === -1 || newIndex === -1) return;
      const nextOrder = arrayMove(sortedWindowIds, oldIndex, newIndex);
      await updateSettings({ windowCardOrder: nextOrder });
      swBroadcast("window-card-order-changed", { windowCardOrder: nextOrder });
      return;
    }

    const dropData = event.over.data.current as WindowDropData | undefined;
    if (!dropData || dragData.kind !== "tab") return;

    const { tab } = dragData;
    if (tab.incognito !== dropData.incognito) {
      feedback.warning(t("无痕标签页不能拖入普通窗口"));
      return;
    }

    try {
      if (dropData.kind === "group") {
        if (tab.windowId !== dropData.windowId) {
          await moveTabs([tab.id], dropData.windowId, -1);
        }
        await groupTabs({ tabIds: tab.id, groupId: dropData.groupId });
        swBroadcast("tab-grouped", {
          id: tab.id,
          windowId: dropData.windowId,
          groupId: dropData.groupId,
        });
        void loadAllTabs({ silent: true });
        return;
      }

      if (dropData.kind === "ungrouped") {
        if (tab.windowId !== dropData.windowId) {
          await moveTabs([tab.id], dropData.windowId, -1);
        }
        if (tab.groupId !== -1) {
          await ungroupTabs(tab.id);
          swBroadcast("tab-ungrouped", {
            id: tab.id,
            windowId: dropData.windowId,
            previousGroupId: tab.groupId,
          });
        } else {
          swBroadcast("tab-moved", { id: tab.id, windowId: dropData.windowId });
        }
        void loadAllTabs({ silent: true });
        return;
      }

      if (dropData.kind === "window" && tab.windowId !== dropData.windowId) {
        await moveTabs([tab.id], dropData.windowId, -1);
        swBroadcast("tab-moved", { id: tab.id, windowId: dropData.windowId });
        void loadAllTabs({ silent: true });
      }
    } catch (err) {
      feedback.error(t("标签页移动失败"), err);
      void loadAllTabs({ silent: true });
    }
  };

  if (tabs.length === 0) {
    return <Empty description={t("没有打开的标签页")} className={styles["app-window-empty"]} />;
  }

  return (
    <Flex vertical gap="middle">
      <WindowToolbar
        filterQuery={filterQuery}
        onFilterChange={setFilterQuery}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
      />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={(event) => {
          void handleDragEnd(event);
        }}
      >
        <SortableContext
          items={sortedWindowIds.map((id) => `window-sort:${id}`)}
          strategy={rectSortingStrategy}
        >
          <Row gutter={[16, 16]}>
            {sortedWindowIds.map((windowId) => {
              const windowTabs = filteredWindowGroups.get(windowId) ?? [];
              return (
                <Col key={windowId} {...getWindowColProps(forcedColumns)}>
                  <SortableWindowCard windowId={windowId}>
                    <WindowCard
                      key={windowId}
                      windowId={windowId}
                      tabs={windowTabs}
                      windowInfo={windows.get(windowId)}
                      currentWindowId={currentWindowId}
                      visibleTabIds={visibleTabIds}
                      onJump={handleJump}
                      onCloseTab={handleClose}
                      onRefresh={() => {
                        void loadAllTabs({ silent: true });
                      }}
                    />
                  </SortableWindowCard>
                </Col>
              );
            })}
          </Row>
        </SortableContext>
      </DndContext>
      <WindowBatchActionBar />
    </Flex>
  );
}
