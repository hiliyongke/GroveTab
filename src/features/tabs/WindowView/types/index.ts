/**
 * WindowView 类型定义
 */

import type { LiveTab } from '@/shared/types/tab';

/** 拖拽数据类型：区分「窗口内标签」「跨窗口拖放目标」「分组拖入区」「分组标签」 */
export type DragData =
  | { kind: 'tab'; tabId: number; windowId: number; url: string }
  | { kind: 'window-drop-zone'; windowId: number }
  | { kind: 'group-zone'; windowId: number }
  | { kind: 'group-label'; groupId: number; windowId: number };

export interface ActiveDrag {
  id: string;
  data: DragData;
}

/** 智能排序规则 */
export type SmartSortRule = 'domain' | 'recentAccess' | 'alphabetical' | 'type';

/** Chrome Tab Group 可选颜色 */
export const GROUP_COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'] as const;
export type GroupColor = typeof GROUP_COLORS[number];

/** 标签分组信息（用于 WindowCard 内部按分组展示） */
export interface TabGroupInfo {
  groupId: number;
  groupTitle?: string;
  groupColor?: string;
  tabs: LiveTab[];
}

/** WindowCard 组件 Props */
export interface WindowCardProps {
  windowId: number;
  windowTabs: LiveTab[];
  windowInfo: { focused?: boolean; state?: string } | undefined;
  isCurrent: boolean;
  allTabIds: number[];
  jumpToTab: (id: number, wid: number) => void;
  closeSingleTab: (id: number) => void;
  activeDrag: ActiveDrag | null;
  t: (key: string, params?: Record<string, string | number>) => string;
  token: {
    colorBorderSecondary: string;
    colorBorder: string;
    colorText: string;
    colorTextTertiary: string;
    colorFillSecondary: string;
  };
  reduced: boolean;
  altHeld: boolean;
  onThumbnailHover: (windowId: number) => void;
  onThumbnailLeave: () => void;
  thumbnailUrl: string | null;
}

/** GroupLabel 组件 Props */
export interface GroupLabelProps {
  groupId: number;
  groupTitle?: string;
  groupColor?: string;
  windowId: number;
  tabs: LiveTab[];
  t: (key: string, params?: Record<string, string | number>) => string;
}

/** GroupContextMenu 组件 Props */
export interface GroupContextMenuProps {
  x: number;
  y: number;
  groupId: number;
  groupTitle?: string;
  groupColor?: string;
  onClose: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

/** SortableTabItem 组件 Props */
export interface SortableTabItemProps {
  tab: LiveTab;
  windowId: number;
  onJump: (tabId: number, windowId: number) => void;
  onClose: (tabId: number) => void;
  showHostname?: boolean;
  selectable?: boolean;
  visibleTabIds?: number[];
  reduced: boolean;
}

/** DragPreview 组件 Props */
export interface DragPreviewProps {
  active: ActiveDrag;
  t: (key: string) => string;
  isAltHeld: boolean;
}
