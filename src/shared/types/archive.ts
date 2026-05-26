/**
 * Archive / Sessions Type Definitions
 * 归档与会话相关类型
 */

/** TabGroup 快照（归档时记录颜色/标题，恢复时重建） */
export interface ArchivedTabGroup {
  /** 原始 groupId（仅用于归档时关联，恢复后会重新分配） */
  groupId: number;
  title: string;
  /** TabGroup 颜色字符串（如 'blue'、'red'），避免直接依赖 chrome.tabGroups.ColorEnum 类型 */
  color: string;
  collapsed: boolean;
}

/** An archived tab entry */
export interface ArchivedTab {
  url: string;
  title: string;
  favIconUrl: string;
  hostname: string;
  pinned: boolean;
  /**
   * 归档时所属 TabGroup 的 groupId（对应 ArchivedSession.tabGroups 中的条目）。
   * -1 表示不属于任何 group。
   */
  groupId?: number;
  /** 标签页在窗口中的原始顺序索引（用于恢复时还原排列） */
  index?: number;
}

/** 窗口边界快照 */
export interface ArchivedWindowBounds {
  left: number;
  top: number;
  width: number;
  height: number;
  /** 窗口状态字符串（如 'normal'、'maximized'），避免直接依赖 chrome.windows.windowStateEnum 类型 */
  state: string;
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
  source?: "manual" | "auto" | "import" | "kanban";
  /**
   * 归档时的 TabGroup 快照列表（任务4：高保真结构化归档）。
   * 恢复时按此列表重建 chrome.tabGroups。
   */
  tabGroups?: ArchivedTabGroup[];
  /**
   * 归档时的窗口边界快照（任务4：高保真结构化归档）。
   * 恢复时可选择按原始窗口尺寸/位置重建。
   */
  windowBounds?: ArchivedWindowBounds;
  /**
   * 自动快照版本号，用于区分同一时间段内的多次快照。
   * 每次自动快照递增，手动归档不设此字段。
   */
  snapshotVersion?: number;
}

/** Auto Snapshot Meta (F-23) */
export interface AutoSnapshotMeta {
  /** 最后一次自动快照时间戳 */
  lastSnapshotAt: number;
}
