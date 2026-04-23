/**
 * 视图配置中心
 *
 * 所有视图相关的元数据（ID、图标、文案 key、组件）集中在此定义，
 * 新增视图只需改这一处，App.tsx 和 SettingsPanel 自动同步。
 */

import type { ComponentType } from 'react';
import {
  AppstoreOutlined,
  ClockCircleOutlined,
  UnorderedListOutlined,
  TableOutlined,
  FireOutlined,
  GroupOutlined,
  BlockOutlined,
  BookOutlined,
} from '@ant-design/icons';

export type ViewMode = 'domain' | 'timeline' | 'compact' | 'grid' | 'frequency' | 'tabgroup' | 'window' | 'bookmarks';

export interface ViewConfig {
  id: ViewMode;
  /** 图标组件引用，消费处自行 <Icon /> 渲染 */
  Icon: ComponentType;
  labelKey: string;
}

export const VIEW_CONFIGS: ViewConfig[] = [
  { id: 'domain', Icon: AppstoreOutlined, labelKey: 'view.domain' },
  { id: 'tabgroup', Icon: GroupOutlined, labelKey: 'view.tabgroup' },
  { id: 'window', Icon: BlockOutlined, labelKey: 'view.window' },
  { id: 'bookmarks', Icon: BookOutlined, labelKey: 'view.bookmarks' },
  { id: 'timeline', Icon: ClockCircleOutlined, labelKey: 'view.timeline' },
  { id: 'compact', Icon: UnorderedListOutlined, labelKey: 'view.compact' },
  { id: 'grid', Icon: TableOutlined, labelKey: 'view.grid' },
  { id: 'frequency', Icon: FireOutlined, labelKey: 'view.frequency' },
];

/** 合法的 ViewMode 值数组，用于防御旧版残留值 */
export const VALID_VIEWS: ViewMode[] = VIEW_CONFIGS.map((v) => v.id);

/** 快速查找表 */
export const VIEW_MAP = new Map<ViewMode, ViewConfig>(VIEW_CONFIGS.map((v) => [v.id, v]));
