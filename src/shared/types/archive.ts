/**
 * Archive / Sessions Type Definitions
 * 归档与会话相关类型
 */

/** An archived tab entry */
export interface ArchivedTab {
  url: string;
  title: string;
  favIconUrl: string;
  hostname: string;
  pinned: boolean;
}

/** An archived session (group of tabs saved at once) */
export interface ArchivedSession {
  id: string;
  name: string;
  createdAt: number;
  tabs: ArchivedTab[];
  /** Tab count for quick display */
  tabCount: number;
  /**
   * 是否为隐藏会话（F-23 自动快照）。
   * hidden=true 的会话默认在 ArchivePanel 收起到"自动快照"折叠区。
   */
  hidden?: boolean;
  /**
   * 会话来源类型，默认 'manual'。'auto' 表示由自动快照创建。
   */
  source?: 'manual' | 'auto' | 'import' | 'kanban';
}

/** Auto Snapshot Meta (F-23) */
export interface AutoSnapshotMeta {
  /** 最后一次自动快照时间戳 */
  lastSnapshotAt: number;
}
