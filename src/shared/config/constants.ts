/**
 * 应用常量配置
 *
 * 所有硬编码值应提取到此文件，便于统一管理和修改。
 *
 * @module shared/config/constants
 */

/**
 * 标签页相关常量
 */
export const TABS_CONSTANTS = {
  /** 默认关闭确认阈值（tab 数量），超过此值会弹出确认对话框 */
  DEFAULT_CLOSE_CONFIRM_THRESHOLD: 20,

  /** 关闭确认阈值配置键名 */
  CLOSE_CONFIRM_THRESHOLD_KEY: "closeConfirmThreshold",
} as const;

/**
 * Undo 相关常量
 */
export const UNDO_CONSTANTS = {
  /**
   * Undo Toast 默认显示时长（毫秒）
   * 当用户未配置或配置无效时使用的默认值
   * @default 5000 (5 秒)
   */
  TTL_MS: 5_000,

  /**
   * 内存中保留的最大 Undo 记录数量
   * 超过此数量时，最旧的记录会被移除
   * @default 5
   */
  MAX_RECORDS: 5,
} as const;

/**
 * 历史记录相关常量
 */
export const HISTORY_CONSTANTS = {
  /** 最大历史记录数量 */
  MAX_HISTORY_ITEMS: 1000,

  /** 历史记录查询限制 */
  HISTORY_QUERY_LIMIT: 100,
} as const;

/**
 * 书签相关常量
 */
export const BOOKMARK_CONSTANTS = {
  /** 最大书签数量 */
  MAX_BOOKMARK_ITEMS: 5000,

  /** 书签查询限制 */
  BOOKMARK_QUERY_LIMIT: 100,
} as const;

/**
 * 搜索相关常量
 */
export const SEARCH_CONSTANTS = {
  /**
   * 搜索防抖延迟（毫秒）
   * @default 180
   */
  DEBOUNCE_MS: 180,

  /** 最小搜索字符数 */
  MIN_SEARCH_LENGTH: 1,

  /** 最大搜索结果数量 */
  MAX_SEARCH_RESULTS: 100,
} as const;

/**
 * 自动保存相关常量
 */
export const AUTO_SAVE_CONSTANTS = {
  /** 自动保存延迟（毫秒） */
  AUTO_SAVE_DELAY: 1000,

  /** 自动保存重试次数 */
  AUTO_SAVE_MAX_RETRIES: 3,
} as const;

/**
 * 性能相关常量
 */
export const PERFORMANCE_CONSTANTS = {
  /** 虚拟滚动预估行高（像素） */
  VIRTUAL_LIST_ESTIMATED_SIZE: 50,

  /** 虚拟滚动 overscan 数量（上下各多渲染几项） */
  VIRTUAL_LIST_OVERSCAN: 5,

  /** 大列表阈值（超过此数量启用虚拟滚动） */
  LARGE_LIST_THRESHOLD: 100,

  /**
   * Fetch 请求超时时间（毫秒）
   * 用于热榜缓存刷新等后台网络请求
   * @default 6000 (6 秒)
   */
  FETCH_TIMEOUT_MS: 6_000,

  /**
   * 窗口关闭刷新延迟（毫秒）
   * 窗口整体关闭后，延迟此时间后创建整窗快照
   * @default 800 (0.8 秒)
   */
  WINDOW_CLOSE_FLUSH_DELAY_MS: 800,
} as const;

/**
 * Chrome 扩展相关常量
 */
export const CHROME_EXTENSION_CONSTANTS = {
  /** Service Worker 心跳间隔（毫秒） */
  SW_HEARTBEAT_INTERVAL: 30 * 1000, // 30 秒

  /** Storage 配额警告阈值（字节） */
  STORAGE_QUOTA_WARNING: 100 * 1024 * 1024, // 100 MB

  /** 最大 Storage 大小（字节） */
  STORAGE_MAX_SIZE: 5 * 1024 * 1024, // 5 MB
} as const;

/**
 * 动画相关常量
 */
export const ANIMATION_CONSTANTS = {
  /** 默认动画持续时间（毫秒） */
  DEFAULT_ANIMATION_DURATION: 200,

  /** 页面过渡动画持续时间（毫秒） */
  PAGE_TRANSITION_DURATION: 300,

  /** 加载动画持续时间（毫秒） */
  LOADING_ANIMATION_DURATION: 500,
} as const;

/**
 * 时间相关常量（毫秒）
 */
export const TIME_CONSTANTS = {
  /**
   * 一天的毫秒数
   * @default 86400000 (24 * 60 * 60 * 1000)
   */
  MS_PER_DAY: 86_400_000,

  /**
   * 一小时的毫秒数
   * @default 3600000 (60 * 60 * 1000)
   */
  MS_PER_HOUR: 3_600_000,

  /**
   * 一分钟的毫秒数
   * @default 60000 (60 * 1000)
   */
  MS_PER_MINUTE: 60_000,

  /**
   * 30 分钟的毫秒数（时间线视图阈值）
   * @default 1800000 (30 * 60 * 1000)
   */
  MS_30_MINUTES: 1_800_000,
} as const;

/**
 * 热榜相关常量
 */
export const TRENDING_CONSTANTS = {
  /**
   * 每个热榜平台最大条目数
   * 用于限制 API 返回结果的数量
   * @default 20
   */
  MAX_ITEMS_PER_BOARD: 20,

  /**
   * 热榜 API 请求超时时间（毫秒）
   * @default 8000 (8 秒)
   */
  FETCH_TIMEOUT_MS: 8_000,
} as const;

/**
 * OG (Open Graph) 相关常量
 */
export const OG_CONSTANTS = {
  /**
   * OG 描述最大长度（字符数）
   * 从 HTML 解析的 og:description 截断到此长度
   * @default 500
   */
  DESCRIPTION_MAX_LENGTH: 500,

  /**
   * OG 标题最大长度（字符数）
   * 从 HTML 解析的 title 截断到此长度
   * @default 200
   */
  TITLE_MAX_LENGTH: 200,

  /**
   * OG 缓存 TTL（毫秒）
   * 超过此时长后重新抓取 OG 信息
   * @default 604800000 (7 天)
   */
  CACHE_TTL_MS: 7 * 86_400_000,
} as const;

/**
 * 导出所有常量
 */
export const APP_CONSTANTS = {
  TABS: TABS_CONSTANTS,
  UNDO: UNDO_CONSTANTS,
  HISTORY: HISTORY_CONSTANTS,
  BOOKMARK: BOOKMARK_CONSTANTS,
  SEARCH: SEARCH_CONSTANTS,
  AUTO_SAVE: AUTO_SAVE_CONSTANTS,
  PERFORMANCE: PERFORMANCE_CONSTANTS,
  CHROME_EXTENSION: CHROME_EXTENSION_CONSTANTS,
  ANIMATION: ANIMATION_CONSTANTS,
  TIME: TIME_CONSTANTS,
  TRENDING: TRENDING_CONSTANTS,
  OG: OG_CONSTANTS,
} as const;
