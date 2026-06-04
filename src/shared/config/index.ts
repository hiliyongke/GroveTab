/**
 * 统一配置管理架构
 *
 * 将项目中分散在 24 个文件中的 ~50 个硬编码常量
 * 按功能分类集中管理，便于维护、文档化和允许用户配置。
 *
 * 使用方式：
 *   import { CONFIG } from '@/shared/config';
 *   const interval = CONFIG.performance.statsFlushIntervalMs;
 *
 * 配置优先级（从低到高）：
 *   1. CONFIG 默认值
 *   2. 用户设置（storage中保存的UserSettings）
 *   3. 运行时覆盖（通过 setConfigOverride）
 */


// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

interface PerformanceConfig {
  /** 统计数据刷写间隔（ms） */
  statsFlushIntervalMs: number;
  /** 统计数据保留天数 */
  statsRetainDays: number;
  /** OG 图片抓取并发数 */
  ogConcurrency: number;
  /** OG 图片抓取超时（ms） */
  ogTimeoutMs: number;
  /** OG 图片最大字节数 */
  ogMaxBytes: number;
  /** 书签健康检测超时（ms） */
  healthTimeoutMs: number;
  /** 书签健康检测并发数 */
  healthConcurrency: number;
  /** 最大粒子数（点击特效） */
  maxParticles: number;
  /** 搜索防抖延迟（ms） */
  searchDebounceMs: number;
}

interface UiConfig {
  /** 列表行高 */
  rowHeight: number;
  /** 虚拟列表视口预留（px） */
  viewportReserve: number;
  /** 右键菜单宽度（px） */
  menuWidth: number;
  /** 窗口视图批量渲染数量 */
  batchSize: number;
  /** 频率视图最大显示数 */
  maxDisplay: number;
  /** URL 显示最大长度 */
  urlMaxLength: number;
  /** URL 显示最大 value 长度 */
  urlMaxValueLength: number;
}

interface BusinessConfig {
  /** 最大导入会话数 */
  maxImportSessions: number;
  /** 单次导入每会话最大标签数 */
  maxImportTabsPerSession: number;
  /** 导入文件最大字节数 */
  maxImportFileBytes: number;
  /** 最大工作区数量 */
  maxWorkspaces: number;
  /** 最大指标记录数 */
  maxMetrics: number;
  /** 最大搜索历史条数 */
  maxRecentSearches: number;
  /** 最大活动记录条数 */
  maxActivity: number;
  /** 活动记录 TTL（ms） */
  activityTtlMs: number;
  /** 最小聚类大小 */
  minClusterSize: number;
  /** 置顶条目最大数量 */
  stickyMax: number;
  /** 字符串最大长度（导入归一化） */
  maxStringLength: number;
  /** 自动快照隐藏会话上限 */
  maxAutoSnapshotHidden: number;
}

interface CacheConfig {
  /** 天气缓存 TTL（ms） */
  weatherCacheTtlMs: number;
  /** DB 版本号 */
  dbVersion: number;
  /** IDB 降级阈值（存储使用率） */
  idbQuotaThreshold: number;
  /** 存储警告阈值（bytes） */
  storageWarningThreshold: number;
}

interface NetworkConfig {
  /** 请求超时（ms） */
  requestTimeoutMs: number;
  /** 可见时间窗口（ms） */
  visibleWindowMs: number;
}

interface DashboardConfig {
  /** 仪表盘网格列数 */
  gridColumns: number;
  /** 行高（px） */
  rowHeight: number;
  /** 网格间隙（px） */
  gap: number;
  /** 最小 item 宽度（网格单位） */
  minItemW: number;
  /** 最大 item 宽度（网格单位） */
  maxItemW: number;
  /** 最小 item 高度（网格单位） */
  minItemH: number;
  /** 最大 item 高度（网格单位） */
  maxItemH: number;
}

interface SearchConfig {
  /** 最大热门条目数 */
  maxHotItems: number;
  /** 一天毫秒数（常量） */
  dayMs: number;
}

interface IdleConfig {
  /** 默认闲置阈值（分钟） */
  defaultIdleMinutes: number;
  /** 陈旧上限（ms） */
  staleCapMs: number;
}

/** 完整配置类型 */
export interface AppConfig {
  performance: PerformanceConfig;
  ui: UiConfig;
  business: BusinessConfig;
  cache: CacheConfig;
  network: NetworkConfig;
  dashboard: DashboardConfig;
  search: SearchConfig;
  idle: IdleConfig;
}

// ─────────────────────────────────────────────
// 默认配置
// ─────────────────────────────────────────────

export const CONFIG: AppConfig = {
  performance: {
    statsFlushIntervalMs: 30_000,
    statsRetainDays: 30,
    ogConcurrency: 5,
    ogTimeoutMs: 3_000,
    ogMaxBytes: 50 * 1024,
    healthTimeoutMs: 6_000,
    healthConcurrency: 5,
    maxParticles: 150,
    searchDebounceMs: 180,
  },

  ui: {
    rowHeight: 40,
    viewportReserve: 240,
    menuWidth: 240,
    batchSize: 10,
    maxDisplay: 30,
    urlMaxLength: 60,
    urlMaxValueLength: 16,
  },

  business: {
    maxImportSessions: 500,
    maxImportTabsPerSession: 500,
    maxImportFileBytes: 2 * 1024 * 1024,
    maxWorkspaces: 3,
    maxMetrics: 2000,
    maxRecentSearches: 20,
    maxActivity: 20,
    activityTtlMs: 72 * 3600 * 1000,
    minClusterSize: 3,
    stickyMax: 10,
    maxStringLength: 2000,
    maxAutoSnapshotHidden: 20,
  },

  cache: {
    weatherCacheTtlMs: 30 * 60 * 1000,
    dbVersion: 1,
    idbQuotaThreshold: 0.8,
    storageWarningThreshold: 8 * 1024 * 1024,
  },

  network: {
    requestTimeoutMs: 5_000,
    visibleWindowMs: 60 * 60 * 1000,
  },

  dashboard: {
    gridColumns: 12,
    rowHeight: 88,
    gap: 12,
    minItemW: 2,
    maxItemW: 12,
    minItemH: 2,
    maxItemH: 6,
  },

  search: {
    maxHotItems: 8,
    dayMs: 86_400_000,
  },

  idle: {
    defaultIdleMinutes: 1440, // 24h
    staleCapMs: 7 * 24 * 60 * 60 * 1000, // 7 天
  },
};


