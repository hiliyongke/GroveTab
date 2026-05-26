/**
 * WindowView — 多窗口管理视图
 *
 * 按窗口分组展示标签页，支持：
 *   - 查看每个窗口的标签数量和焦点状态
 *   - 将标签移动到其他窗口
 *   - 合并所有窗口到一个窗口
 *   - 关闭整个窗口
 *
 * 设计：
 *   - 使用 antd Card 展示每个窗口
 *   - 当前窗口高亮显示
 *   - 标签列表可展开/折叠
 */

import { useMemo } from "react";
import { Empty } from "antd";
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
import { cssVars } from "@/shared/utils/css-vars";
import { moveTabs } from "@/chrome/tabs";
import { groupTabs, ungroupTabs } from "@/chrome/tabGroups";
import { swBroadcast } from "@/shared/utils/sw-broadcast";
import { feedback } from "@/shared/ui/feedback";
import { useTabsStore, useSettingsStore } from "@/store";
import { useT } from "@/shared/i18n";
import { WindowCard } from "./WindowView/WindowCard";
import { SortableWindowCard } from "./WindowView/SortableWindowCard";
import type { WindowDragData, WindowDropData } from "./WindowView/dragTypes";
import styles from "./styles/views.module.less";

type WindowCardDefaultCollapsed = "current-only" | "all-expanded" | "all-collapsed";

function normalizeWindowCardOrder(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === "number")
    : [];
}

function normalizeDefaultCollapsed(value: unknown): WindowCardDefaultCollapsed {
  return value === "all-expanded" || value === "all-collapsed" || value === "current-only"
    ? value
    : "current-only";
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

function getColumnVars(forcedColumns: number | null): React.CSSProperties {
  if (forcedColumns && forcedColumns >= 1 && forcedColumns <= 6) {
    return cssVars({ "--app-window-grid-template": `repeat(${forcedColumns}, minmax(0, 1fr))` });
  }

  return cssVars({ "--app-window-card-min-width": "360px" });
}

function shouldCollapseWindow(
  strategy: "current-only" | "all-expanded" | "all-collapsed",
  windowId: number,
  currentWindowId: number,
): boolean {
  switch (strategy) {
    case "all-expanded":
      return false;
    case "all-collapsed":
      return true;
    case "current-only":
    default:
      return windowId !== currentWindowId;
  }
}

export function WindowView() {
  const tabs = useTabsStore((s) => s.tabs);
  const windows = useTabsStore((s) => s.windows);
  const currentWindowId = useTabsStore((s) => s.currentWindowId);
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const closeSingleTab = useTabsStore((s) => s.closeSingleTab);
  const loadAllTabs = useTabsStore((s) => s.loadAllTabs);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  // 订阅原始字段（保持引用稳定，避免 selector 每次返回新数组导致 React 无限重渲染 / error #185）
  const rawWindowCardOrder = useSettingsStore((s) => s.settings.windowCardOrder);
  const rawDefaultCollapsed = useSettingsStore((s) => s.settings.windowCardDefaultCollapsed);
  const rawWindowCardColumns = useSettingsStore((s) => s.settings.windowCardColumns);
  const windowCardOrder = useMemo(
    () => normalizeWindowCardOrder(rawWindowCardOrder),
    [rawWindowCardOrder],
  );
  const defaultCollapsed = useMemo(
    () => normalizeDefaultCollapsed(rawDefaultCollapsed),
    [rawDefaultCollapsed],
  );
  const forcedColumns = useMemo<number | null>(() => {
    return typeof rawWindowCardColumns === "number" &&
      rawWindowCardColumns >= 1 &&
      rawWindowCardColumns <= 6
      ? rawWindowCardColumns
      : null;
  }, [rawWindowCardColumns]);
  const { t } = useT();

  const windowGroups = useMemo(() => groupTabsByWindow(tabs), [tabs]);
  const visibleTabIds = useMemo(() => tabs.map((tab) => tab.id), [tabs]);

  const sortedWindowIds = useMemo(() => {
    const orderIndex = new Map(windowCardOrder.map((id, index) => [id, index]));
    return [...windowGroups.keys()].sort((a, b) => {
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
  }, [currentWindowId, windowCardOrder, windowGroups, windows]);

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
        <div className={styles["app-window-grid"]} style={getColumnVars(forcedColumns)}>
          {sortedWindowIds.map((windowId) => {
            const windowTabs = windowGroups.get(windowId) ?? [];
            return (
              <SortableWindowCard key={windowId} windowId={windowId}>
                <WindowCard
                  windowId={windowId}
                  tabs={windowTabs}
                  windowInfo={windows.get(windowId)}
                  currentWindowId={currentWindowId}
                  initialCollapsed={shouldCollapseWindow(
                    defaultCollapsed,
                    windowId,
                    currentWindowId,
                  )}
                  visibleTabIds={visibleTabIds}
                  onJump={(tabId, targetWindowId) => {
                    void jumpToTab(tabId, targetWindowId);
                  }}
                  onCloseTab={(tabId) => {
                    void closeSingleTab(tabId);
                  }}
                  onRefresh={() => {
                    void loadAllTabs({ silent: true });
                  }}
                />
              </SortableWindowCard>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
