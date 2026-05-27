/**
 * Trash types — 回收站数据结构
 *
 * TrashedItem: 一个回收项，可能包含单个标签或多个标签（批量关闭时）
 */

/** 回收站中的单个标签快照 */
export interface TrashedTab {
  /** 原始 tab ID */
  id: number;
  /** URL */
  url: string;
  /** 标题 */
  title: string;
  /** 图标 URL */
  favIconUrl?: string;
  /** 域名 */
  hostname: string;
  /** 是否固定 */
  pinned: boolean;
  /** 窗口 ID */
  windowId: number;
  /** 分组 ID（-1 表示无分组） */
  groupId: number;
}

/** 回收站条目 */
export interface TrashedItem {
  /** 唯一 ID */
  id: string;
  /** 标签列表 */
  tabs: TrashedTab[];
  /** 用户可读名称（如 "github.com · 3 个标签"） */
  name: string;
  /** 放入回收站时间 */
  trashedAt: number;
}
