import type { ChromeTabGroupColor } from "@/chrome/tabGroups";

/**
 * Tab & Window Type Definitions
 * 浏览器标签页与窗口相关类型
 */

/** Represents a live (currently open) browser tab */
export interface LiveTab {
  id: number;
  url: string;
  title: string;
  favIconUrl: string;
  windowId: number;
  incognito: boolean;
  pinned: boolean;
  audible: boolean;
  groupId: number;
  lastAccessed: number;
  hostname: string;
  isCurrentWindow: boolean;
  /** 标签页是否已被丢弃（休眠），丢弃后释放内存但保留位置 */
  discarded?: boolean;
  /** Chrome 原生 Tab Group 标题（仅当 groupId !== -1 时有值） */
  groupTitle?: string;
  /** Chrome 原生 Tab Group 颜色（仅当 groupId !== -1 时有值） */
  groupColor?: ChromeTabGroupColor;
  /** Chrome 原生 Tab Group 是否折叠（仅当 groupId !== -1 时有值） */
  groupCollapsed?: boolean;
}

/** Special URL classification */
export type SpecialUrlType = "chrome" | "file" | "about" | "devtools" | "edge" | "normal";

/** Window information */
export interface WindowInfo {
  id: number;
  focused: boolean;
  type: string;
  incognito: boolean;
  tabsCount: number;
}
