/**
 * Chrome Extension Type Definitions
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

/** 分区存储键；实际前缀由品牌命名空间配置生成。 */
export type StorageKey = `${string}_${string}`;

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

export type DashboardWidgetType =
  | 'clock'
  | 'weather'
  | 'calendar'
  | 'dailyQuote'
  | 'speedDial'
  | 'pomodoro'
  | 'todo'
  | 'sticky'
  | 'countdown'
  | 'workCountdown'
  | 'searchBox'
  | 'waterReminder'
  | 'habitTracker'
  | 'timestampTool'
  | 'jsonFormatter'
  | 'networkInfo';

export interface HabitEntry {
  id: string;
  name: string;
  emoji?: string;
  /** YYYY-MM-DD 打卡日期集合 */
  records: string[];
}

export interface WaterReminderState {
  goalCups?: number;
  currentCups?: number;
  lastDate?: string;
  intervalMinutes?: number;
}

export type DashboardQuoteCategory = 'aphorism' | 'renmin' | 'poetry' | 'essay' | 'custom';

export interface DashboardWidgetLayoutItem {
  id: string;
  type: DashboardWidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  title?: string;
}

export interface SpeedDialLink {
  id: string;
  title: string;
  url: string;
  emoji?: string;
  color?: string;
}

export interface SpeedDialGroup {
  id: string;
  name: string;
  links: SpeedDialLink[];
}

export interface CustomQuoteEntry {
  id: string;
  text: string;
  source: string;
  category: 'custom';
}

export interface CountdownEntry {
  id: string;
  title: string;
  targetDate: string;
  emoji?: string;
  description?: string;
  color?: string;
}

export interface TodoEntry {
  id: string;
  text: string;
  done: boolean;
  /** 勾选完成时的时间戳，用于"已完成超 24h 自动折叠" */
  completedAt?: number;
}

/** StickyNote 色板代号（配合 StickyWidget 多色升级，v1.3） */
export type StickyNoteColor = 'yellow' | 'pink' | 'green' | 'blue' | 'purple';

export interface StickyNoteEntry {
  id: string;
  title?: string;
  content: string;
  /**
   * 兼容：旧数据可能是 #RGB 色值；v1.3 起改用 StickyNoteColor 代号。
   * 读取时由 UI 层 `resolveStickyColor` 统一解析。
   */
  color?: string;
}

export type NewtabPageMode = 'workspace' | 'fishpond' | 'trending' | 'devtools';

export interface UserSettings {
  overrideNewTab: boolean;
  /** 新标签页一级空间：workspace 专注标签整理；fishpond 承载个性化与小组件；trending 全网热榜；devtools 开发工具栏。 */
  newtabPageMode?: NewtabPageMode;
  defaultView: 'domain' | 'timeline' | 'compact' | 'grid' | 'frequency' | 'tabgroup' | 'window' | 'bookmarks' | 'kanban';
  theme: 'light' | 'dark' | 'system';
  /**
   * 皮肤预设：
   *   - 'minimal'        ：极简毛玻璃（macOS 原生风格，默认）
   *   - 'glassmorphism'  ：液态玻璃风（WWDC 2025 / visionOS 风格）
   *   - 'skeuomorphism'  ：拟物风（锤子 UI / iOS 6 风格）
   *   - 'aurora'         ：极光流彩（暗色霓虹渐变风格）
   *   - 'elegant'        ：典雅新古典（衬线标题 + 金色描边 + 纸张质感）
   *   - 'nord'           ：Nord 寒色调（深蓝青冷，深浅皆宜）
   *   - 'solarized'      ：Solarized 太阳化（暖米 + 青黄对比）
   */
  skinPreset?: 'minimal' | 'glassmorphism' | 'skeuomorphism' | 'aurora' | 'elegant' | 'nord' | 'solarized' | 'pastel' | 'apple';

  /**
   * UI Token 极客定制（v1.1 新增）：在皮肤预设基础上做单项覆盖。
   *
   * 与预设的关系：
   *   最终 token = getSkinPreset(skinPreset) 的默认值  ×  本字段的 override
   * 未设置的子字段 → 保留预设默认；设置的子字段 → 覆盖。
   * 单独给极客用户用，普通用户切预设足矣。
   *
   * 字段约束：
   *   - borderRadius：0-24（px），0 为尖角、24 为高圆角
   *   - fontSize：12-16（px）基准字号
   *   - controlHeight：24-40（px）
   *   - borderWidth：0.5 / 1 / 1.5 / 2
   *   - fontWeightBody / fontWeightHeading：300-800
   *   - colorPrimary：覆盖皮肤主色（HEX）
   */
  skinCustom?: {
    borderRadius?: number;
    fontSize?: number;
    controlHeight?: number;
    borderWidth?: number;
    fontWeightBody?: number;
    fontWeightHeading?: number;
    colorPrimary?: string;
  };
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
    | 'pastel'
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
   * 热词来源（v1.1 新增，精细化控制）：
   *   - 'off'       ：关闭热词（不显示）
   *   - 'local'     ：基于本地搜索历史聚合（默认，零网络）
   *   - 'preset'    ：使用静态预设列表（老行为，作兜底）
   *   - 'trending'  ：预留：未来接入公开热榜时使用；目前等同 off
   *
   * 当 searchUseHotSuggestions === false 时视为 off；否则默认 'local'。
   */
  hotSuggestionSource?: 'off' | 'local' | 'preset' | 'trending';
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
    /** Hero 区品牌 Logo。 */
    heroLogo?: boolean;
    /** Hero 区品牌标题。 */
    heroTitle?: boolean;
    /** Hero 区品牌副标题。 */
    heroSlogan?: boolean;
    heroSearch?: boolean;
    viewSwitcher?: boolean;
    workspaceOverview?: boolean;
    tidySuggestion?: boolean;
    activityStrip?: boolean;
    /**
     * HeroWidgets（时钟/天气/日历）总开关。默认 true。
     */
    heroWidgets?: boolean;
  };

  /**
   * HeroWidgets 精细配置：时钟 / 天气 / 日历 的每项子开关与布局模式。
   * 仅在 `uiVisibility.heroWidgets !== false` 时生效。
   */
  heroWidgets?: {
    /**
     * 布局模式：
     *   - 'trio'（默认）：水平三联（时钟 | 天气 | 日历）
     *   - 'clockOnly'：仅展示时钟（极简）
     *   - 'clockWeather'：仅时钟 + 天气
     *   - 'hidden'：全部隐藏（等效于 uiVisibility.heroWidgets=false）
     */
    layout?: 'trio' | 'clockOnly' | 'clockWeather' | 'hidden';
    /** 时钟开关 */
    clock?: { enabled?: boolean; format24?: boolean; showSeconds?: boolean };
    /**
     * 天气配置：
     *   - mode：'auto'（IP 自动定位）/ 'manual'（手动输入城市）/ 'off'
     *   - city：mode=manual 时使用
     *   - unit：'c'（摄氏）/'f'（华氏）
     */
    weather?: {
      mode?: 'auto' | 'manual' | 'off';
      city?: string;
      unit?: 'c' | 'f';
    };
    /** 日历开关：是否显示农历/节日 */
    calendar?: {
      enabled?: boolean;
      showLunar?: boolean;
      showHolidays?: boolean;
    };
  };

  /**
   * 每日金句 Widget 配置（v1.2）。
   * - enabled：显隐开关（默认 true）
   * - categories：参与抽签的分类（多选；默认四类全开）
   * - fontSize：正文字号（12–20，默认 15）
   * - showSource：是否显示作者/出处（默认 true）
   */
  dailyQuote?: {
    enabled?: boolean;
    categories?: DashboardQuoteCategory[];
    fontSize?: number;
    showSource?: boolean;
    customQuotes?: CustomQuoteEntry[];
  };

  /**
   * 顶部 Widget 画布（开发阶段重构版）。
   * - enabled：总开关
   * - editMode：是否处于自由排版编辑态
   * - columns：桌面端网格列数，默认 12
   * - rowHeight：行高，默认 88
   * - gap：栅格间距，默认 12
   * - items：各 widget 的位置信息与尺寸
   * - availableWidgets：控制“添加组件”抽屉里各类型的启用状态
   */
  dashboardWidgets?: {
    enabled?: boolean;
    editMode?: boolean;
    columns?: number;
    rowHeight?: number;
    gap?: number;
    items?: DashboardWidgetLayoutItem[];
    availableWidgets?: Partial<Record<DashboardWidgetType, boolean>>;
  };

  /** 网站快捷模块配置 */
  speedDial?: {
    enabled?: boolean;
    groups?: SpeedDialGroup[];
    activeGroupId?: string;
    openInNewTab?: boolean;
    showLabels?: boolean;
  };

  /** 番茄钟配置 */
  pomodoro?: {
    enabled?: boolean;
    focusMinutes?: number;
    shortBreakMinutes?: number;
    longBreakMinutes?: number;
    autoStartBreak?: boolean;
  };

  /** 倒计时与纪念日配置 */
  countdowns?: {
    enabled?: boolean;
    items?: CountdownEntry[];
    showPastEvents?: boolean;
  };

  /** 上班人下班倒计时配置 */
  workCountdown?: {
    enabled?: boolean;
    workdayEnd?: string;
    offLabel?: string;
  };

  /** 待办 widget 配置 */
  todoWidget?: {
    enabled?: boolean;
    items?: TodoEntry[];
  };

  /** 便签 widget 配置 */
  stickyNotes?: {
    enabled?: boolean;
    items?: StickyNoteEntry[];
  };

  /** 喝水提醒 widget */
  waterReminder?: WaterReminderState & { enabled?: boolean };

  /** 习惯打卡 widget */
  habitTracker?: {
    enabled?: boolean;
    items?: HabitEntry[];
  };

  /**
   * 全局点击动效（v1.2）。
   *   - 'off'（默认）：无动效
   *   - 'ripple'   ：品牌色涟漪环
   *   - 'sparkle'  ：星光散射
   *   - 'confetti' ：彩纸爆裂
   *   - 'petal'    ：樱花飘落
   * reducedMotion 为 'on' 或系统偏好 reduce 时自动禁用。
   */
  clickEffect?: 'off' | 'ripple' | 'sparkle' | 'confetti' | 'petal';

  /**
   * 动态视频背景（v1.2）。
   *   - type：'none'（默认） / 'url'（外部 URL） / 'file'（本地文件 → blob URL）
   *   - src：视频地址（url 模式）
   *   - objectUrl：文件模式下 IndexedDB 读取后生成的 blob URL（仅内存）
   *   - fileKey：本地 IndexedDB 里的文件主键（用于二次启动时重新恢复）
   *   - playbackRate：0.5 ~ 1.5，默认 1
   *   - muted：默认 true（Chrome 要求 muted 才能 autoplay）
   */
  videoBackground?: {
    type?: 'none' | 'url' | 'file';
    src?: string;
    fileKey?: string;
    playbackRate?: number;
    muted?: boolean;
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

// ── Trending / 热榜聚合 (v1.4) ──────────────────────

/** 热榜平台分类 */
export type TrendingCategory = 'all' | 'comprehensive' | 'tech' | 'entertainment' | 'community' | 'news';

/** 热榜布局模式 */
export type TrendingGroupMode = 'default' | 'compact';

/** 单条热榜条目（标准化后的通用格式） */
export interface TrendingItem {
  /** 条目唯一标识 */
  id: string;
  /** 标题 */
  title: string;
  /** 简介/描述 */
  desc?: string;
  /** 封面图 */
  pic?: string;
  /** 热度值 */
  hot?: number;
  /** 可读的热度文字（如 "1234万"） */
  hotLabel?: string;
  /** PC 端链接 */
  url: string;
  /** 移动端链接 */
  mobileUrl?: string;
  /** 作者/UP主信息 */
  author?: string;
}

/** 单个平台的榜单数据 */
export interface HotBoardData {
  /** 平台调用名称（如 'bilibili'） */
  id: string;
  /** 平台中文名 */
  name: string;
  /** 榜单类别 */
  subtitle?: string;
  /** 分类标签 */
  category: TrendingCategory;
  /** 榜单条目列表 */
  items: TrendingItem[];
  /** 数据获取时间 */
  updateTime?: string;
  /** 数据来源标识 */
  from?: 'dailyhot' | 'pearktrue' | 'xcvts' | 'cache';
}

/** 热榜缓存整体结构 */
export interface TrendingCache {
  /** 按平台 id 索引的榜单数据 */
  boards: Record<string, HotBoardData>;
  /** 最近一次全量刷新时间 */
  lastRefreshAt: number;
}

/** 偷摸模式配置 */
export interface StealthModeConfig {
  /** 是否开启偷摸模式 */
  enabled: boolean;
  /** 伪装页面类型 */
  disguise: 'email' | 'doc' | 'spreadsheet' | 'code';
}
