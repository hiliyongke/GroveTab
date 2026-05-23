/**
 * StorageRepo — Partitioned chrome.storage.local wrapper
 *
 * Data is stored under brand-configured namespaced keys.
 * to avoid reading all data on every access.
 */

import { storageGet, storageSet } from "@/chrome";
import { storageRemove, storageGetAllKeys } from "@/chrome/tabs";
import { STORAGE_KEYS } from "@/shared/config/storage-keys";
import type {
  ActivityRecord,
  AutoSnapshotMeta,
  KanbanLayout,
  MetricEvent,
  OgEntry,
  SearchHistoryEntry,
  SpeedDialSite,
  StatsData,
  StorageKey,
  StorageMeta,
  UserSettings,
  Workspace,
} from "@/shared/types";

// ── Schema Version & Migration ────────────────────────
// v1 → v2: v1.0 封板。新增 dedupStrictness / idleThresholdMinutes /
// autoSnapshotFrequency / enableOgFetch / lastActiveWorkspaceId 等字段；
// 新增 activity / workspaces / kanban / ogIndex 等独立存储键。
// v2 → v3: 引入自由 Widget 画布、网站快捷模块、自定义金句与生产力小组件设置。
// 所有新字段走"缺失即默认"策略，不需要破坏性迁移。
const CURRENT_SCHEMA_VERSION = 3;

const DEFAULT_SETTINGS: UserSettings = {
  overrideNewTab: true,
  newtabPageMode: "workspace",
  viewTabPosition: "top",
  defaultView: "domain",
  theme: "system",
  gradientPreset: "default",
  skinPreset: "glassmorphism",
  showIncognito: false,
  language: "zh-CN",
  domainGroupColumns: "auto",
  domainGroupShowItemFavicon: true,
  domainGroupAccentBarPosition: "left",
  domainGroupCardRadius: "default",
  searchScope: ["title", "hostname", "url"],
  searchEnablePinyin: true,
  searchSortBy: "relevance",
  searchDefaultEngine: "bing",
  searchEnabledEngines: ["bing", "baidu", "google", "duckduckgo"],
  searchCustomEngines: [],
  searchAutoFallbackToWeb: true,
  searchUseHistorySuggestions: true,
  searchUseHotSuggestions: true,
  hotSuggestionSource: "trending",
  layoutDensity: "default",
  contentMaxWidth: 0,
  reducedMotion: "auto",
  uiVisibility: {
    header: true,
    heroLogo: true,
    heroTitle: true,
    heroSlogan: true,
    heroSearch: true,
    viewSwitcher: true,
    tidySuggestion: true,
    quickStart: true,
  },
  speedDialGroupEnabled: false,
  // v1.0 封板新增默认值
  dedupStrictness: "loose",
  idleThresholdMinutes: 1440,
  undoWindowSeconds: 5,
  closeConfirmThreshold: 20,
  autoSnapshotFrequency: "12h",
  enableOgFetch: false,
  // v1.2 新增默认值
  clickEffect: "off",
  videoBackground: { type: "none" },
  // v1.4 插件原生历史记录默认值
  historyEnabled: true,
  historyRecordEvents: true,
  historyMaxClosedTabs: 50,
  historyMaxEvents: 500,
  historyClosedTabsTtlHours: 168,
  historyUrlBlocklist: [],
};

// ── Generic CRUD ──────────────────────────────────────

export async function getData<T>(key: StorageKey): Promise<T | undefined> {
  return storageGet<T>(key);
}

export async function setData<T>(key: StorageKey, value: T): Promise<void> {
  await storageSet(key, value);
  if (key !== STORAGE_KEYS.meta) {
    await updateMetaTimestamp();
  }
}

/**
 * 删除指定 key 对应的数据。
 * 用于一键重置：清除设置 / Onboarding 标志 / 工厂重置遍历全部应用命名空间键。
 */
export async function removeData(key: string): Promise<void> {
  await storageRemove(key);
  if (key !== STORAGE_KEYS.meta) {
    await updateMetaTimestamp();
  }
}

/**
 * 列出 chrome.storage.local 中的所有键。
 * 用于一键重置：遍历并删除所有应用命名空间键以恢复出厂状态。
 */
export async function getAllDataKeys(): Promise<string[]> {
  return storageGetAllKeys();
}

// ── Settings ──────────────────────────────────────────

export async function getSettings(): Promise<UserSettings> {
  const settings = await getData<UserSettings>(STORAGE_KEYS.settings);
  if (settings === undefined) return { ...DEFAULT_SETTINGS };
  /**
   * 旧值迁移：aurora → slate，sunrise → warm
   * 2026-04-23 预设体系重命名后，存量用户磁盘里可能还存着旧 ID。
   */
  if (settings.gradientPreset === "aurora") settings.gradientPreset = "slate";
  if (settings.gradientPreset === "sunrise") settings.gradientPreset = "warm";
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
    ...(partial.uiVisibility ?? {}),
  };
  return merged;
}

export async function saveSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getSettings();
  const merged = withDefaults({ ...current, ...settings });
  if (settings.uiVisibility !== undefined) {
    merged.uiVisibility = { ...current.uiVisibility, ...settings.uiVisibility };
  }
  await setData(STORAGE_KEYS.settings, merged);
  return merged;
}

// ── Meta ──────────────────────────────────────────────

async function getMeta(): Promise<StorageMeta | undefined> {
  return getData<StorageMeta>(STORAGE_KEYS.meta);
}

async function ensureMeta(): Promise<StorageMeta> {
  let meta = await getMeta();
  if (meta === undefined) {
    meta = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await setData(STORAGE_KEYS.meta, meta);
  } else if (meta.schemaVersion < CURRENT_SCHEMA_VERSION) {
    // 执行 schema 升级（目前为空迁移，仅 bump 版本号）
    await runMigrations(meta.schemaVersion, CURRENT_SCHEMA_VERSION);
    meta.schemaVersion = CURRENT_SCHEMA_VERSION;
    meta.updatedAt = Date.now();
    await setData(STORAGE_KEYS.meta, meta);
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
      const current = await getData<UserSettings>(STORAGE_KEYS.settings);
      if (current !== undefined) {
        await setData(STORAGE_KEYS.settings, withDefaults(current));
      }
    }
  }
}

async function updateMetaTimestamp(): Promise<void> {
  const meta = await getMeta();
  if (meta !== undefined) {
    meta.updatedAt = Date.now();
    await setData(STORAGE_KEYS.meta, meta);
  }
}

// ── Onboarding ────────────────────────────────────────

export async function hasCompletedOnboarding(): Promise<boolean> {
  const done = await getData<boolean>(STORAGE_KEYS.onboardingDone);
  return done ?? false;
}

export async function markOnboardingDone(): Promise<void> {
  await setData(STORAGE_KEYS.onboardingDone, true);
}

// ── Search History ─────────────────────────────────────

const MAX_RECENT_SEARCHES = 20;

/**
 * 获取最近搜索词（带使用计数）。
 * 为兼容 v0 旧数据（纯字符串数组），读取时自动升级结构。
 */
export async function getSearchHistory(): Promise<SearchHistoryEntry[]> {
  const raw = (await getData<SearchHistoryEntry[] | string[]>(STORAGE_KEYS.searchHistory)) ?? [];
  if (raw.length === 0) return [];
  // 旧数据兼容：string[] → SearchHistoryEntry[]
  if (typeof raw[0] === "string") {
    const now = Date.now();
    return (raw as readonly string[]).map((query) => ({ query, ts: now, count: 1 }));
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
  if (normalized === "") return getRecentSearches();

  const existing = await getSearchHistory();
  const hit = existing.find((e) => e.query === normalized);
  const rest = existing.filter((e) => e.query !== normalized);
  const newEntry: SearchHistoryEntry = {
    query: normalized,
    ts: Date.now(),
    count: (hit?.count ?? 0) + 1,
  };
  const next = [newEntry, ...rest].slice(0, MAX_RECENT_SEARCHES);
  await setData(STORAGE_KEYS.searchHistory, next);
  return next.map((e) => e.query);
}

// ── Recent Activity (F-27) ─────────────────────────────

const MAX_ACTIVITY = 20;
const ACTIVITY_TTL_MS = 72 * 3600 * 1000;

export async function getRecentActivity(): Promise<ActivityRecord[]> {
  const raw = (await getData<ActivityRecord[]>(STORAGE_KEYS.activity)) ?? [];
  const cutoff = Date.now() - ACTIVITY_TTL_MS;
  return raw.filter((r) => r.ts >= cutoff);
}

export async function pushActivity(record: ActivityRecord): Promise<ActivityRecord[]> {
  const existing = await getRecentActivity();
  const next = [record, ...existing].slice(0, MAX_ACTIVITY);
  await setData(STORAGE_KEYS.activity, next);
  return next;
}

export async function clearActivity(): Promise<void> {
  await setData(STORAGE_KEYS.activity, []);
}

// ── Workspaces (F-29) ──────────────────────────────────

const MAX_WORKSPACES = 3;

export async function getWorkspaces(): Promise<Workspace[]> {
  return (await getData<Workspace[]>(STORAGE_KEYS.workspaces)) ?? [];
}

export async function saveWorkspaces(list: Workspace[]): Promise<void> {
  await setData(STORAGE_KEYS.workspaces, list.slice(0, MAX_WORKSPACES));
}

// ── Kanban (F-20) ──────────────────────────────────────

export async function getKanbanLayout(): Promise<KanbanLayout | undefined> {
  return getData<KanbanLayout>(STORAGE_KEYS.kanban);
}

export async function saveKanbanLayout(layout: KanbanLayout): Promise<void> {
  await setData(STORAGE_KEYS.kanban, layout);
}

// ── Stats (F-11) ───────────────────────────────────────

export async function getStats(): Promise<StatsData | undefined> {
  return getData<StatsData>(STORAGE_KEYS.stats);
}

export async function saveStats(stats: StatsData): Promise<void> {
  await setData(STORAGE_KEYS.stats, stats);
}

// ── OG Index (F-24) ────────────────────────────────────

export async function getOgEntry(url: string): Promise<OgEntry | undefined> {
  const index = (await getData<Record<string, OgEntry>>(STORAGE_KEYS.ogIndex)) ?? {};
  return index[url];
}

export async function saveOgEntry(entry: OgEntry): Promise<void> {
  const index = (await getData<Record<string, OgEntry>>(STORAGE_KEYS.ogIndex)) ?? {};
  index[entry.url] = entry;
  // LRU：超过 10000 条时淘汰最老 1000 条
  const keys = Object.keys(index);
  if (keys.length > 10000) {
    const sorted = keys.sort((a, b) => (index[a]?.fetchedAt ?? 0) - (index[b]?.fetchedAt ?? 0));
    for (const k of sorted.slice(0, 1000)) delete index[k];
  }
  await setData(STORAGE_KEYS.ogIndex, index);
}

// ── Auto Snapshot Meta (F-23) ──────────────────────────

export async function getAutoSnapshotMeta(): Promise<AutoSnapshotMeta | undefined> {
  return getData<AutoSnapshotMeta>(STORAGE_KEYS.autoSnapshotMeta);
}

export async function saveAutoSnapshotMeta(meta: AutoSnapshotMeta): Promise<void> {
  await setData(STORAGE_KEYS.autoSnapshotMeta, meta);
}

// ── Metrics (§17) ──────────────────────────────────────

export async function getMetrics(): Promise<MetricEvent[]> {
  return (await getData<MetricEvent[]>(STORAGE_KEYS.metrics)) ?? [];
}

export async function clearMetrics(): Promise<void> {
  await setData(STORAGE_KEYS.metrics, []);
}

// ── Speed Dial / 常用站点 ──────────────────────────────

/** 获取所有常用站点，按 order 升序排列 */
export async function getSpeedDialSites(): Promise<SpeedDialSite[]> {
  const sites = (await getData<SpeedDialSite[]>(STORAGE_KEYS.speedDial)) ?? [];
  return sites.sort((a, b) => a.order - b.order);
}

/** 保存全部常用站点列表（不限制数量，内部函数） */
async function saveSpeedDialSites(sites: SpeedDialSite[]): Promise<void> {
  const sorted = [...sites].sort((a, b) => a.order - b.order);
  await setData(STORAGE_KEYS.speedDial, sorted);
}

/** 新增一个常用站点（不可变操作） */
export async function addSpeedDialSite(site: SpeedDialSite): Promise<SpeedDialSite[]> {
  const sites = await getSpeedDialSites();
  const newSites = [...sites, site];
  await saveSpeedDialSites(newSites);
  return newSites;
}

/** 更新一个常用站点（不可变操作） */
export async function updateSpeedDialSite(
  updated: Partial<SpeedDialSite> & { id: string },
): Promise<SpeedDialSite[]> {
  const sites = await getSpeedDialSites();
  const idx = sites.findIndex((s) => s.id === updated.id);
  const target = idx !== -1 ? sites[idx] : undefined;
  if (idx !== -1 && target) {
    const newSites: SpeedDialSite[] = [
      ...sites.slice(0, idx),
      { ...target, ...updated },
      ...sites.slice(idx + 1),
    ];
    await saveSpeedDialSites(newSites);
    return newSites;
  }
  return sites;
}

/** 删除一个常用站点 */
export async function removeSpeedDialSite(id: string): Promise<SpeedDialSite[]> {
  const sites = await getSpeedDialSites();
  const filtered = sites.filter((s) => s.id !== id);
  await saveSpeedDialSites(filtered);
  return filtered;
}

/** 重排常用站点（不可变操作） */
export async function reorderSpeedDialSites(reorderedIds: string[]): Promise<SpeedDialSite[]> {
  const sites = await getSpeedDialSites();
  const siteMap = new Map(sites.map((s) => [s.id, s]));
  const reordered = reorderedIds
    .map((id, idx) => {
      const site = siteMap.get(id);
      if (site) return { ...site, order: idx };
      return undefined;
    })
    .filter((s): s is SpeedDialSite => s !== undefined);
  await saveSpeedDialSites(reordered);
  return reordered;
}

// 模块加载时初始化元数据
void ensureMeta();
