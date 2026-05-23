/**
 * 标签页与窗口类型定义
 *
 * 浏览器标签页与窗口相关类型
 */

/**
 * 当前打开的浏览器标签页
 *
 * 由 Chrome API（chrome.tabs）返回并经过 sw/adapters 补充 hostname / isCurrentWindow 等冗余字段。
 * 作为"活标签"在内存中流转，关闭后由 closedTabs / undo 系统接管。
 */
export interface LiveTab {
  /** Chrome 标签页唯一标识 */
  id: number;
  /** 标签页 URL */
  url: string;
  /** 标签页标题（截取前 200 字符，避免超长标题撑破布局） */
  title: string;
  /** 网站图标 URL（可能为空，UI 需有 fallback） */
  favIconUrl: string;
  /** 所属窗口 ID */
  windowId: number;
  /** 是否处于无痕模式 */
  incognito: boolean;
  /** 是否已被固定（固定标签排在标签栏最左侧，且宽固定） */
  pinned: boolean;
  /** 是否正在播放音频（UI 可展示小喇叭图标） */
  audible: boolean;
  /** Chrome 原生标签页组 ID（-1 表示未分组） */
  groupId: number;
  /** 最后访问时间戳（ms），用于排序和「最近访问」分组 */
  lastAccessed: number;
  /** URL 的域名部分（冗余存一份，避免运行时重复解析） */
  hostname: string;
  /** 是否位于当前活跃窗口（跨窗口操作时用于区分） */
  isCurrentWindow: boolean;
  /** 标签页是否已被丢弃（休眠），丢弃后释放内存但保留位置 */
  discarded?: boolean;
  /** Chrome 原生 Tab Group 标题（仅当 groupId !== -1 时有值） */
  groupTitle?: string;
  /** Chrome 原生 Tab Group 颜色（仅当 groupId !== -1 时有值） */
  groupColor?: string;
}

/** 特殊 URL 分类（用于决定是否在 UI 中展示/过滤） */
export type SpecialUrlType = 'chrome' | 'file' | 'about' | 'devtools' | 'edge' | 'normal';

/**
 * 窗口摘要信息
 * 由 sw 在 onWindowUpdate 时推送给前端，用于窗口切换和统计。
 */
export interface WindowInfo {
  /** 窗口 ID（Chrome 分配） */
  id: number;
  /** 窗口是否处于聚焦状态 */
  focused: boolean;
  /** 窗口类型（'normal' | 'popup' | 'devtools' 等） */
  type: string;
  /** 是否无痕窗口 */
  incognito: boolean;
  /** 该窗口当前打开的标签数 */
  tabsCount: number;
}
