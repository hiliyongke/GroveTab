/**
 * Settings Type Definitions
 * 用户设置相关类型
 */

/** 标签页关闭确认阈值常量（多窗口合并/批量关闭前二次确认的阈值） */
export const CLOSE_CONFIRM_THRESHOLD = 20 as const;

/** User settings */
export type SearchScopeField = "title" | "hostname" | "url";
export type SearchSortMode = "relevance" | "recentAccess";
export type SearchEngineId = "google" | "bing" | "baidu" | "duckduckgo" | `custom:${string}`;

export interface CustomSearchEngine {
  id: `custom:${string}`;
  label: string;
  searchUrl: string;
  iconUrl?: string;
  color?: string;
}

/** 视图标签栏位置 */
export type ViewTabPosition = "left" | "right";

export interface UserSettings {
  overrideNewTab: boolean;
  /** 视图标签栏位置：left / right（垂直侧栏） */
  viewTabPosition?: ViewTabPosition;
  /** 视图标签栏是否折叠（仅显示图标），默认 false */
  viewTabCollapsed?: boolean;
  defaultView:
    | "domain" // legacy，运行期自动映射为 tabs + tabsLayout='masonry'
    | "tabs"
    | "timeline"
    | "compact" // legacy，运行期自动映射为 tabs + tabsLayout='compact'
    | "grid" // legacy，运行期自动映射为 tabs + tabsLayout='grid'
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
    | "trash"
    | "sessions";
  /**
   * 标签页主视图的布局模式（仅 defaultView='tabs' 时生效）。
   *   - 'masonry'（默认）：按域名分组的瀑布流多列布局（原 domain 视图）
   *   - 'compact'        ：虚拟化紧凑列表（原 compact 视图）
   *   - 'grid'           ：卡片网格（原 grid 视图）
   */
  tabsLayout?: "masonry" | "compact" | "grid";
  theme: "light" | "dark" | "system";
  /**
   * 皮肤预设（4 套经典主题）：
   *   - 'minimal'        ：极简毛玻璃（macOS 原生风格）
   *   - 'glassmorphism'  ：液态亚克力（微软 Fluent Acrylic 风格，默认）
   *   - 'nord'           ：Nord 北欧寒色（冷静青蓝体系）
   *   - 'apple'          ：Apple 官网设计语言（SF Pro + 深色毛玻璃）
   */
  skinPreset?: "minimal" | "glassmorphism" | "nord" | "apple";

  /**
   * UI Token 极客定制：在皮肤预设基础上做单项覆盖。
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
  showIncognito: boolean;
  language: "zh-CN" | "en";
  /** 域名分组视图的列数；'auto' 表示由容器宽度自动决定（默认），1–6 为手动锁定 */
  domainGroupColumns?: "auto" | 1 | 2 | 3 | 4 | 5 | 6;
  /** 窗口视图卡片列数；'auto' 表示按 360px 列宽自适应，1–6 为手动锁定。 */
  windowCardColumns?: "auto" | 1 | 2 | 3 | 4 | 5 | 6;
  /** 窗口卡片内是否展示 Chrome 原生 Tab Group 子区块。 */
  windowCardShowGroupSection?: boolean;
  /** 是否展示窗口/分组末尾的幽灵拖拽落点。 */
  windowCardShowGhostDropZone?: boolean;
  /** 窗口卡片身份色条位置，与域名分组卡片保持一致。 */
  windowCardAccentBarPosition?: "left" | "top" | "none";
  /** 用户自定义的窗口卡片 UI 排序，仅影响 NewTab 内展示，不改变 Chrome 窗口顺序。 */
  windowCardOrder?: number[];
  /** 窗口视图中是否显示标签闲置时长指示器 */
  windowShowIdleTime?: boolean;
  /** 窗口视图中是否显示窗口健康度指示器 */
  windowShowHealthIndicator?: boolean;
  /** 窗口排序模式：'manual' | 'tabCount' | 'name' | 'activity'，默认 'manual' */
  windowSortMode?: "manual" | "tabCount" | "name" | "activity";
  /**
   * 时间轴分组粒度：
   *   - 'day' ：今天/昨天/本周/更早（默认，简洁）
   *   - 'hour'：今天 + 昨天都按「整点小时」桶细分并倒序，本周/更早仍按天
   *
   * 旧版本曾有第三档 'fine'（与 'hour' 行为高度重叠），已废弃。
   * 类型里保留该字面量仅为兼容已写入磁盘的旧设置，运行期会规整为 'hour'。
   */
  timelineGranularity?: "day" | "hour" | "fine";
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
  domainGroupAccentBarPosition?: "left" | "top" | "none";
  /**
   * 域名分组卡片的圆角档位：
   *   - 'none'：直角（0px），硬朗正式
   *   - 'small'：小圆角（4px），轻微柔化
   *   - 'default'（默认）：沿用 antd `borderRadiusLG`（8px），与全站基调一致
   *   - 'large'：大圆角（16px），更柔和更"现代"
   * 影响 Card 本身及左/顶色条的同侧圆角。
   */
  domainGroupCardRadius?: "none" | "small" | "default" | "large";
  /**
   * 域名分组的排序方式：
   *   - 'tabCount'（默认）：按组内标签数量降序，标签多的排前面
   *   - 'alphabetical'：按域名字母升序（A→Z）
   *   - 'recentAccess'：按组内最近访问时间降序，最近活跃的排前面
   */
  domainGroupSortBy?: "tabCount" | "alphabetical" | "recentAccess";
  /**
   * 网格视图卡片的展开触发方式：
   *   - 'click'（默认）：点击多 tab 卡片时弹出 Popover
   *   - 'hover'：鼠标悬停在多 tab 卡片上即展开 Popover，移开自动收起
   * 仅影响多 tab 卡片；单 tab 卡片始终为「点击直跳」。
   */
  gridExpandTrigger?: "click" | "hover";
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
  searchCustomEngines?: CustomSearchEngine[];
  searchAutoFallbackToWeb?: boolean;
  searchUseHistorySuggestions?: boolean;
  searchUseHotSuggestions?: boolean;
  /** 热词来源：'off' | 'local' | 'preset' | 'trending' */
  hotSuggestionSource?: "off" | "local" | "preset" | "trending";
  /**
   * 自定义快捷键映射（页面内快捷键）
   *   - key: KeybindingAction（'search' | 'exitSelection' | 'selectAll'）
   *   - value: 快捷键字符串（如 'Mod+k'、'Escape'、'Mod+a'）
   * 未设置的动作使用 KEYBINDING_DEFS 中的默认值。
   */
  customKeybindings?: Record<string, string>;

  // ── 高级外观定制 ──────────────────────────────────

  /**
   * 布局密度：
   *   - 'compact'：紧凑（小间距、小字号、适合信息密度优先）
   *   - 'default'（默认）：舒适平衡
   *   - 'comfortable'：宽松（大间距、大字号、适合大屏或视觉舒适优先）
   * 影响卡片间距、内容行间距、控件高度等全局比例。
   */
  layoutDensity?: "compact" | "default" | "comfortable";

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
  reducedMotion?: "auto" | "on" | "off";

  /**
   * UI 区域显隐控制
   *   - header：顶栏（品牌 + 操作按钮）
   *   - heroSearch：Hero 区大搜索框
   *   - viewSwitcher：视图切换标签行
   *   - tidySuggestion：智能整理建议栏
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
    tidySuggestion?: boolean;
    /** 常用站点区域 */
    quickStart?: boolean;
  };

  /** 常用站点是否启用分组显示，默认 false（平铺模式） */
  speedDialGroupEnabled?: boolean;

  /** 常用站点布局模式：'stacked'（默认上下堆叠）| 'sidebar'（左右分栏） */
  quickStartLayout?: "stacked" | "sidebar";

  /** 侧栏位置：'left'（默认左侧）| 'right'（右侧） */
  quickStartSidebarPosition?: "left" | "right";

  /** 侧栏宽度（px），用户可通过拖拽调节。默认 64，范围 48-200。 */
  quickStartSidebarWidth?: number;

  /** 是否显示浮动添加按钮（FAB），默认 false */
  quickStartFabAddButton?: boolean;

  /**
   * auto 档位阈值配置（站点数量边界）。
   *   - lgThreshold：站点数 ≤ 此值时使用 lg（默认 6）
   *   - mdThreshold：站点数 ≤ 此值时使用 md（默认 14）
   *   - 超过 mdThreshold 则使用 sm
   */
  quickStartAutoThresholds?: { lgThreshold?: number; mdThreshold?: number };

  /** 分组是否可折叠，默认 true（点击组头折叠/展开） */
  quickStartGroupCollapsible?: boolean;

  /** 分组折叠状态持久化：组名 → 是否折叠 */
  quickStartGroupCollapsed?: Record<string, boolean>;

  /** 常用站点是否显示「添加站点」按钮，默认 true */
  showAddSiteButton?: boolean;

  /** 常用站点卡片尺寸：'sm' | 'md' | 'lg' | 'auto' | 'custom' */
  quickStartCardSize?: "sm" | "md" | "lg" | "auto" | "custom";

  /**
   * 常用站点卡片自定义宽度（px）。
   * 仅 quickStartCardSize 为 'custom' 时生效；离开 custom 后保留数值但不覆盖预设。
   * 范围：80–280，步长 8。
   */
  quickStartCardExactWidth?: number;

  /**
   * 常用站点网格间距（px）。
   * 范围：4–24，步长 4，默认 12。
   * 影响卡片之间的水平与垂直间距。
   */
  quickStartGridGap?: number;

  /** 网格视图卡片尺寸：'sm' | 'md' | 'lg' | 'auto' */
  gridCardSize?: "sm" | "md" | "lg" | "auto";

  /** 全局点击动效：'off' | 'ripple' | 'sparkle' | 'confetti' | 'petal' */
  clickEffect?: "off" | "ripple" | "sparkle" | "confetti" | "petal";

  /** 动态视频背景。 */
  videoBackground?: {
    type?: "none" | "url" | "file";
    src?: string;
    fileKey?: string;
    playbackRate?: number;
    muted?: boolean;
  };

  /**
   * 标签分组视图的排序方式：
   *   - 'tabCount'（默认）：按组内标签数量降序
   *   - 'name'：按分组名称字母升序
   *   - 'recentAccess'：按组内最近访问时间降序
   */
  tabGroupSortBy?: "tabCount" | "name" | "recentAccess";

  /**
   * 去重严格度（F-13）：
   *   - 'strict'：URL 完全相同
   *   - 'loose'（默认）：忽略 #hash + utm_* / fbclid / gclid
   *   - 'off'：禁用重复检测
   */
  dedupStrictness?: "strict" | "loose" | "off";

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
   * 标签页关闭阈值（多窗口合并/批量关闭前二次确认的阈值），默认 {@link CLOSE_CONFIRM_THRESHOLD}。
   */
  closeConfirmThreshold?: number;

  /**
   * 会话自动快照频率（F-23): 'off' | '6h' | '12h'（默认） | '24h'。
   */
  autoSnapshotFrequency?: "off" | "6h" | "12h" | "24h";

  /**
   * OG description 受控抓取开关（F-24），默认 false。
   * 开启时会向用户申请 <all_urls> 权限。
   */
  enableOgFetch?: boolean;

  /**
   * 最后激活的 Workspace id（F-29），页面刷新时用于恢复选中状态。
   */
  lastActiveWorkspaceId?: string;

  /**
   * 轻量配置跨设备同步开关（默认 false，opt-in）。
   * 开启后仅将「设置 + 快捷键」这类轻量配置通过 chrome.storage.sync 在登录同一
   * Chrome 账号的设备间同步；标签页、归档、历史等大数据始终留本地，不参与同步。
   * 采用「最后写入胜」策略，启动时拉取较新的远端配置。
   */
  settingsSyncEnabled?: boolean;

  /**
   * 历史记录主开关（默认 true）。关闭后：
   *   - sw 不再向 closedTabs / historyEvents 写入新记录
   *   - SearchBox 的「最近关闭」section 自动隐藏
   *   - HistoryView 仍可打开查看历史数据，但不会增加新条目
   */
  historyEnabled?: boolean;

  /**
   * 是否记录细粒度的操作时间线（默认 true）。
   * 关闭后只保留「最近关闭」标签快照，不再记录搜索/归档/打标签等事件。
   */
  historyRecordEvents?: boolean;

  /**
   * 「最近关闭」最大条数（默认 50，范围 10–500）。
   * 超出时按时间顺序 FIFO 淘汰。
   */
  historyMaxClosedTabs?: number;

  /**
   * 操作时间线最大条数（默认 500，范围 50–5000）。
   * 超出时按时间顺序 FIFO 淘汰。
   */
  historyMaxEvents?: number;

  /**
   * 「最近关闭」自动过期时间（小时，默认 168 = 7 天）。
   * 0 表示从不过期。
   */
  historyClosedTabsTtlHours?: number;

  /**
   * URL 黑名单（hostname 数组，默认空）。
   * 命中黑名单的 URL 不会被记录到任何历史。
   * 例如：`['mail.google.com', 'localhost']`。
   */
  historyUrlBlocklist?: string[];

  // ── 内存治理（任务7）────────────────────────────────

  /**
   * 标签页使用时长追踪（默认 true）。
   * 开启后 Service Worker 会记录每个标签页的聚焦时长，按 URL × day 聚合。
   * 数据在 TabItem 的 Tooltip 中展示。
   */
  trackTabFocusTime?: boolean;

  /**
   * 内存治理主开关（默认 false）。
   * 开启后 Service Worker 会监听 chrome.system.memory，
   * 在内存压力达到阈值时自动 discard 或提示归档。
   */
  memoryGovernanceEnabled?: boolean;

  /**
   * 内存压力触发阈值（%，默认 80）。
   * 当已用内存 / 总内存 ≥ 此值时触发治理动作。
   * 范围：50–95。
   */
  memoryPressureThreshold?: number;

  /**
   * 内存压力治理动作：
   *   - 'notify'（默认）：仅弹出提示，不自动操作
   *   - 'discard'：自动 discard 最久未访问的非活跃标签
   *   - 'archive'：自动将最久未访问的标签归档并关闭
   */
  memoryPressureAction?: "notify" | "discard" | "archive";

  /**
   * 内存治理例外白名单（hostname 数组，默认空）。
   * 命中白名单的标签页不会被自动 discard 或归档。
   * 固定标签、媒体播放中的标签始终豁免（无需加入白名单）。
   */
  memoryGovernanceAllowlist?: string[];

  /**
   * 单次治理最多操作的标签数（默认 5）。
   * 避免一次性 discard 过多标签导致用户困惑。
   */
  memoryGovernanceMaxTabs?: number;

  /**
   * 两次治理动作之间的最小冷却时间（分钟，默认 10）。
   * 避免内存抖动时频繁触发。
   */
  memoryGovernanceCooldownMinutes?: number;

  /** Popup 排序模式：'recent' | 'title' | 'domain' | 'urlLength'，默认 'recent' */
  popupSortMode?: "recent" | "title" | "domain" | "urlLength";

  /** Popup 是否升序排列，默认 false（降序） */
  popupSortAsc?: boolean;

  /** Popup 是否按域名分组显示，默认 false */
  popupGroupByDomain?: boolean;

  /**
   * 「标签页」主视图的子视图（仅 defaultView='tabs' 时生效）。
   *   - 'auto'（默认）：智能推荐（根据使用习惯自动选择）
   *   - 'tabgroup'：按 Chrome Tab Group 展示
   *   - 'window'：按窗口展示
   *   - 'timeline'：按时间轴展示
   */
  tabsSubView?: "auto" | "tabgroup" | "window" | "timeline";

  /**
   * History 视图是否在 TabBar 中显示（默认 false，仅快捷键/Command Palette 可访问）。
   */
  historyTabVisible?: boolean;

  /**
   * 显示高级设置（默认 false）。
   * 关闭时隐藏内存治理、历史配置、弹窗排序等低频设置项。
   */
  showAdvancedSettings?: boolean;

  /**
   * 用户自定义 TabBar 视图排序。
   * 未列出的视图排到最后。
   */
  tabBarOrder?: string[];

  /**
   * TabBar 中用户隐藏的视图 ID 列表。
   */
  hiddenTabBarViews?: string[];

  /**
   * 设置数据格式版本号（v1.4 引入）。
   * v2 = 旧版视图已迁移到 tabsSubView/tabsLayout 体系。
   * 新安装默认为 2，旧用户迁移后更新为 2。
   */
  schemaVersion?: number;
}
