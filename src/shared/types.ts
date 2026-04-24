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
  | 'canopy_metrics'
  | 'canopy_metric_counters'
  | 'canopy_onboarding_done'
  | 'canopy_search_history'
  | 'canopy_activity'
  | 'canopy_workspaces'
  | 'canopy_kanban'
  | 'canopy_og_index'
  | 'canopy_auto_snapshot_meta';

/** Storage metadata */
export interface StorageMeta {
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
}

/** User settings */
export type SearchScopeField = 'title' | 'hostname' | 'url';
export type SearchSortMode = 'relevance' | 'recentAccess';
export type SearchEngineId = 'google' | 'bing' | 'baidu' | 'duckduckgo';

export interface UserSettings {
  overrideNewTab: boolean;
  defaultView: 'domain' | 'timeline' | 'compact' | 'grid' | 'frequency' | 'tabgroup' | 'window' | 'bookmarks' | 'kanban';
  theme: 'light' | 'dark' | 'system';
  /**
   * 皮肤预设：
   *   - 'minimal'        ：极简毛玻璃（macOS 原生风格，默认）
   *   - 'glassmorphism'  ：液态玻璃风（WWDC 2025 / visionOS 风格）
   *   - 'skeuomorphism'  ：拟物风（锤子 UI / iOS 6 风格）
   *   - 'aurora'         ：极光流彩（暗色霓虹渐变风格）
   *   - 'elegant'        ：典雅新古典（衬线标题 + 金色描边 + 纸张质感）
   */
  skinPreset?: 'minimal' | 'glassmorphism' | 'skeuomorphism' | 'aurora' | 'elegant';
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
  /**
   * 域名分组的排序方式：
   *   - 'tabCount'（默认）：按组内标签数量降序，标签多的排前面
   *   - 'alphabetical'：按域名字母升序（A→Z）
   *   - 'recentAccess'：按组内最近访问时间降序，最近活跃的排前面
   */
  domainGroupSortBy?: 'tabCount' | 'alphabetical' | 'recentAccess';
  /**
   * 搜索配置：
   *   - scope：搜索范围，选择哪些字段参与搜索匹配
   *   - enablePinyin：是否启用拼音搜索（关闭后跳过 pinyin-pro 计算，略省性能）
   *   - sortBy：搜索结果排序方式
   *   - defaultEngine：默认网页搜索引擎
   *   - enabledEngines：搜索框中可切换的引擎列表
   *   - autoFallbackToWeb：本地标签页未命中时是否优先给出全网搜索动作
   *   - useHistorySuggestions：是否启用浏览器历史建议
   *   - useHotSuggestions：是否启用热门关键词建议
   */
  searchScope?: SearchScopeField[];
  searchEnablePinyin?: boolean;
  searchSortBy?: SearchSortMode;
  searchDefaultEngine?: SearchEngineId;
  searchEnabledEngines?: SearchEngineId[];
  searchAutoFallbackToWeb?: boolean;
  searchUseHistorySuggestions?: boolean;
  searchUseHotSuggestions?: boolean;
  /**
   * 自定义快捷键映射（页面内快捷键）
   *   - key: KeybindingAction（'search' | 'exitSelection' | 'selectAll'）
   *   - value: 快捷键字符串（如 'Mod+k'、'Escape'、'Mod+a'）
   * 未设置的动作使用 KEYBINDING_DEFS 中的默认值。
   */
  customKeybindings?: Record<string, string>;

  // ── 高级外观定制 ──────────────────────────────────

  /**
   * 自定义背景图配置
   *   - url：图片 URL（支持 https 外链或 data: base64）
   *   - fit：填充模式，'cover' 铺满裁切 / 'contain' 完整显示 / 'repeat' 平铺
   *   - position：定位（仅 cover/contain 生效），默认 'center'
   * 当设置 url 后，背景图会叠加在渐变背景之上（渐变作为 fallback）。
   */
  backgroundImage?: {
    url: string;
    fit: 'cover' | 'contain' | 'repeat';
    position?: string;
  };

  /**
   * 背景遮罩层配置
   *   - enabled：是否在背景图/渐变上叠加一层半透明遮罩
   *   - color：遮罩颜色（含透明度），如 'rgba(0,0,0,0.4)'
   *   - colorDark：深色模式遮罩颜色
   *   - blur：遮罩下方背景模糊（px），0 为不模糊
   * 用于让文字在复杂背景图上保持可读性。
   */
  backgroundOverlay?: {
    enabled: boolean;
    color: string;
    colorDark: string;
    blur: number;
  };

  /**
   * 布局密度：
   *   - 'compact'：紧凑（小间距、小字号、适合信息密度优先）
   *   - 'default'（默认）：舒适平衡
   *   - 'comfortable'：宽松（大间距、大字号、适合大屏或视觉舒适优先）
   * 影响卡片间距、内容行间距、控件高度等全局比例。
   */
  layoutDensity?: 'compact' | 'default' | 'comfortable';

  /**
   * 内容区最大宽度（px），0 表示不限制
   * 默认 1360；极客用户可能想在超宽屏上更宽或更窄。
   */
  contentMaxWidth?: number;

  /**
   * 减弱动效：
   *   - 'auto'（默认）：尊重系统 prefers-reduced-motion
   *   - 'on'：始终减弱动效（关闭过渡动画、hover 上浮等）
   *   - 'off'：始终启用动效，忽略系统偏好
   */
  reducedMotion?: 'auto' | 'on' | 'off';

  /**
   * UI 区域显隐控制
   *   - header：顶栏（品牌 + 操作按钮）
   *   - heroSearch：Hero 区大搜索框
   *   - viewSwitcher：视图切换标签行
   *   - workspaceOverview：工作区概览卡片
   *   - tidySuggestion：智能整理建议栏
   *   - activityStrip：最近操作状态区（Activity Strip）
   * 关闭某区域后该区域不渲染，节省空间、减少视觉噪音。
   */
  uiVisibility?: {
    header?: boolean;
    heroSearch?: boolean;
    viewSwitcher?: boolean;
    workspaceOverview?: boolean;
    tidySuggestion?: boolean;
    activityStrip?: boolean;
  };

  // ── v1.0 封板新增字段 ──────────────────────────────

  /**
   * 去重严格度（F-13）：
   *   - 'strict'：URL 完全相同
   *   - 'loose'（默认）：忽略 #hash + utm_* / fbclid / gclid
   *   - 'off'：禁用重复检测
   */
  dedupStrictness?: 'strict' | 'loose' | 'off';

  /**
   * 闲置阈值（分钟），用于 detectIdleTabs 与 Dashboard 闲置徽标。
   * 候选值：360(6h) / 720(12h) / 1440(24h，默认) / 4320(3d) / 10080(7d)。
   */
  idleThresholdMinutes?: number;

  /**
   * Undo 撤销窗口（秒），范围 3-10，默认 5。
   */
  undoWindowSeconds?: number;

  /**
   * 标签页关闭阈值（多窗口合并/批量关闭前二次确认的阈值），默认 20。
   */
  closeConfirmThreshold?: number;

  /**
   * 会话自动快照频率（F-23）：'off' | '6h' | '12h'（默认） | '24h'。
   */
  autoSnapshotFrequency?: 'off' | '6h' | '12h' | '24h';

  /**
   * OG description 受控抓取开关（F-24），默认 false。
   * 开启时会向用户申请 <all_urls> 权限。
   */
  enableOgFetch?: boolean;

  /**
   * 最后激活的 Workspace id（F-29），页面刷新时用于恢复选中状态。
   */
  lastActiveWorkspaceId?: string;
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
  /**
   * 归档场景专用：对应刚创建的 ArchivedSession.id，
   * UndoToast 据此展示「查看归档」按钮。
   */
  archivedSessionId?: string;
  /**
   * 子行文案，如「（M 个关闭失败）」等次要提示。
   */
  subNote?: string;
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
  /**
   * 是否为隐藏会话（F-23 自动快照）。
   * hidden=true 的会话默认在 ArchivePanel 收起到"自动快照"折叠区。
   */
  hidden?: boolean;
  /**
   * 会话来源类型，默认 'manual'。'auto' 表示由自动快照创建。
   */
  source?: 'manual' | 'auto' | 'import' | 'kanban';
}

// ── Activity Strip / Recent Activity (F-27) ───────────

export type ActivityType =
  | 'archive'
  | 'restore'
  | 'import'
  | 'export'
  | 'permission'
  | 'clear_archive'
  | 'dedup_merge'
  | 'snapshot';

export interface ActivityAction {
  id: string;
  label: string;
  /** 行动按钮类型：undo 调用 undoGroup；open 跳转面板；custom 由调用方处理 */
  kind: 'undo' | 'open_archive' | 'open_import_result' | 'custom';
  /** 可选负载：undo 时为 undoGroupId；open_archive 时为 sessionId */
  payload?: string;
}

export interface ActivityRecord {
  id: string;
  type: ActivityType;
  ts: number;
  /** 一句话摘要，如 "已归档 32 个标签到「4月24日 15:02」" */
  summary: string;
  icon?: string;
  primaryAction?: ActivityAction;
  secondaryAction?: ActivityAction;
  /** 如果对应 undo-slice 中的 UndoGroup，记录其 id 以便回滚 */
  undoGroupId?: string;
}

// ── Search History & Tag metadata (F-05b / F-12) ─────

export interface SearchHistoryEntry {
  query: string;
  ts: number;
  /** 累计搜索次数（用于"热门关键词"排序） */
  count: number;
}

export interface TagEntry {
  name: string;
  /** 基于 tag 字符串 hash 稳定生成的 HSL 色（主色） */
  color: string;
  /** 使用次数 */
  count: number;
  /** 创建时间 */
  createdAt: number;
}

// ── Workspace (F-29) ──────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  filter: {
    tagIds?: string[];
    domains?: string[];
  };
  createdAt: number;
}

// ── Kanban (F-20) ─────────────────────────────────────

export interface KanbanCard {
  url: string;
  title: string;
  favIconUrl?: string;
  addedAt: number;
}

export interface KanbanColumn {
  id: string;
  name: string;
  color?: string;
  cards: KanbanCard[];
}

export interface KanbanLayout {
  columns: KanbanColumn[];
  updatedAt: number;
}

// ── Stats (F-11) ──────────────────────────────────────

/** 按 URL × day 聚合的激活次数 */
export interface StatsRecord {
  /** 日期字符串 YYYY-MM-DD */
  day: string;
  /** URL → 激活次数 */
  counts: Record<string, number>;
}

export interface StatsData {
  /** 最近 30 天的日统计 */
  daily: StatsRecord[];
  /** 最近一次持久化时间 */
  lastFlushAt: number;
}

// ── OG Index (F-24) ───────────────────────────────────

export interface OgEntry {
  url: string;
  title: string;
  description: string;
  fetchedAt: number;
}

// ── Auto Snapshot Meta (F-23) ─────────────────────────

export interface AutoSnapshotMeta {
  /** 最后一次自动快照时间戳 */
  lastSnapshotAt: number;
}

// ── Local Metrics (§17) ───────────────────────────────

export interface MetricEvent {
  event: string;
  ts: number;
  payload?: Record<string, unknown>;
}
