/**
 * 视图配置中心
 *
 * 所有视图相关的元数据（ID、图标、文案 key、组件）集中在此定义，
 * 新增视图只需改这一处，App.tsx 和 SettingsPanel 自动同步。
 */

import type { LucideIcon } from "lucide-react";
import { LayoutGrid, Clock, Flame, Layers, Monitor, Columns, Archive, TrendingUp, Wrench, BarChart3, History, Trash2, Bookmark } from "lucide-react";

export type ViewMode =
  | "tabs"
  | "timeline"
  | "frequency"
  | "tabgroup"
  | "window"
  | "kanban"
  | "bookmarks"
  | "archive"
  | "trending"
  | "devtools"
  | "insights"
  | "history"
  | "trash";

export interface ViewConfig {
  id: ViewMode;
  Icon: LucideIcon;
  labelKey: string;
}

export const VIEW_CONFIGS: ViewConfig[] = [
  // ── 核心管理（每日最高频） ──
  { id: "tabs", Icon: LayoutGrid, labelKey: "view.tabs" },
  { id: "tabgroup", Icon: Layers, labelKey: "view.tabgroup" },
  { id: "window", Icon: Monitor, labelKey: "view.window" },
  // ── 可视化纵览 ──
  { id: "timeline", Icon: Clock, labelKey: "view.timeline" },
  { id: "kanban", Icon: Columns, labelKey: "view.kanban" },
  // ── 资源管理 ──
  { id: "bookmarks", Icon: Bookmark, labelKey: "view.bookmarks" },
  { id: "frequency", Icon: Flame, labelKey: "view.frequency" },
  // ── 记忆与归档 ──
  { id: "history", Icon: History, labelKey: "view.history" },
  { id: "archive", Icon: Archive, labelKey: "view.archive" },
  { id: "trash", Icon: Trash2, labelKey: "view.trash" },
  // ── 探索与工具 ──
  { id: "insights", Icon: BarChart3, labelKey: "view.insights" },
  { id: "trending", Icon: TrendingUp, labelKey: "view.trending" },
  { id: "devtools", Icon: Wrench, labelKey: "view.devtools" },
];

/** 合法的 ViewMode 值数组，用于防御旧版残留值 */
export const VALID_VIEWS: ViewMode[] = VIEW_CONFIGS.map((v) => v.id);

/**
 * 旧版视图 → 新版视图 + 布局 的兼容映射表。
 * 运行期检测到 legacy defaultView 时自动迁移。
 */
export const LEGACY_VIEW_MAP: Record<
  string,
  { view: ViewMode; layout: "masonry" | "compact" | "grid" }
> = {
  domain: { view: "tabs", layout: "masonry" },
  compact: { view: "tabs", layout: "compact" },
  grid: { view: "tabs", layout: "grid" },
};
