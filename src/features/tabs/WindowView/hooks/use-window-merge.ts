/**
 * useWindowMerge — 窗口合并 Hook
 *
 * 提供合并所有窗口到当前窗口的功能
 */

import { useState, useCallback } from 'react';
import {
  closeWindowTabs,
  mergeTabsIntoWindow,
} from '@/features/tabs/services/window-tab-operations';
import { useTabsStore } from '@/store';
import { feedback } from '@/shared/ui/feedback';
import { translate } from '@/shared/i18n/core';
import type { LiveTab } from '@/shared/types/tab';

interface UseWindowMergeOptions {
  currentWindowId: number | null;
  tabs: LiveTab[];
}

interface UseWindowMergeReturn {
  busy: boolean;
  handleMergeAll: () => Promise<void>;
  handleCloseWindow: (windowTabs: LiveTab[]) => Promise<void>;
}

/**
 * 窗口合并 Hook
 *
 * 提供合并所有窗口到当前窗口和关闭整个窗口的功能。
 *
 * @param options - Hook 配置选项
 * @param options.currentWindowId - 当前窗口 ID
 * @param options.tabs - 所有标签页列表
 * @returns 包含加载状态和窗口操作函数的对象
 */
export function useWindowMerge({
  currentWindowId,
  tabs,
}: UseWindowMergeOptions): UseWindowMergeReturn {
  const [busy, setBusy] = useState(false);

  /** 合并所有窗口到当前窗口 */
  const handleMergeAll = useCallback(async () => {
    if (busy) return;
    if (!currentWindowId) {
      feedback.error(translate('window.mergeFailed'));
      return;
    }
    setBusy(true);
    try {
      const otherTabIds = tabs
        .filter((tab) => tab.windowId !== currentWindowId)
        .map((tab) => tab.id);
      if (otherTabIds.length === 0) {
        setBusy(false);
        return;
      }
      await mergeTabsIntoWindow(otherTabIds, currentWindowId as number);
      feedback.success(translate('window.mergedAll', { count: otherTabIds.length }));
      void useTabsStore.getState().loadAllTabs({ silent: true });
    } catch (err) {
      feedback.error(translate('window.mergeFailed'), err);
    } finally {
      setBusy(false);
    }
  }, [busy, tabs, currentWindowId]);

  /** 关闭整个窗口（关闭该窗口所有标签） */
  const handleCloseWindow = useCallback(
    async (windowTabs: LiveTab[]) => {
      try {
        const count = await closeWindowTabs(windowTabs);
        feedback.success(translate('window.closedWindow', { count }));
        void useTabsStore.getState().loadAllTabs({ silent: true });
      } catch (err) {
        feedback.error(translate('window.closeFailed'), err);
      }
    },
    [],
  );

  return {
    busy,
    handleMergeAll,
    handleCloseWindow,
  };
}
