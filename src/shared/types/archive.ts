/**
 * 归档与会话相关类型定义
 */

/** 归档标签页条目 */
export interface ArchivedTab {
  /** 标签页 URL */
  url: string;
  /** 标签页标题 */
  title: string;
  /** favicon 图标 URL */
  favIconUrl: string;
  /** 域名 */
  hostname: string;
  /** 是否固定标签 */
  pinned: boolean;
}

/** 归档会话（一次保存的标签页组） */
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

/** 自动快照元数据 (F-23) */
export interface AutoSnapshotMeta {
  /** 最后一次自动快照时间戳 */
  lastSnapshotAt: number;
}
