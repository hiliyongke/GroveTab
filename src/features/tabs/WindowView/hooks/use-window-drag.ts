/**
 * useWindowDrag — 窗口视图拖拽逻辑 Hook
 *
 * 封装了跨窗口拖拽、分组拖拽、标签排序等所有拖拽相关逻辑
 */

import { useState, useCallback } from 'react';
import type { DragEndEvent, DragStartEvent, DragOverEvent } from '@dnd-kit/core';
import { useTabsStore } from '@/store';
import { feedback } from '@/shared/ui/feedback';
import { track as trackEvent } from '@/shared/utils/metrics';
import type { LiveTab } from '@/shared/types/tab';
import {
  addTabToGroup,
  copyTabToWindow,
  createTabGroup,
  getTabsInGroup,
  mergeTabGroups,
  moveGroupToWindow,
  moveTabBeforeTab,
  moveTabToWindow,
  reorderTabs,
  ungroupTabs,
} from '@/features/tabs/services/window-tab-operations';
import type { DragData, ActiveDrag } from '../types';

/**
 * 获取同域名标签的数量统计
 *
 * 统计指定窗口中属于特定域名的标签页数量。
 *
 * @param windowTabs - 窗口中的所有标签页
 * @param domain - 目标域名
 * @returns 该域名下的标签页数量
 */
function countSameDomainTabs(windowTabs: LiveTab[], domain: string): number {
  return windowTabs.filter((t) => t.hostname === domain).length;
}

interface UseWindowDragOptions {
  t: (key: string, params?: Record<string, string | number>) => string;
  altHeld: boolean;
  windowGroups: Map<number, LiveTab[]>;
  tabs: LiveTab[];
}

interface UseWindowDragReturn {
  activeDrag: ActiveDrag | null;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragOver: (event: DragOverEvent) => void;
  handleDragEnd: (event: DragEndEvent) => Promise<void>;
}

/**
 * 窗口视图拖拽逻辑 Hook
 *
 * 封装了跨窗口拖拽、分组拖拽、标签排序等所有拖拽相关逻辑。
 * 支持 Alt 键按住时复制标签到目标窗口。
 *
 * @param options - Hook 配置选项
 * @param options.t - 国际化翻译函数
 * @param options.altHeld - Alt 键是否按住（跨窗口拖拽复制）
 * @param options.windowGroups - 窗口 ID 到标签页列表的映射
 * @param options.tabs - 所有标签页列表
 * @returns 拖拽相关的状态和处理函数
 */
export function useWindowDrag({
  t,
  altHeld,
  windowGroups,
  tabs,
}: UseWindowDragOptions): UseWindowDragReturn {
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);

  /** 拖拽开始 */
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined;
    if (!data) return;
    setActiveDrag({ id: String(event.active.id), data });
  }, []);

  /** 拖拽悬停在目标区域上方时 */
  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // DndContext 的 collisionDetection 已经帮我们找到了 over 目标
    // 这里可以做视觉反馈，例如高亮目标窗口卡片
  }, []);

  /** 拖拽结束 —— 核心：跨窗口移动 / 复制 + 组内排序 + 浏览器实时同步 + 分组/取消分组 */
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active: a, over } = event;
      setActiveDrag(null);
      if (!over) {
        // 拖到非 droppable 区域 —— 检查是否是分组标签拖出，如果是则取消分组
        const activeData = a.data.current as DragData | undefined;
        if (activeData?.kind === 'group-label') {
          // 从分组标签拖到空白区域 → 取消分组
          try {
            const groupTabs = getTabsInGroup(tabs, activeData.groupId);
            if (groupTabs.length > 0) {
              await ungroupTabs(groupTabs.map((tab) => tab.id));
              feedback.success(t('window.groupUngrouped'));
              void useTabsStore.getState().loadAllTabs({ silent: true });
            }
          } catch (err) {
            feedback.error(t('window.groupUngroupFailed'));
            console.warn('[WindowView] ungroup failed', err);
            void useTabsStore.getState().loadAllTabs({ silent: true });
          }
        }
        return;
      }

      const activeData = a.data.current as DragData | undefined;
      const overData = over.data.current as DragData | undefined;
      if (!activeData) return;

      try {
        // 1) 标签拖到另一个窗口的 drop zone → 跨窗口移动或复制
        if (activeData.kind === 'tab' && overData?.kind === 'window-drop-zone') {
          const targetWindowId = overData.windowId;
          if (targetWindowId === activeData.windowId) return; // 同窗口，无需操作

          if (altHeld) {
            // Alt+拖拽：复制标签到目标窗口（不关闭原标签）
            const tab = tabs.find((t) => t.id === activeData.tabId);
            if (tab) {
              await copyTabToWindow(tab, targetWindowId);
              feedback.success(t('window.dragCopyToOtherWindow'));
            }
          } else {
            // 普通拖拽：移动标签到目标窗口
            await moveTabToWindow(activeData.tabId, targetWindowId);
            feedback.success(t('window.tabMoved'));
            void trackEvent('tab_drag_cross_window', {
              from: activeData.windowId,
              to: targetWindowId,
            });
          }
          return;
        }

        // 2) 标签拖到分组区域 → chrome.tabs.group
        if (activeData.kind === 'tab' && overData?.kind === 'group-zone') {
          // 检查同域名合并去重提示
          const tab = tabs.find((t) => t.id === activeData.tabId);
          if (tab) {
            const targetWindowTabs = windowGroups.get(overData.windowId) ?? [];
            const sameDomainCount = countSameDomainTabs(targetWindowTabs, tab.hostname);
            if (sameDomainCount >= 2) {
              feedback.info(
                t('window.mergeDedupHint', {
                  domain: tab.hostname,
                  count: sameDomainCount,
                }),
              );
            }
          }

          const groupId = await createTabGroup(activeData.tabId);
          feedback.success(t('window.groupCreated', { name: `Group ${groupId}` }));
          void useTabsStore.getState().loadAllTabs({ silent: true });
          return;
        }

        // 3) 标签拖到分组标签上 → 将标签添加到该分组
        if (activeData.kind === 'tab' && overData?.kind === 'group-label') {
          const tab = tabs.find((t) => t.id === activeData.tabId);
          if (tab && tab.groupId !== overData.groupId) {
            await addTabToGroup(activeData.tabId, overData.groupId);
            feedback.success(t('window.tabAddedToGroup'));
            void useTabsStore.getState().loadAllTabs({ silent: true });
          }
          return;
        }

        // 4) 标签拖到标签上 → 同窗口列内 reorder 或跨窗口移动到该标签前
        if (activeData.kind === 'tab' && overData?.kind === 'tab') {
          if (overData.windowId === activeData.windowId) {
            // 同窗口 reorder —— 在浏览器中同步标签顺序
            const windowTabs = windowGroups.get(activeData.windowId) ?? [];
            const fromIndex = windowTabs.findIndex((t) => t.id === activeData.tabId);
            const toIndex = windowTabs.findIndex((t) => t.id === overData.tabId);
            if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

            const reordered = [...windowTabs];
            const [moved] = reordered.splice(fromIndex, 1);
            if (!moved) return;
            reordered.splice(toIndex, 0, moved);
            await reorderTabs(reordered.map((tab) => tab.id));
            feedback.success(t('window.syncAfterReorder'));
            void useTabsStore.getState().loadAllTabs({ silent: true });
          } else {
            // 跨窗口移动到目标标签前面
            const destWindowTabs = windowGroups.get(overData.windowId) ?? [];
            await moveTabBeforeTab(activeData.tabId, overData.windowId, destWindowTabs, overData.tabId);
            feedback.success(t('window.tabMoved'));
            void useTabsStore.getState().loadAllTabs({ silent: true });
          }
          return;
        }

        // 5) 分组标签拖到另一个分组标签上 → 合并两个分组
        if (activeData.kind === 'group-label' && overData?.kind === 'group-label') {
          if (activeData.groupId !== overData.groupId) {
            const sourceGroupTabs = getTabsInGroup(tabs, activeData.groupId);
            if (sourceGroupTabs.length > 0) {
              await mergeTabGroups(sourceGroupTabs.map((tab) => tab.id), overData.groupId);
              feedback.success(t('window.groupMerged'));
              void useTabsStore.getState().loadAllTabs({ silent: true });
            }
          }
          return;
        }

        // 6) 分组标签拖到另一个窗口的 drop zone → 跨窗口移动整个分组
        if (activeData.kind === 'group-label' && overData?.kind === 'window-drop-zone') {
          const targetWindowId = overData.windowId;
          if (targetWindowId === activeData.windowId) return;

          const sourceGroupTabs = getTabsInGroup(tabs, activeData.groupId);
          if (sourceGroupTabs.length === 0) return;

          const movedIds = await moveGroupToWindow(sourceGroupTabs, targetWindowId);
          feedback.success(t('window.groupMovedToWindow', { count: movedIds.length }));
          void trackEvent('group_drag_cross_window', {
            from: activeData.windowId,
            to: targetWindowId,
          });
          return;
        }

        // 7) 分组标签拖到另一个窗口的标签上 → 移动整个分组到目标窗口该标签位置
        if (activeData.kind === 'group-label' && overData?.kind === 'tab') {
          const targetWindowId = overData.windowId;
          if (targetWindowId === activeData.windowId) return;

          const sourceGroupTabs = getTabsInGroup(tabs, activeData.groupId);
          if (sourceGroupTabs.length === 0) return;

          const destWindowTabs = windowGroups.get(targetWindowId) ?? [];
          const toIndex = destWindowTabs.findIndex((t) => t.id === overData.tabId);

          const movedIds = await moveGroupToWindow(sourceGroupTabs, targetWindowId, toIndex >= 0 ? toIndex : -1);
          feedback.success(t('window.groupMovedToWindow', { count: movedIds.length }));
          void trackEvent('group_drag_cross_window', {
            from: activeData.windowId,
            to: targetWindowId,
          });
          return;
        }
      } catch (err) {
        feedback.error(t('window.moveFailed'));
        console.warn('[WindowView] drag operation failed', err);
        void useTabsStore.getState().loadAllTabs({ silent: true });
      }
    },
    [altHeld, tabs, windowGroups, t],
  );

  return {
    activeDrag,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
}
