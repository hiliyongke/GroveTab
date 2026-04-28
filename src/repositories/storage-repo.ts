/**
 * StorageRepo — Partitioned chrome.storage.local wrapper
 *
 * Data is stored under namespaced keys (canopy_tabs, canopy_settings, etc.)
 * to avoid reading all data on every access.
 */

import { storageGet, storageSet } from '@/chrome';
import { storageRemove, storageGetAllKeys } from '@/chrome/tabs';
import type {
  ActivityRecord,
  AutoSnapshotMeta,
  KanbanLayout,
  MetricEvent,
  OgEntry,
  SearchHistoryEntry,
  StatsData,
  StorageKey,
  StorageMeta,
  UserSettings,
  Workspace,
} from '@/shared/types';

// ── Schema Version & Migration ────────────────────────
// v1 → v2: Canopy v1.0 封板。新增 dedupStrictness / idleThresholdMinutes /
// autoSnapshotFrequency / enableOgFetch / lastActiveWorkspaceId 等字段；
// 新增 canopy_activity / canopy_workspaces / canopy_kanban / canopy_og_index 等独立存储键。
// v2 → v3: GroveTab 开发阶段引入自由 Widget 画布、网站快捷模块、自定义金句与生产力小组件设置。
// 所有新字段走"缺失即默认"策略，不需要破坏性迁移。
const CURRENT_SCHEMA_VERSION = 3;

const DEFAULT_SETTINGS: UserSettings = {
  overrideNewTab: true,
  newtabPageMode: 'workspace',
  defaultView: 'domain',
  theme: 'system',
  gradientPreset: 'default',
  skinPreset: 'minimal',
  showIncognito: false,
  language: 'zh-CN',
  domainGroupColumns: 'auto',
  domainGroupShowItemFavicon: true,
  domainGroupAccentBarPosition: 'left',
  domainGroupCardRadius: 'default',
  searchScope: ['title', 'hostname', 'url'],
  searchEnablePinyin: true,
  searchSortBy: 'relevance',
  searchDefaultEngine: 'bing',
  searchEnabledEngines: ['bing', 'baidu', 'google', 'duckduckgo'],
  searchAutoFallbackToWeb: true,
  searchUseHistorySuggestions: true,
  searchUseHotSuggestions: true,
  layoutDensity: 'default',
  contentMaxWidth: 1360,
  reducedMotion: 'auto',
  uiVisibility: {
    header: true,
    heroLogo: true,
    heroTitle: true,
    heroSlogan: true,
    heroSearch: true,
    viewSwitcher: true,
    workspaceOverview: true,
    tidySuggestion: true,
    activityStrip: true,
  },
  // v1.0 封板新增默认值
  dedupStrictness: 'loose',
  idleThresholdMinutes: 1440,
  undoWindowSeconds: 5,
  closeConfirmThreshold: 20,
  autoSnapshotFrequency: '12h',
  enableOgFetch: false,
  // v1.2 新增默认值
  dailyQuote: {
    enabled: true,
    categories: ['aphorism', 'renmin', 'poetry', 'essay', 'custom'],
    fontSize: 15,
    showSource: true,
    customQuotes: [],
  },
  dashboardWidgets: {
    enabled: true,
    editMode: false,
    columns: 12,
    rowHeight: 88,
    gap: 12,
    items: [
      { id: 'clock-main', type: 'clock', x: 0, y: 0, w: 3, h: 2, title: '时钟' },
      { id: 'weather-main', type: 'weather', x: 3, y: 0, w: 3, h: 2, title: '天气' },
      { id: 'calendar-main', type: 'calendar', x: 6, y: 0, w: 3, h: 2, title: '日历' },
      { id: 'work-countdown-main', type: 'workCountdown', x: 9, y: 0, w: 3, h: 2, title: '下班倒计时' },
      { id: 'search-main', type: 'searchBox', x: 0, y: 2, w: 6, h: 2, title: '极速搜索' },
      { id: 'speed-dial-main', type: 'speedDial', x: 6, y: 2, w: 6, h: 3, title: '常用网站' },
      { id: 'todo-main', type: 'todo', x: 0, y: 5, w: 4, h: 3, title: '待办' },
      { id: 'pomodoro-main', type: 'pomodoro', x: 4, y: 5, w: 4, h: 3, title: '番茄钟' },
      { id: 'daily-quote-main', type: 'dailyQuote', x: 8, y: 5, w: 4, h: 3, title: '每日金句' },
    ],
    availableWidgets: {
      clock: true,
      weather: true,
      calendar: true,
      dailyQuote: true,
      speedDial: true,
      pomodoro: true,
      todo: true,
      sticky: true,
      countdown: true,
      workCountdown: true,
      searchBox: true,
      waterReminder: true,
      habitTracker: true,
      timestampTool: true,
      jsonFormatter: true,
      networkInfo: true,
    },
  },
  speedDial: {
    enabled: true,
    activeGroupId: 'work',
    openInNewTab: true,
    showLabels: true,
    groups: [
      {
        id: 'work',
        name: '工作',
        links: [
          { id: 'work-github', title: 'GitHub', url: 'https://github.com', emoji: '🐙', color: '#24292f' },
          { id: 'work-figma', title: 'Figma', url: 'https://www.figma.com', emoji: '🎨', color: '#f24e1e' },
          { id: 'work-notion', title: 'Notion', url: 'https://www.notion.so', emoji: '📝', color: '#111111' },
          { id: 'work-linear', title: 'Linear', url: 'https://linear.app', emoji: '📈', color: '#5e6ad2' },
        ],
      },
      {
        id: 'life',
        name: '生活',
        links: [
          { id: 'life-bilibili', title: 'Bilibili', url: 'https://www.bilibili.com', emoji: '📺', color: '#00a1d6' },
          { id: 'life-douban', title: '豆瓣', url: 'https://www.douban.com', emoji: '🎬', color: '#2d963d' },
          { id: 'life-jd', title: '京东', url: 'https://www.jd.com', emoji: '🛒', color: '#d70c18' },
        ],
      },
      {
        id: 'learn',
        name: '学习',
        links: [
          { id: 'learn-mdn', title: 'MDN', url: 'https://developer.mozilla.org', emoji: '📚', color: '#0f172a' },
          { id: 'learn-stackoverflow', title: 'Stack Overflow', url: 'https://stackoverflow.com', emoji: '💡', color: '#f48024' },
          { id: 'learn-zhihu', title: '知乎', url: 'https://www.zhihu.com', emoji: '🧠', color: '#1677ff' },
        ],
      },
    ],
  },
  pomodoro: {
    enabled: true,
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    autoStartBreak: false,
  },
  countdowns: {
    enabled: true,
    showPastEvents: false,
    items: [
      { id: 'anniversary-launch', title: '项目上线纪念', targetDate: '2026-06-01', emoji: '🚀', color: '#1677ff' },
      { id: 'anniversary-holiday', title: '下一次旅行', targetDate: '2026-10-01', emoji: '🏕️', color: '#52c41a' },
    ],
  },
  workCountdown: {
    enabled: true,
    workdayEnd: '18:30',
    offLabel: '今天收工啦',
  },
  todoWidget: {
    enabled: true,
    items: [
      { id: 'todo-1', text: '清理待关闭标签页', done: false },
      { id: 'todo-2', text: '补一版周报', done: false },
      { id: 'todo-3', text: '下班前同步进度', done: true },
    ],
  },
  stickyNotes: {
    enabled: true,
    items: [
      {
        id: 'sticky-1',
        title: '灵感速记',
        content: '把真正高频使用的小工具放到顶部，主内容区保持专注。',
        color: '#fff7e6',
      },
    ],
  },
  waterReminder: {
    enabled: true,
    goalCups: 8,
    currentCups: 0,
    intervalMinutes: 60,
  },
  habitTracker: {
    enabled: true,
    items: [
      { id: 'habit-read', name: '阅读 30 分钟', emoji: '📖', records: [] },
      { id: 'habit-sport', name: '运动打卡', emoji: '🏃', records: [] },
      { id: 'habit-early', name: '早睡', emoji: '🌙', records: [] },
    ],
  },
  clickEffect: 'off',
  videoBackground: { type: 'none' },
};

// ── Generic CRUD ──────────────────────────────────────

export async function getData<T>(key: StorageKey): Promise<T | undefined> {
  return storageGet<T>(key);
}

export async function setData<T>(key: StorageKey, value: T): Promise<void> {
  await storageSet(key, value);
  if (key !== 'canopy_meta') {
    await updateMetaTimestamp();
  }
}

/**
 * 删除指定 key 对应的数据。
 * 用于一键重置：清除设置 / Onboarding 标志 / 工厂重置遍历全部 canopy_* 键。
 */
export async function removeData(key: string): Promise<void> {
  await storageRemove(key);
  if (key !== 'canopy_meta') {
    await updateMetaTimestamp();
  }
}

/**
 * 列出 chrome.storage.local 中的所有键。
 * 用于一键重置：遍历并删除所有 canopy_* 键以恢复出厂状态。
 */
export async function getAllDataKeys(): Promise<string[]> {
  return storageGetAllKeys();
}

// ── Settings ──────────────────────────────────────────

export async function getSettings(): Promise<UserSettings> {
  const settings = await getData<UserSettings>('canopy_settings');
  if (settings === undefined) return { ...DEFAULT_SETTINGS };
  /**
   * 旧值迁移：aurora → slate，sunrise → warm
   * 2026-04-23 预设体系重命名后，存量用户磁盘里可能还存着旧 ID。
   */
  if ((settings.gradientPreset as string) === 'aurora') settings.gradientPreset = 'slate';
  if ((settings.gradientPreset as string) === 'sunrise') settings.gradientPreset = 'warm';
  /**
   * v1.0 封板：为缺失的新字段注入默认值（向前兼容，绝不抛错）。
   * 不使用展开合并整个 DEFAULT_SETTINGS，避免意外覆盖用户显式关闭的老字段。
   */
  return withDefaults(settings);
}

function withDefaults(partial: Partial<UserSettings>): UserSettings {
  const merged: UserSettings = { ...DEFAULT_SETTINGS, ...partial };
  // uiVisibility 是嵌套对象，需要逐项合并避免覆盖用户设置
  merged.uiVisibility = {
    ...DEFAULT_SETTINGS.uiVisibility,
    ...(partial.uiVisibility === undefined ? {} : partial.uiVisibility),
  };
  merged.heroWidgets = {
    ...DEFAULT_SETTINGS.heroWidgets,
    ...(partial.heroWidgets === undefined ? {} : partial.heroWidgets),
    clock: {
      ...DEFAULT_SETTINGS.heroWidgets?.clock,
      ...(partial.heroWidgets?.clock === undefined ? {} : partial.heroWidgets.clock),
    },
    weather: {
      ...DEFAULT_SETTINGS.heroWidgets?.weather,
      ...(partial.heroWidgets?.weather === undefined ? {} : partial.heroWidgets.weather),
    },
    calendar: {
      ...DEFAULT_SETTINGS.heroWidgets?.calendar,
      ...(partial.heroWidgets?.calendar === undefined ? {} : partial.heroWidgets.calendar),
    },
  };
  merged.dailyQuote = {
    ...DEFAULT_SETTINGS.dailyQuote,
    ...(partial.dailyQuote === undefined ? {} : partial.dailyQuote),
    categories: partial.dailyQuote?.categories ?? DEFAULT_SETTINGS.dailyQuote?.categories,
    customQuotes: partial.dailyQuote?.customQuotes ?? DEFAULT_SETTINGS.dailyQuote?.customQuotes,
  };
  merged.dashboardWidgets = {
    ...DEFAULT_SETTINGS.dashboardWidgets,
    ...(partial.dashboardWidgets === undefined ? {} : partial.dashboardWidgets),
    items: partial.dashboardWidgets?.items ?? DEFAULT_SETTINGS.dashboardWidgets?.items,
    availableWidgets:
      partial.dashboardWidgets?.availableWidgets === undefined
        ? DEFAULT_SETTINGS.dashboardWidgets?.availableWidgets
        : {
            ...DEFAULT_SETTINGS.dashboardWidgets?.availableWidgets,
            ...partial.dashboardWidgets.availableWidgets,
          },
  };
  merged.speedDial = {
    ...DEFAULT_SETTINGS.speedDial,
    ...(partial.speedDial === undefined ? {} : partial.speedDial),
    groups: partial.speedDial?.groups ?? DEFAULT_SETTINGS.speedDial?.groups,
  };
  merged.pomodoro = {
    ...DEFAULT_SETTINGS.pomodoro,
    ...(partial.pomodoro === undefined ? {} : partial.pomodoro),
  };
  merged.countdowns = {
    ...DEFAULT_SETTINGS.countdowns,
    ...(partial.countdowns === undefined ? {} : partial.countdowns),
    items: partial.countdowns?.items ?? DEFAULT_SETTINGS.countdowns?.items,
  };
  merged.workCountdown = {
    ...DEFAULT_SETTINGS.workCountdown,
    ...(partial.workCountdown === undefined ? {} : partial.workCountdown),
  };
  merged.todoWidget = {
    ...DEFAULT_SETTINGS.todoWidget,
    ...(partial.todoWidget === undefined ? {} : partial.todoWidget),
    items: partial.todoWidget?.items ?? DEFAULT_SETTINGS.todoWidget?.items,
  };
  merged.stickyNotes = {
    ...DEFAULT_SETTINGS.stickyNotes,
    ...(partial.stickyNotes === undefined ? {} : partial.stickyNotes),
    items: partial.stickyNotes?.items ?? DEFAULT_SETTINGS.stickyNotes?.items,
  };
  merged.waterReminder = {
    ...DEFAULT_SETTINGS.waterReminder,
    ...(partial.waterReminder === undefined ? {} : partial.waterReminder),
  };
  merged.habitTracker = {
    ...DEFAULT_SETTINGS.habitTracker,
    ...(partial.habitTracker === undefined ? {} : partial.habitTracker),
    items: partial.habitTracker?.items ?? DEFAULT_SETTINGS.habitTracker?.items,
  };
  return merged;
}

export async function saveSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getSettings();
  const merged = withDefaults({ ...current, ...settings });
  if (settings.uiVisibility !== undefined) {
    merged.uiVisibility = { ...current.uiVisibility, ...settings.uiVisibility };
  }
  if (settings.heroWidgets !== undefined) {
    merged.heroWidgets = {
      ...current.heroWidgets,
      ...settings.heroWidgets,
      clock: { ...current.heroWidgets?.clock, ...settings.heroWidgets.clock },
      weather: { ...current.heroWidgets?.weather, ...settings.heroWidgets.weather },
      calendar: { ...current.heroWidgets?.calendar, ...settings.heroWidgets.calendar },
    };
  }
  if (settings.dailyQuote !== undefined) {
    merged.dailyQuote = {
      ...current.dailyQuote,
      ...settings.dailyQuote,
      categories: settings.dailyQuote.categories ?? current.dailyQuote?.categories,
      customQuotes: settings.dailyQuote.customQuotes ?? current.dailyQuote?.customQuotes,
    };
  }
  if (settings.dashboardWidgets !== undefined) {
    merged.dashboardWidgets = {
      ...current.dashboardWidgets,
      ...settings.dashboardWidgets,
      items: settings.dashboardWidgets.items ?? current.dashboardWidgets?.items,
      availableWidgets:
        settings.dashboardWidgets.availableWidgets === undefined
          ? current.dashboardWidgets?.availableWidgets
          : {
              ...current.dashboardWidgets?.availableWidgets,
              ...settings.dashboardWidgets.availableWidgets,
            },
    };
  }
  if (settings.speedDial !== undefined) {
    merged.speedDial = {
      ...current.speedDial,
      ...settings.speedDial,
      groups: settings.speedDial.groups ?? current.speedDial?.groups,
    };
  }
  if (settings.pomodoro !== undefined) {
    merged.pomodoro = { ...current.pomodoro, ...settings.pomodoro };
  }
  if (settings.countdowns !== undefined) {
    merged.countdowns = {
      ...current.countdowns,
      ...settings.countdowns,
      items: settings.countdowns.items ?? current.countdowns?.items,
    };
  }
  if (settings.workCountdown !== undefined) {
    merged.workCountdown = { ...current.workCountdown, ...settings.workCountdown };
  }
  if (settings.todoWidget !== undefined) {
    merged.todoWidget = {
      ...current.todoWidget,
      ...settings.todoWidget,
      items: settings.todoWidget.items ?? current.todoWidget?.items,
    };
  }
  if (settings.stickyNotes !== undefined) {
    merged.stickyNotes = {
      ...current.stickyNotes,
      ...settings.stickyNotes,
      items: settings.stickyNotes.items ?? current.stickyNotes?.items,
    };
  }
  if (settings.waterReminder !== undefined) {
    merged.waterReminder = { ...current.waterReminder, ...settings.waterReminder };
  }
  if (settings.habitTracker !== undefined) {
    merged.habitTracker = {
      ...current.habitTracker,
      ...settings.habitTracker,
      items: settings.habitTracker.items ?? current.habitTracker?.items,
    };
  }
  await setData('canopy_settings', merged);
  return merged;
}

// ── Meta ──────────────────────────────────────────────

async function getMeta(): Promise<StorageMeta | undefined> {
  return getData<StorageMeta>('canopy_meta');
}

async function ensureMeta(): Promise<StorageMeta> {
  let meta = await getMeta();
  if (meta === undefined) {
    meta = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await setData('canopy_meta', meta);
  } else if (meta.schemaVersion < CURRENT_SCHEMA_VERSION) {
    // 执行 schema 升级（目前为空迁移，仅 bump 版本号）
    await runMigrations(meta.schemaVersion, CURRENT_SCHEMA_VERSION);
    meta.schemaVersion = CURRENT_SCHEMA_VERSION;
    meta.updatedAt = Date.now();
    await setData('canopy_meta', meta);
  }
  return meta;
}

/**
 * 迁移执行器：按版本号顺序执行增量迁移脚本。
 * 当前 v1 → v2 为"空迁移"（字段缺失时默认值已在读取路径兜底），
 * 但保留显式升级钩子以便未来添加需要写操作的迁移。
 */
async function runMigrations(fromVersion: number, toVersion: number): Promise<void> {
  for (let v = fromVersion; v < toVersion; v++) {
    if (v === 1) {
      // v1 → v2：确保 settings 的新字段被物化落盘（可选，提升一致性）
      const current = await getData<UserSettings>('canopy_settings');
      if (current !== undefined) {
        await setData('canopy_settings', withDefaults(current));
      }
    }
  }
}

async function updateMetaTimestamp(): Promise<void> {
  const meta = await getMeta();
  if (meta !== undefined) {
    meta.updatedAt = Date.now();
    await setData('canopy_meta', meta);
  }
}

// ── Onboarding ────────────────────────────────────────

export async function hasCompletedOnboarding(): Promise<boolean> {
  const done = await getData<boolean>('canopy_onboarding_done');
  return done ?? false;
}

export async function markOnboardingDone(): Promise<void> {
  await setData('canopy_onboarding_done', true);
}

// ── Search History ─────────────────────────────────────

const MAX_RECENT_SEARCHES = 20;

/**
 * 获取最近搜索词（带使用计数）。
 * 为兼容 v0 旧数据（纯字符串数组），读取时自动升级结构。
 */
export async function getSearchHistory(): Promise<SearchHistoryEntry[]> {
  const raw = (await getData<SearchHistoryEntry[] | string[]>('canopy_search_history')) ?? [];
  if (raw.length === 0) return [];
  // 旧数据兼容：string[] → SearchHistoryEntry[]
  if (typeof raw[0] === 'string') {
    const now = Date.now();
    return (raw as string[]).map((query) => ({ query, ts: now, count: 1 }));
  }
  return raw as SearchHistoryEntry[];
}

/** 仅返回 query 字符串数组（用于旧 API 兼容）。 */
export async function getRecentSearches(): Promise<string[]> {
  return (await getSearchHistory()).map((e) => e.query);
}

/**
 * 记录一条搜索：
 *   - 去重（按 query）
 *   - 命中旧条目时累加 count 并刷新 ts
 *   - LRU 保留最近 20 条
 *   返回值为 `string[]`，便于与旧 API 及现有 UI 直接兼容；
 *   如需完整 SearchHistoryEntry 列表请调用 getSearchHistory()。
 */
export async function pushRecentSearch(query: string): Promise<string[]> {
  const normalized = query.trim();
  if (normalized === '') return getRecentSearches();

  const existing = await getSearchHistory();
  const hit = existing.find((e) => e.query === normalized);
  const rest = existing.filter((e) => e.query !== normalized);
  const newEntry: SearchHistoryEntry = {
    query: normalized,
    ts: Date.now(),
    count: (hit?.count ?? 0) + 1,
  };
  const next = [newEntry, ...rest].slice(0, MAX_RECENT_SEARCHES);
  await setData('canopy_search_history', next);
  return next.map((e) => e.query);
}

/** 清空搜索历史。 */
export async function clearSearchHistory(): Promise<void> {
  await setData('canopy_search_history', []);
}

// ── Recent Activity (F-27) ─────────────────────────────

const MAX_ACTIVITY = 20;
const ACTIVITY_TTL_MS = 72 * 3600 * 1000;

export async function getRecentActivity(): Promise<ActivityRecord[]> {
  const raw = (await getData<ActivityRecord[]>('canopy_activity')) ?? [];
  const cutoff = Date.now() - ACTIVITY_TTL_MS;
  return raw.filter((r) => r.ts >= cutoff);
}

export async function pushActivity(record: ActivityRecord): Promise<ActivityRecord[]> {
  const existing = await getRecentActivity();
  const next = [record, ...existing].slice(0, MAX_ACTIVITY);
  await setData('canopy_activity', next);
  return next;
}

export async function clearActivity(): Promise<void> {
  await setData('canopy_activity', []);
}

// ── Workspaces (F-29) ──────────────────────────────────

const MAX_WORKSPACES = 3;

export async function getWorkspaces(): Promise<Workspace[]> {
  return (await getData<Workspace[]>('canopy_workspaces')) ?? [];
}

export async function saveWorkspaces(list: Workspace[]): Promise<void> {
  await setData('canopy_workspaces', list.slice(0, MAX_WORKSPACES));
}

// ── Kanban (F-20) ──────────────────────────────────────

export async function getKanbanLayout(): Promise<KanbanLayout | undefined> {
  return getData<KanbanLayout>('canopy_kanban');
}

export async function saveKanbanLayout(layout: KanbanLayout): Promise<void> {
  await setData('canopy_kanban', layout);
}

// ── Stats (F-11) ───────────────────────────────────────

export async function getStats(): Promise<StatsData | undefined> {
  return getData<StatsData>('canopy_stats');
}

export async function saveStats(stats: StatsData): Promise<void> {
  await setData('canopy_stats', stats);
}

// ── OG Index (F-24) ────────────────────────────────────

export async function getOgEntry(url: string): Promise<OgEntry | undefined> {
  const index = (await getData<Record<string, OgEntry>>('canopy_og_index')) ?? {};
  return index[url];
}

export async function saveOgEntry(entry: OgEntry): Promise<void> {
  const index = (await getData<Record<string, OgEntry>>('canopy_og_index')) ?? {};
  index[entry.url] = entry;
  // LRU：超过 10000 条时淘汰最老 1000 条
  const keys = Object.keys(index);
  if (keys.length > 10000) {
    const sorted = keys.sort((a, b) => (index[a].fetchedAt ?? 0) - (index[b].fetchedAt ?? 0));
    for (const k of sorted.slice(0, 1000)) delete index[k];
  }
  await setData('canopy_og_index', index);
}

export async function clearOgIndex(): Promise<void> {
  await setData('canopy_og_index', {});
}

// ── Auto Snapshot Meta (F-23) ──────────────────────────

export async function getAutoSnapshotMeta(): Promise<AutoSnapshotMeta | undefined> {
  return getData<AutoSnapshotMeta>('canopy_auto_snapshot_meta');
}

export async function saveAutoSnapshotMeta(meta: AutoSnapshotMeta): Promise<void> {
  await setData('canopy_auto_snapshot_meta', meta);
}

// ── Metrics (§17) ──────────────────────────────────────

const MAX_METRICS = 2000;

export async function getMetrics(): Promise<MetricEvent[]> {
  return (await getData<MetricEvent[]>('canopy_metrics')) ?? [];
}

export async function pushMetric(event: MetricEvent): Promise<void> {
  const list = await getMetrics();
  list.push(event);
  if (list.length > MAX_METRICS) list.splice(0, list.length - MAX_METRICS);
  await setData('canopy_metrics', list);
}

export async function clearMetrics(): Promise<void> {
  await setData('canopy_metrics', []);
}

// Initialize meta on module load
void ensureMeta();
