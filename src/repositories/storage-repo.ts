/**
 * StorageRepo — Partitioned chrome.storage.local wrapper
 *
 * Data is stored under namespaced keys (canopy_tabs, canopy_settings, etc.)
 * to avoid reading all data on every access.
 */

import { storageGet, storageSet } from '@/chrome';
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
// 所有新字段走"缺失即默认"策略，不需要破坏性迁移。
const CURRENT_SCHEMA_VERSION = 2;

const DEFAULT_SETTINGS: UserSettings = {
  overrideNewTab: true,
  defaultView: 'domain',
  theme: 'system',
  gradientPreset: 'slate',
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
  searchDefaultEngine: 'google',
  searchEnabledEngines: ['google', 'bing', 'baidu', 'duckduckgo'],
  searchAutoFallbackToWeb: true,
  searchUseHistorySuggestions: true,
  searchUseHotSuggestions: true,
  layoutDensity: 'default',
  contentMaxWidth: 1360,
  reducedMotion: 'auto',
  uiVisibility: {
    header: true,
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
};

// ── Generic CRUD ──────────────────────────────────────

export async function getData<T>(key: StorageKey): Promise<T | undefined> {
  return storageGet<T>(key);
}

export async function setData<T>(key: StorageKey, value: T): Promise<void> {
  await storageSet(key, value);
  await updateMetaTimestamp();
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
  return merged;
}

export async function saveSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getSettings();
  const merged = { ...current, ...settings };
  if (settings.uiVisibility !== undefined) {
    merged.uiVisibility = { ...current.uiVisibility, ...settings.uiVisibility };
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
