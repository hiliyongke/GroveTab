/**
 * 视图配置中心
 *
 * 所有视图相关的元数据（ID、图标、文案 key、组件）集中在此定义，
 * 新增视图只需改这一处，App.tsx 和 SettingsPanel 自动同步。
 */

import type { LucideIcon } from 'lucide-react';
import {
  LayoutGrid,
  Clock,
  List,
  Table2,
  Flame,
  Layers,
  Monitor,
  Columns,
} from 'lucide-react';

export type ViewMode = 'domain' | 'timeline' | 'compact' | 'grid' | 'frequency' | 'tabgroup' | 'window' | 'kanban' | 'archive';

export interface ViewConfig {
  id: ViewMode;
  /** 图标组件引用，消费处自行 <Icon /> 渲染 */
  Icon: LucideIcon;
  labelKey: string;
}

export const VIEW_CONFIGS: ViewConfig[] = [
  { id: 'domain', Icon: LayoutGrid, labelKey: 'view.domain' },
  { id: 'compact', Icon: List, labelKey: 'view.compact' },
  { id: 'timeline', Icon: Clock, labelKey: 'view.timeline' },
  { id: 'tabgroup', Icon: Layers, labelKey: 'view.tabgroup' },
  { id: 'window', Icon: Monitor, labelKey: 'view.window' },
  { id: 'kanban', Icon: Columns, labelKey: 'view.kanban' },
  { id: 'frequency', Icon: Flame, labelKey: 'view.frequency' },
  { id: 'grid', Icon: Table2, labelKey: 'view.grid' },
];

/** 合法的 ViewMode 值数组，用于防御旧版残留值 */
export const VALID_VIEWS: ViewMode[] = VIEW_CONFIGS.map((v) => v.id);
