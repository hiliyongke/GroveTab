/**
 * 视图配置中心
 *
 * 所有视图相关的元数据（ID、图标名、文案 key、组件）集中在此定义，
 * 新增视图只需改这一处，App.tsx 和 SettingsPanel 自动同步。
 *
 * 图标使用字符串标识符而非静态 import，由 ViewTabs/OnboardingModal
 * 中的 IconRenderer 动态加载，避免将整个 lucide-react 包打进 chunk。
 */

/** lucide-react 图标组件名（仅类型层面约束） */
export type LucideIconName =
  | "LayoutGrid"
  | "Clock"
  | "Flame"
  | "Layers"
  | "Monitor"
  | "Columns"
  | "Archive"
  | "TrendingUp"
  | "Wrench"
  | "BarChart3"
  | "History"
  | "Trash2"
  | "Bookmark";

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
  iconName: LucideIconName;
  labelKey: string;
  primary?: boolean;
}

export const VIEW_CONFIGS: ViewConfig[] = [
  // ── 核心管理（每日最高频） ──
  { id: "tabs", iconName: "LayoutGrid", labelKey: "view.tabs", primary: true },
  { id: "tabgroup", iconName: "Layers", labelKey: "view.tabgroup", primary: true },
  { id: "window", iconName: "Monitor", labelKey: "view.window", primary: true },
  // ── 可视化纵览 ──
  { id: "timeline", iconName: "Clock", labelKey: "view.timeline", primary: true },
  { id: "kanban", iconName: "Columns", labelKey: "view.kanban", primary: true },
  // ── 资源管理 ──
  { id: "bookmarks", iconName: "Bookmark", labelKey: "view.bookmarks", primary: true },
  { id: "frequency", iconName: "Flame", labelKey: "view.frequency" },
  // ── 记忆与归档 ──
  { id: "history", iconName: "History", labelKey: "view.history", primary: true },
  { id: "archive", iconName: "Archive", labelKey: "view.archive" },
  { id: "trash", iconName: "Trash2", labelKey: "view.trash" },
  // ── 探索与工具 ──
  { id: "insights", iconName: "BarChart3", labelKey: "view.insights" },
  { id: "trending", iconName: "TrendingUp", labelKey: "view.trending" },
  { id: "devtools", iconName: "Wrench", labelKey: "view.devtools" },
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
