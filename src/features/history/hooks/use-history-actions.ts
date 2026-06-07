/**
 * useHistoryActions — 历史视图所有动作处理器
 *
 * 集中封装：恢复 / 删除 / 撤销 / 导出 JSON。
 * 每个回调都返回 Promise<boolean> 表示是否成功，方便调用方决定是否刷新。
 */

import { useCallback } from "react";
import {
  deleteClosedTab,
  deleteClosedWindow,
  deleteHistoryEvent,
  exportHistoryJson,
  markHistoryEventUndone,
} from "@/repositories";
import { createTab } from "@/chrome";
import { hasHistoryUndoHandler, undoHistoryEvent } from "@/services/history/undo-bus";
import { feedback } from "@/shared/ui/feedback";
import { useT } from "@/shared/i18n";
import type { ClosedTabRecord, ClosedWindowRecord, HistoryEvent } from "@/shared/types";
import { downloadFile } from "@/shared/utils/download-file";

export interface UseHistoryActionsOptions {
  closedTabs: ClosedTabRecord[];
  onAfterChange: () => Promise<void> | void;
}

export interface UseHistoryActionsResult {
  restoreOne: (rec: ClosedTabRecord) => Promise<boolean>;
  deleteOne: (rec: ClosedTabRecord) => Promise<boolean>;
  restoreWindow: (win: ClosedWindowRecord) => Promise<boolean>;
  deleteEvent: (id: string) => Promise<boolean>;
  undoEvent: (e: HistoryEvent) => Promise<boolean>;
  exportJson: (rangeMs: number) => Promise<boolean>;
}

export function useHistoryActions({
  closedTabs,
  onAfterChange,
}: UseHistoryActionsOptions): UseHistoryActionsResult {
  const { t } = useT();

  const restoreOne = useCallback(
    async (rec: ClosedTabRecord): Promise<boolean> => {
      try {
        await createTab({ url: rec.url, active: true, pinned: rec.pinned });
        await deleteClosedTab(rec.id);
        feedback.success(t("已恢复 1 个标签页"));
        await onAfterChange();
        return true;
      } catch (err) {
        feedback.error(t("已恢复 1 个标签页"), err);
        return false;
      }
    },
    [onAfterChange, t],
  );

  const deleteOne = useCallback(
    async (rec: ClosedTabRecord): Promise<boolean> => {
      await deleteClosedTab(rec.id);
      await onAfterChange();
      return true;
    },
    [onAfterChange],
  );

  const restoreWindow = useCallback(
    async (win: ClosedWindowRecord): Promise<boolean> => {
      // 找到 win.tabIds 对应的 closed tabs，依次重开
      const targets = closedTabs.filter((c) => win.tabIds.includes(c.id));
      if (targets.length === 0) {
        feedback.warning(t("最近没有关闭过任何标签页"));
        return false;
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
      feedback.success(t("已恢复 {count} 个标签页", { count: success }));
      await onAfterChange();
      return true;
    },
    [closedTabs, onAfterChange, t],
  );

  const deleteEvent = useCallback(
    async (id: string): Promise<boolean> => {
      await deleteHistoryEvent(id);
      await onAfterChange();
      return true;
    },
    [onAfterChange],
  );

  const undoEvent = useCallback(
    async (e: HistoryEvent): Promise<boolean> => {
      if (!hasHistoryUndoHandler(e.type)) {
        feedback.warning(t("未注册撤销处理"));
        return false;
      }
      try {
        const ok = await undoHistoryEvent(e);
        if (!ok) {
          feedback.warning(t("撤销失败"));
          return false;
        }
        await markHistoryEventUndone(e.id);
        feedback.success(t("已撤销"));
        await onAfterChange();
        return true;
      } catch (err) {
        feedback.error(t("撤销失败"), err);
        return false;
      }
    },
    [onAfterChange, t],
  );

  const exportJson = useCallback(
    async (rangeMs: number): Promise<boolean> => {
      try {
        const json = await exportHistoryJson({ rangeMs });
        const filename = `tabs-history-${new Date().toISOString().slice(0, 10)}.json`;
        downloadFile(filename, "application/json", json);
        feedback.success(t("导出成功"));
        return true;
      } catch (err) {
        feedback.error(t("导出失败"), err);
        return false;
      }
    },
    [t],
  );

  return { restoreOne, deleteOne, restoreWindow, deleteEvent, undoEvent, exportJson };
}
