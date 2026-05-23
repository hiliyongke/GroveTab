/**
 * Activity Strip Type Definitions
 * 最近活动相关类型 (F-27)
 */

type ActivityType =
  | "archive"
  | "restore"
  | "import"
  | "export"
  | "permission"
  | "clear_archive"
  | "dedup_merge"
  | "snapshot";

interface ActivityAction {
  id: string;
  label: string;
  /** 行动按钮类型：undo 调用 undoGroup；open 跳转面板；custom 由调用方处理 */
  kind: "undo" | "open_archive" | "open_import_result" | "custom";
  /** 可选负载：undo 时为 undoGroupId；open_archive 时为 sessionId */
  payload?: string;
}

export interface ActivityRecord {
  id: string;
  type: ActivityType;
  ts: number;
  /** 一句话摘要，如 "已归档 32 个标签到「4月24日 15:02」" */
  summary: string;
  icon?: string;
  primaryAction?: ActivityAction;
  secondaryAction?: ActivityAction;
  /** 如果对应 undo-slice 中的 UndoGroup，记录其 id 以便回滚 */
  undoGroupId?: string;
}
