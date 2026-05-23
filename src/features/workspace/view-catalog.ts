import { lazy, type ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  BookOpen,
  Clock,
  Columns,
  Flame,
  Layers,
  LayoutGrid,
  List,
  Monitor,
  Table2,
} from 'lucide-react';
import { DomainGroupView } from '@/features/tabs/DomainGroupView';
import type { ViewMode } from '@/shared/types';

/**
 * 工作区视图配置目录
 *
 * 集中管理所有可用的工作区视图模式，包括：
 * - 视图组件定义与懒加载
 * - 视图图标与国际化 key
 * - 视图显示顺序
 *
 * 新增视图时，只需在此文件的 WORKSPACE_VIEW_CONFIGS 数组中添加配置项，
 * 无需修改其他文件（遵循开放封闭原则）。
 */

/** 工作区视图组件类型 */
type WorkspaceViewComponent = ComponentType;

/** 工作区视图配置项 */
export interface WorkspaceViewConfig {
  /** 视图模式标识（与 ViewMode 类型一致） */
  id: ViewMode;
  /** 视图图标（lucide-react 图标组件） */
  Icon: LucideIcon;
  /** 国际化翻译 key（对应 i18n 配置文件） */
  labelKey: string;
  /** 视图显示顺序（数字越小越靠前） */
  order: number;
  /** 视图对应的 React 组件（懒加载） */
  component: WorkspaceViewComponent;
}

// ── 视图组件懒加载 ─────────────────────────────────────────
// 使用 React.lazy 实现代码分割，按需加载视图组件
// 每个视图组件独立打包，减少首屏加载时间

/** 时间线视图 - 按时间轴展示标签 */
const TimelineView = lazy(() => import('@/features/tabs/TimelineView').then((module) => ({ default: module.TimelineView })));
/** 紧凑列表视图 - 紧凑模式展示标签列表 */
const CompactView = lazy(() => import('@/features/tabs/CompactView').then((module) => ({ default: module.CompactView })));
/** 网格视图 - 卡片网格展示标签 */
const GridView = lazy(() => import('@/features/tabs/GridView').then((module) => ({ default: module.GridView })));
/** 访问频率视图 - 按访问频率排序展示 */
const FrequencyView = lazy(() => import('@/features/tabs/FrequencyView').then((module) => ({ default: module.FrequencyView })));
/** 标签组视图 - 按 Chrome 标签组聚合展示 */
const TabGroupView = lazy(() => import('@/features/tabs/TabGroupView').then((module) => ({ default: module.TabGroupView })));
/** 窗口视图 - 按浏览器窗口分组展示 */
const WindowView = lazy(() => import('@/features/tabs/WindowView'));
/** 书签视图 - 展示用户书签 */
const BookmarkView = lazy(() => import('@/features/tabs/BookmarkView').then((module) => ({ default: module.BookmarkView })));
/** 看板视图 - 类 Trello 看板布局 */
const KanbanView = lazy(() => import('@/features/tabs/KanbanView').then((module) => ({ default: module.KanbanView })));
/** 归档视图 - 展示已归档的会话 */
const ArchiveView = lazy(() => import('@/features/sessions/ArchiveView').then((module) => ({ default: module.ArchiveView })));

// ── 视图注册表 ─────────────────────────────────────────────
// 所有可用视图的配置数组，按 order 字段排序后展示

/** 工作区视图配置列表（按 order 升序排列） */
export const WORKSPACE_VIEW_CONFIGS: WorkspaceViewConfig[] = [
  { id: 'domain', Icon: LayoutGrid, labelKey: 'view.domain', order: 1, component: DomainGroupView },
  { id: 'compact', Icon: List, labelKey: 'view.compact', order: 2, component: CompactView },
  { id: 'timeline', Icon: Clock, labelKey: 'view.timeline', order: 3, component: TimelineView },
  { id: 'tabgroup', Icon: Layers, labelKey: 'view.tabgroup', order: 4, component: TabGroupView },
  { id: 'window', Icon: Monitor, labelKey: 'view.window', order: 5, component: WindowView },
  { id: 'kanban', Icon: Columns, labelKey: 'view.kanban', order: 6, component: KanbanView },
  { id: 'bookmarks', Icon: BookOpen, labelKey: 'view.bookmarks', order: 7, component: BookmarkView },
  { id: 'frequency', Icon: Flame, labelKey: 'view.frequency', order: 8, component: FrequencyView },
  { id: 'grid', Icon: Table2, labelKey: 'view.grid', order: 9, component: GridView },
  { id: 'archive', Icon: Archive, labelKey: 'view.archive', order: 10, component: ArchiveView },
];

// ── 视图查询工具函数 ────────────────────────────────────────

/** 有效视图模式列表（从配置中自动提取） */
const workspaceViewComponentMap = Object.fromEntries(
  WORKSPACE_VIEW_CONFIGS.map((view) => [view.id, view.component]),
) as Record<ViewMode, WorkspaceViewComponent>;

/** 所有有效的视图模式 ID 列表 */
export const VALID_VIEWS: ViewMode[] = WORKSPACE_VIEW_CONFIGS.map((view) => view.id);

/**
 * 根据视图模式获取对应的 React 组件
 *
 * @param viewMode - 视图模式标识
 * @returns 对应的 React 组件，若视图模式无效则返回 null
 */
export function getWorkspaceViewComponent(viewMode: ViewMode): WorkspaceViewComponent | null {
  return workspaceViewComponentMap[viewMode] ?? null;
}

/**
 * 验证给定的字符串是否为有效的视图模式
 *
 * @param viewMode - 待验证的字符串
 * @returns 若为有效视图模式则返回 true，并将参数缩窄为 ViewMode 类型
 */
export function isValidViewMode(viewMode: string): viewMode is ViewMode {
  return VALID_VIEWS.includes(viewMode as ViewMode);
}
