/**
 * History (插件原生历史记录) Type Definitions
 *
 * 与现有的 ActivityRecord（业务级动作总结，如"已归档32个标签"）不同，
 * 本类型记录"标签页粒度"的细粒度操作流水：开/关/激活/搜索等。
 * 用于驱动「最近关闭」和「插件历史时间线」两个独立功能。
 */

/** 操作事件类型 */
export type HistoryEventType =
  | 'tab_opened' // 打开新标签页
  | 'tab_closed' // 关闭标签页（核心：撑起"最近关闭"）
  | 'window_closed' // 整窗关闭（保留窗口下所有 tab 的快照，便于一键恢复）
  | 'tab_pinned' // 置顶/取消置顶
  | 'tab_tagged' // 加标签
  | 'archive_create' // 创建归档
  | 'archive_restore' // 恢复归档
  | 'snapshot_create' // 自动快照
  | 'search_query' // 搜索关键词
  | 'search_engine_open' // 通过搜索引擎跳转打开
  | 'workspace_switch'; // 切换工作区

/**
 * 一条历史事件。
 * - id：随机生成的稳定 id，用于列表 key 与撤销/删除定位
 * - ts：发生时间（ms）
 * - type：见 HistoryEventType
 * - title/url/favIconUrl：关联的页面信息（可选；search 类事件可能没有）
 * - windowId：发生窗口（用于窗口分组，可选）
 * - extra：类型相关的额外字段（query / engine / tagName / archiveId 等）
 */
export interface HistoryEvent {
  id: string;
  ts: number;
  type: HistoryEventType;
  title?: string;
  url?: string;
  favIconUrl?: string;
  windowId?: number;
  /** 站点域名（便于按域名筛选/聚合） */
  hostname?: string;
  /** 是否在隐身窗口产生；隐身事件默认不记录，但留字段以备未来选项 */
  incognito?: boolean;
  /** 类型特定的载荷 */
  extra?: Record<string, unknown>;
  /**
   * 是否可以「撤销」：由写入方决定。
   * 为 true 时 timeline 会展示「撤销」按钮，点击后调用对应 type 的 undo handler。
   * undo 事件不会被下一个事件「覆盖」：成功后仅将 undoable 置为 false，保留 trail。
   */
  undoable?: boolean;
  /** 撤销所需上下文（按 type 约定 key）。如 archive_create: { archiveId } */
  undoContext?: Record<string, unknown>;
}

/**
 * "最近关闭"的标签快照。
 *
 * 单独存一份是因为「最近关闭」是高频/高价值场景：
 * 需要快速读取、按窗口分组、整窗一键恢复，而 HistoryEvent 是大杂烩。
 */
export interface ClosedTabRecord {
  /** 该次关闭的稳定 id */
  id: string;
  ts: number;
  url: string;
  title: string;
  favIconUrl: string;
  windowId: number;
  hostname: string;
  /** 关闭时是否处于"窗口整体关闭"上下文（用于分组展示） */
  fromWindowClose: boolean;
  /** 关闭前是否被置顶（恢复时可还原） */
  pinned: boolean;
  /** 关闭前是否在隐身窗口 */
  incognito: boolean;
}

/**
 * "窗口快照"（整窗关闭时）。
 * 用于"恢复整个窗口"——比逐条点更顺手。
 */
export interface ClosedWindowRecord {
  id: string;
  ts: number;
  windowId: number;
  /** 该窗口下被关闭的所有 tab id 引用（在 closedTabs 中） */
  tabIds: string[];
  /** 冗余存一份摘要：窗口下 tab 数 + 第一个 tab 的标题用作展示 */
  tabCount: number;
  preview: string;
}

/**
 * 每日快照（DailySnapshot）
 *
 * sw 在每天首次启动时自动拍一份"当前所有打开标签页"的轻量摘要：
 *   - dateKey：YYYY-MM-DD，作为天级唯一标识，避免一天内重复拍
 *   - totalTabs：当时打开的标签页总数
 *   - hosts：[hostname, count] 数组，按 count 降序，用作 host 维度的"指纹"
 *
 * 仅保留"近 N 天"（默认 14 天），超出 FIFO 淘汰。
 */
export interface DailySnapshot {
  /** YYYY-MM-DD（按用户本地时区） */
  dateKey: string;
  /** 拍快照的实际时间戳（ms） */
  ts: number;
  /** 当时打开的标签页总数（含 chrome:// 等内部页） */
  totalTabs: number;
  /** 按 host 维度聚合的 [hostname, count] 列表 */
  hosts: Array<[string, number]>;
}

/**
 * 「昨天 → 今天」的 diff 结果（运行时计算，不持久化）。
 *
 * - added：今天有但昨天没有的 host
 * - removed：昨天有但今天没有的 host
 * - delta：tab 数变化（today - yesterday）
 */
export interface SnapshotDiff {
  yesterday: DailySnapshot;
  today: DailySnapshot;
  added: Array<{ host: string; count: number }>;
  removed: Array<{ host: string; count: number }>;
  delta: number;
}
