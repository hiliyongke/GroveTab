/**
 * Undo System Type Definitions
 * 撤销系统相关类型
 */

export interface ClosedTabSnapshot {
  /** 标签页 URL */
  url: string;
  /** 标签页标题 */
  title: string;
  /** favicon 图标 URL */
  favIconUrl: string;
  /** 所属窗口 ID */
  windowId: number;
  /** 是否固定标签 */
  pinned: boolean;
}

export interface UndoRecord {
  id: string;
  createdAt: number;
  tabs: ClosedTabSnapshot[];
  description: string;
  expired: boolean;
  /**
   * 归档场景专用：对应刚创建的 ArchivedSession.id，
   * UndoToast 据此展示「查看归档」按钮。
   */
  archivedSessionId?: string;
  /**
   * 子行文案，如「（M 个关闭失败）」等次要提示。
   */
  subNote?: string;
}
