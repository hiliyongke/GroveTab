/**
 * Undo System Type Definitions
 * 撤销系统相关类型
 */

import type { ArchivedSession } from "./archive";

export interface ClosedTabSnapshot {
  url: string;
  title: string;
  favIconUrl: string;
  windowId: number;
  pinned: boolean;
}

export interface UndoRecord {
  id: string;
  createdAt: number;
  kind?: "tabs" | "sessions_snapshot";
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
  /**
   * 会话/归档破坏性操作撤销：操作前的完整快照。
   */
  sessionsSnapshot?: ArchivedSession[];
}
