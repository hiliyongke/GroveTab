/**
 * useWindowKeyboard — 窗口视图键盘快捷键 Hook
 *
 * 封装键盘快捷键逻辑：
 * - Delete/Backspace：关闭选中标签
 * - Ctrl+Z：撤销关闭
 * - Escape：清除选中
 * - 其他快捷键在 index.tsx 的 onKeyDown 中处理
 */

import { useCallback } from 'react';
import { useTabsStore, useSelectionStore } from '@/store';
import { feedback } from '@/shared/ui/feedback';
import type { LiveTab } from '@/shared/types/tab';
import type { ActiveDrag } from '../types';

interface UseWindowKeyboardOptions {
  tabs: LiveTab[];
  activeDrag: ActiveDrag | null;
  onJumpToTab: (tabId: number, windowId: number) => void;
  onCloseSingleTab: (tabId: number) => void;
}

interface UseWindowKeyboardReturn {
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

/**
 * 窗口视图键盘快捷键 Hook
 *
 * 封装键盘快捷键逻辑：
 * - Delete/Backspace：关闭选中标签
 * - Ctrl+Z：撤销关闭
 * - Escape：清除选中
 * - 其他快捷键在 index.tsx 的 onKeyDown 中处理
 *
 * @param options - Hook 配置选项
 * @param options.tabs - 所有标签页列表
 * @param options.activeDrag - 当前拖拽状态
 * @param options.onJumpToTab - 跳转标签回调
 * @param options.onCloseSingleTab - 关闭单个标签回调
 * @returns 包含键盘事件处理函数的对象
 */
export function useWindowKeyboard({
  tabs,
  activeDrag,
  onJumpToTab,
  onCloseSingleTab,
}: UseWindowKeyboardOptions): UseWindowKeyboardReturn {
  /** 处理键盘事件 */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // 如果正在拖拽，不处理键盘事件
      if (activeDrag) return;

      const selectedIds = useSelectionStore.getState().selectedIds;

      // Delete / Backspace：关闭选中标签
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0) {
          e.preventDefault();
          const ids = Array.from(selectedIds);
          for (const id of ids) {
            onCloseSingleTab(id);
          }
          useSelectionStore.getState().clearSelection();
          return;
        }
      }

      // Ctrl/Cmd + Z：撤销关闭
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        // 使用 chrome.sessions.restore 来撤销关闭（需平台检测）
        if (typeof chrome !== 'undefined' && chrome.sessions?.restore) {
          void chrome.sessions.restore();
        }
        feedback.info('已撤销关闭');
        void useTabsStore.getState().loadAllTabs({ silent: true });
        return;
      }

      // Escape：清除选中
      if (e.key === 'Escape') {
        useSelectionStore.getState().clearSelection();
        return;
      }

        // Enter：跳转至选中标签
      if (e.key === 'Enter' && selectedIds.size === 1) {
        const tabId = Array.from(selectedIds)[0];
        const tab = tabs.find((t) => t.id === tabId);
        if (tab) {
          // @ts-expect-error windowId is number in LiveTab type
          onJumpToTab(tabId, tab.windowId);
        }
        return;
      }
    },
    [tabs, activeDrag, onJumpToTab, onCloseSingleTab],
  );

  return { handleKeyDown };
}
