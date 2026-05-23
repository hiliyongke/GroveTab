/**
 * 共享类型定义 — 统一导出
 *
 * 按功能域拆分，统一从此文件导出。
 * 外部仍使用 `import { ... } from '@/shared/types'` 即可，无需修改导入路径。
 */

// ── 标签页 & 窗口 ──────────────────────────────────
export type { LiveTab, SpecialUrlType, WindowInfo } from './tab';

// ── SW 广播消息 ────────────────────────────────────
export type { SwBroadcastType, SwBroadcastMessage } from './broadcast';

// ── 存储 ──────────────────────────────────────────
export type { StorageKey, StorageMeta } from './storage';

// ── 用户设置 ──────────────────────────────
export type {
  SearchScopeField,
  SearchSortMode,
  SearchEngineId,
  BuiltInSearchEngineId,
  CustomSearchEngineId,
  CustomSearchEngine,
  NewtabPageMode,
  ViewTabPosition,
  UserSettings,
} from './settings';
export type { ViewMode } from './view';
// ── 撤销系统 ──────────────────────────────────────
export type { ClosedTabSnapshot, UndoRecord } from './undo';

// ── 归档 / 会话 ──────────────────────────────────
export type { ArchivedTab, ArchivedSession, AutoSnapshotMeta } from './archive';

// ── 活动记录 ────────────────────────────
export type { ActivityRecord } from './activity';

// ── 插件原生历史记录（v1.4） ─────────────────
export type {
  HistoryEvent,
  HistoryEventType,
  ClosedTabRecord,
  ClosedWindowRecord,
  DailySnapshot,
  SnapshotDiff,
} from './history';
// ── 搜索历史 ──────────────────────────────────────
export type { SearchHistoryEntry } from './search';

// ── 工作区 ────────────────────────────────────────
export type { Workspace } from './workspace';

// ── 看板 ──────────────────────────────────────────
export type { KanbanCard, KanbanColumn, KanbanLayout } from './kanban';

// ── 统计 ──────────────────────────────────────────
export type { StatsRecord, StatsData } from './stats';

// ── OG 索引 ──────────────────────────────────────
export type { OgEntry } from './og';

// ── 本地指标 ──────────────────────────────────────
export type { MetricEvent } from './metrics';

// ── 常用站点 ──────────────────────────────────────
export type { SpeedDialSite } from './speed-dial';

// ── 热榜聚合 ──────────────────────────────────────
export type {
  TrendingCategory,
  TrendingGroupMode,
  TrendingItem,
  HotBoardData,
  TrendingCache,
} from './trending';

// ── 偷摸模式 ──────────────────────────────────────
export type { StealthModeConfig } from './stealth-mode';
