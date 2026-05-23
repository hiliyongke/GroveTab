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
  /** Undo 记录的 TTL（毫秒），超过此时长后自动清除 */
  UNDO_TTL: 10 * 60 * 1000, // 10 分钟

  /** 最大 Undo 记录数量 */
  MAX_UNDO_RECORDS: 50,
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
  /** 搜索防抖延迟（毫秒） */
  SEARCH_DEBOUNCE_DELAY: 300,

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
} as const;
