/**
 * use-history-actions —— 历史面板操作处理 hook
 *
 * 负责：
 *   - 恢复单条关闭的 tab
 *   - 删除单条关闭的 tab
 *   - 恢复整窗
 *   - 删除事件
 *   - 撤销事件
 *   - 清空全部历史
 */

import { useCallback } from 'react';
import { useT } from '@/shared/i18n';
import { feedback } from '@/shared/ui/feedback';
import { createTab } from '@/chrome';
import {
  deleteClosedTab,
  deleteClosedWindow,
  deleteHistoryEvent,
  clearAllNativeHistory,
  markHistoryEventUndone,
} from '@/repositories';
import { hasHistoryUndoHandler, undoHistoryEvent } from '@/services/history/undo-bus';
import type {
  ClosedTabRecord,
  ClosedWindowRecord,
  HistoryEvent,
} from '@/shared/types';

export interface UseHistoryActionsParams {
  refresh: () => Promise<void>;
  closedTabs: ClosedTabRecord[];
}

export interface UseHistoryActionsReturn {
  handleRestoreOne: (rec: ClosedTabRecord) => Promise<void>;
  handleDeleteClosed: (rec: ClosedTabRecord) => Promise<void>;
  handleRestoreWindow: (win: ClosedWindowRecord) => Promise<void>;
  handleDeleteEvent: (id: string) => Promise<void>;
  handleUndoEvent: (e: HistoryEvent) => Promise<void>;
  handleClearAll: () => Promise<void>;
}

/**
 * 历史面板操作处理 hook
 * @param params - refresh 回调及当前 closedTabs 数据
 * @returns {UseHistoryActionsReturn} 返回历史操作相关的回调函数集合
 */
export function useHistoryActions(params: UseHistoryActionsParams): UseHistoryActionsReturn {
  const { refresh, closedTabs } = params;
  const { t } = useT();

  const handleRestoreOne = useCallback(async (rec: ClosedTabRecord) => {
    try {
      await createTab({ url: rec.url, active: true, pinned: rec.pinned });
      await deleteClosedTab(rec.id);
      feedback.success(t('history.restored'));
      void refresh();
    } catch (err) {
      feedback.error(t('history.restored'), err);
    }
  }, [refresh, t]);

  const handleDeleteClosed = useCallback(async (rec: ClosedTabRecord) => {
    await deleteClosedTab(rec.id);
    void refresh();
  }, [refresh]);

  const handleRestoreWindow = useCallback(async (win: ClosedWindowRecord) => {
    // 找到 win.tabIds 对应的 closed tabs，依次重开
    const targets = closedTabs.filter((c) => win.tabIds.includes(c.id));
    if (targets.length === 0) {
      feedback.warning(t('history.emptyClosed'));
      return;
    }
    let success = 0;
    for (const c of targets) {
      try {
        await createTab({ url: c.url, active: false, pinned: c.pinned });
        await deleteClosedTab(c.id);
        success += 1;
      } catch {
        /* 单个失败不打断整体 */
      }
    }
    await deleteClosedWindow(win.id);
    feedback.success(t('history.restoredCount', { count: success }));
    void refresh();
  }, [closedTabs, refresh, t]);

  const handleDeleteEvent = useCallback(async (id: string) => {
    await deleteHistoryEvent(id);
    void refresh();
  }, [refresh]);

  /**
   * 「撤销」一条事件：
   *   1. 如果未注册该 type 的 handler→ 警告并提示（不会弹错 toast）
   *   2. handler 报错 / 返回 false → toast 失败
   *   3. 成功之后仅将事件标记为 undone，保留在时间线作为足迹
   * @returns {Promise<void>} 撤销操作完成（无返回值）
   */
  const handleUndoEvent = useCallback(async (e: HistoryEvent) => {
    if (!hasHistoryUndoHandler(e.type)) {
      feedback.warning(t('history.undoNotSupported'));
      return;
    }
    try {
      const ok = await undoHistoryEvent(e);
      if (!ok) {
        feedback.warning(t('history.undoFailed'));
        return;
      }
      await markHistoryEventUndone(e.id);
      feedback.success(t('history.undoSuccess'));
      void refresh();
    } catch (err) {
      feedback.error(t('history.undoFailed'), err);
    }
  }, [refresh, t]);

  const handleClearAll = useCallback(async () => {
    await clearAllNativeHistory();
    feedback.success(t('history.cleared'));
    void refresh();
  }, [refresh, t]);

  return {
    handleRestoreOne,
    handleDeleteClosed,
    handleRestoreWindow,
    handleDeleteEvent,
    handleUndoEvent,
    handleClearAll,
  };
}
