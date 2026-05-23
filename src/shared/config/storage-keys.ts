/**
 * 应用命名空间常量
 *
 * 统一收口存储键、跨上下文事件和内部通道名，避免业务代码散落旧产品名。
 * 默认值保持历史前缀以兼容老用户数据；如需白标，可在品牌配置中切换 `storagePrefix`。
 */
import { BRAND } from './brand';
import type { StorageKey } from '@/shared/types';

/** 当前品牌的存储键前缀。 */
const STORAGE_PREFIX = BRAND.storagePrefix;

/**
 * 拼接当前品牌命名空间下的存储键。
 *
 * @param suffix 键名后缀（如 'tabs'、'settings'）
 * @returns 带品牌前缀的存储键
 */
function key(suffix: string): StorageKey {
  return `${STORAGE_PREFIX}${suffix}` as StorageKey;
}

/** chrome.storage / 本地存储中使用的键名。 */
export const STORAGE_KEYS = Object.freeze({
  tabs: key('tabs'),
  sessions: key('sessions'),
  settings: key('settings'),
  tags: key('tags'),
  notes: key('notes'),
  pins: key('pins'),
  undo: key('undo'),
  stats: key('stats'),
  snapshots: key('snapshots'),
  meta: key('meta'),
  metrics: key('metrics'),
  metricCounters: key('metric_counters'),
  onboardingDone: key('onboarding_done'),
  searchHistory: key('search_history'),
  activity: key('activity'),
  workspaces: key('workspaces'),
  kanban: key('kanban'),
  ogIndex: key('og_index'),
  autoSnapshotMeta: key('auto_snapshot_meta'),
  trendingCache: key('trending_cache'),
  profiles: key('profiles'),
  speedDial: key('speed_dial'),
  // ── 插件原生历史记录（v1.4） ──────────────────────
  /** 细粒度操作时间线（HistoryEvent[]） */
  historyEvents: key('history_events'),
  /** 最近关闭的标签快照（ClosedTabRecord[]） */
  closedTabs: key('closed_tabs'),
  /** 整窗关闭的快照（ClosedWindowRecord[]），用于一键恢复整个窗口 */
  closedWindows: key('closed_windows'),
  /** 每日标签页快照（DailySnapshot[]），用于「昨天 → 今天」对比 */
  dailySnapshots: key('daily_snapshots'),
});

/**
 * 判断是否属于当前应用命名空间的存储键
 *
 * 检查存储键是否以当前品牌的前缀开头。
 *
 * @param value - 存储键字符串
 * @returns 如果属于当前应用命名空间则返回 true，否则返回 false
 */
export function isAppStorageKey(value: string): boolean {
  return value.startsWith(STORAGE_PREFIX);
}

/** 非 chrome.storage 的轻量本地缓存键。 */
export const LOCAL_CACHE_KEYS = Object.freeze({
  prepaintTheme: 'app_prepaint_theme',
  legacyPrepaintTheme: 'grovetab_prepaint_theme',
  weather: `${BRAND.id}_weather_cache`,
  tidyDismissed: `${BRAND.id}_tidy_dismissed`,
});

/** 内部广播通道名。 */
export const APP_CHANNELS = Object.freeze({
  swBroadcast: `${BRAND.id}:sw-broadcast`,
});

/** 页面内自定义事件名。 */
export const APP_EVENTS = Object.freeze({
  swMessage: `${BRAND.id}:sw-message`,
  openArchive: `${BRAND.id}:open-archive`,
  highlightSession: `${BRAND.id}:highlight-session`,
});

/** Service Worker 内部菜单、定时器与命令 ID。 */
export const APP_INTERNAL_IDS = Object.freeze({
  saveAllContextMenu: `${BRAND.id}:save-all`,
  statsHeartbeatAlarm: `${BRAND.id}:stats-heartbeat`,
  autoSnapshotAlarm: `${BRAND.id}:auto-snapshot`,
  trendingRefreshAlarm: `${BRAND.id}:trending-refresh`,
  openWorkspaceCommand: 'open-workspace',
});

/** 文件名、数据库名等非用户文案命名。 */
export const APP_RESOURCE_NAMES = Object.freeze({
  backupFilePrefix: `${BRAND.id}-backup`,
  sessionFilePrefix: `${BRAND.id}-session`,
  videoDb: `${BRAND.id}-video`,
});
