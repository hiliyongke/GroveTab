/**
 * Canopy — Chrome Extension Type Definitions
 * Shared types for the entire extension.
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
  groupColor?: string;
}

/** Special URL classification */
export type SpecialUrlType = 'chrome' | 'file' | 'about' | 'devtools' | 'edge' | 'normal';

/** Window information */
export interface WindowInfo {
  id: number;
  focused: boolean;
  type: string;
  incognito: boolean;
  tabsCount: number;
}

/** Broadcast message types from SW to new tab pages */
export type SwBroadcastType =
  | 'tab-created'
  | 'tab-updated'
  | 'tab-removed'
  | 'tab-activated'
  | 'tab-moved'
  | 'tab-discarded'
  | 'window-focus-changed';

export interface SwBroadcastMessage {
  type: SwBroadcastType;
  payload: Record<string, unknown>;
  timestamp: number;
}

/** Storage keys for partitioned storage */
export type StorageKey =
  | 'canopy_tabs'
  | 'canopy_sessions'
  | 'canopy_settings'
  | 'canopy_tags'
  | 'canopy_notes'
  | 'canopy_pins'
  | 'canopy_undo'
  | 'canopy_stats'
  | 'canopy_snapshots'
  | 'canopy_meta'
  | 'canopy_metrics';

/** Storage metadata */
export interface StorageMeta {
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
}

/** User settings */
export interface UserSettings {
  overrideNewTab: boolean;
  defaultView: 'domain' | 'timeline' | 'compact' | 'grid' | 'frequency' | 'tabgroup' | 'window' | 'bookmarks';
  theme: 'light' | 'dark' | 'system';
  /**
   * 背景渐变预设：
   *   - 'default'   ：antd 默认色，最干净
   *   - 'slate'     ：浅灰蓝渐变（浅色友好）
   *   - 'warm'      ：暖米色渐变（浅色友好）
   *   - 'ocean'     ：蓝绿海洋渐变（双模自适应）
   *   - 'forest'    ：深绿渐变（双模自适应）
   *   - 'sunset'    ：晚霞橙紫渐变（双模自适应）
   *   - 'deepspace' ：深空蓝黑渐变（深色友好）
   *   - 'midnight'  ：午夜深蓝渐变（深色友好）
   *   - 'custom'    ：用户自定义（暂未开放编辑器）
   *
   * 每个预设包含 light / dark 两套色值，运行期按 resolvedTheme 自动切换。
   */
  gradientPreset:
    | 'default'
    | 'slate'
    | 'warm'
    | 'ocean'
    | 'forest'
    | 'sunset'
    | 'deepspace'
    | 'midnight'
    | 'custom';
  /**
   * 自定义渐变配置（仅 gradientPreset='custom' 时生效）
   *   - stops：色标数组，每项 { color: '#hex', position: 0~1 }
   *   - angle：渐变角度（度），默认 135
   *   - darkStops / darkAngle：深色模式独立配置，不填则用 stops / angle 的暗化版本
   */
  customGradient?: {
    stops: Array<{ color: string; position: number }>;
    angle: number;
    darkStops?: Array<{ color: string; position: number }>;
    darkAngle?: number;
  };
  showIncognito: boolean;
  language: 'zh-CN' | 'en';
  /** 域名分组视图的列数；'auto' 表示由容器宽度自动决定（默认），1–6 为手动锁定 */
  domainGroupColumns?: 'auto' | 1 | 2 | 3 | 4 | 5 | 6;
  /**
   * 时间轴分组粒度：
   *   - 'day' ：今天/昨天/本周/更早（默认，简洁）
   *   - 'hour'：今天 + 昨天都按「整点小时」桶细分并倒序，本周/更早仍按天
   *
   * 旧版本曾有第三档 'fine'（与 'hour' 行为高度重叠），已废弃。
   * 类型里保留该字面量仅为兼容已写入磁盘的旧设置，运行期会规整为 'hour'。
   */
  timelineGranularity?: 'day' | 'hour' | 'fine';
  /**
   * 时间轴是否在段名和条目上显示具体时间
   *   - 段名右侧显示该段访问时间范围（如 14:32–15:48），单条时显示单个时间
   *   - 每个 TabItem 右侧显示该条访问时间（HH:mm）
   * 默认关闭；需要更精确的时间定位时打开。
   */
  timelineShowExactTime?: boolean;
  /**
   * 域名分组视图：子项（TabItem）是否显示 favicon。
   *   - true（默认）：每条子项左侧显示该 tab 自己的 favicon
   *   - false：子项不展示 favicon，仅靠卡片头部的域名 icon 识别归属
   * 适合 favicon 被 CORS 拦截较多、或偏好紧凑视觉的用户。
   */
  domainGroupShowItemFavicon?: boolean;
  /**
   * 域名分组卡片的身份色条位置：
   *   - 'left'（默认）：左侧 2px 竖条，贴卡片左边缘，多卡并排像"索引色签"
   *   - 'top'：顶部 3px 横条，传统网盘/邮件客户端风格，信息从上往下读
   *   - 'none'：完全隐藏身份色条（favicon 徽章的软色背景仍保留）
   * 两种色条都使用依主题自适应的纯实色（非渐变），视觉纪律一致。
   */
  domainGroupAccentBarPosition?: 'left' | 'top' | 'none';
  /**
   * 域名分组卡片的圆角档位：
   *   - 'none'：直角（0px），硬朗正式
   *   - 'small'：小圆角（4px），轻微柔化
   *   - 'default'（默认）：沿用 antd `borderRadiusLG`（8px），与全站基调一致
   *   - 'large'：大圆角（16px），更柔和更"现代"
   * 影响 Card 本身及左/顶色条的同侧圆角。
   */
  domainGroupCardRadius?: 'none' | 'small' | 'default' | 'large';
}

// ── Undo System ───────────────────────────────────────

export interface ClosedTabSnapshot {
  url: string;
  title: string;
  favIconUrl: string;
  windowId: number;
  pinned: boolean;
}

export interface UndoRecord {
  id: string;
  createdAt: number;
  tabs: ClosedTabSnapshot[];
  description: string;
  expired: boolean;
}

// ── Archive / Sessions ────────────────────────────────

/** An archived tab entry */
export interface ArchivedTab {
  url: string;
  title: string;
  favIconUrl: string;
  hostname: string;
  pinned: boolean;
}

/** An archived session (group of tabs saved at once) */
export interface ArchivedSession {
  id: string;
  name: string;
  createdAt: number;
  tabs: ArchivedTab[];
  /** Tab count for quick display */
  tabCount: number;
}
