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

export const DEFAULT_SETTINGS: UserSettings = {
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
  // v1.3 Phase 1 新增：WindowView 查看模式（合并 TabGroupView）
  windowViewMode: "window",
};

// ── Generic CRUD ──────────────────────────────────────

/**
 * 从 chrome.storage.local 读取数据
 *
 * @param key - 存储键名
 * @returns 存储的数据（未定义时为 undefined）
 */
export async function getData<T>(key: StorageKey): Promise<T | undefined> {
  return storageGet<T>(key);
}

/**
 * 写入数据到 chrome.storage.local
 *
 * @param key - 存储键名
 * @param value - 待存储的数据
 * @returns 无返回值
 */
export async function setData<T>(key: StorageKey, value: T): Promise<void> {
  await storageSet(key, value);
  if (key !== STORAGE_KEYS.meta) {
    await updateMetaTimestamp();
  }
}

/**
 * 删除指定 key 对应的数据。
 * 用于一键重置：清除设置 / Onboarding 标志 / 工厂重置遍历全部应用命名空间键。
 *
 * @param key - 存储键名
 * @returns 无返回值
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
 *
 * @returns 所有存储键名数组
 */
export async function getAllDataKeys(): Promise<string[]> {
  return storageGetAllKeys();
}

// ── Settings ──────────────────────────────────────────

/**
 * 获取用户设置
 *
 * 若存储中无设置，返回默认设置。
 *
 * @returns 用户设置对象
 */
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

/**
 * 合并用户设置与默认设置
 *
 * @param partial - 用户设置（部分）
 * @returns 合并后的完整用户设置
 */
function withDefaults(partial: Partial<UserSettings>): UserSettings {
  const merged: UserSettings = { ...DEFAULT_SETTINGS, ...partial };
  // uiVisibility 是嵌套对象，需要逐项合并避免覆盖用户设置
  merged.uiVisibility = {
    ...DEFAULT_SETTINGS.uiVisibility,
    ...(partial.uiVisibility === undefined ? {} : partial.uiVisibility),
  };
  return merged;
}

/**
 * 保存用户设置
 *
 * 合并传入的设置与当前设置，并持久化到存储。
 *
 * @param settings - 待保存的用户设置（部分）
 * @returns 合并后的完整用户设置
 */
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

/**
 * 获取存储元数据
 *
 * @returns 存储元数据（未定义时为 undefined）
 */
async function getMeta(): Promise<StorageMeta | undefined> {
  return getData<StorageMeta>(STORAGE_KEYS.meta);
}

/**
 * 确保存储元数据存在
 *
 * 如果元数据不存在，创建一个新的；
 * 如果 schema 版本过低，执行迁移。
 *
 * @returns 存储元数据对象
 */
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
 *
 * @param fromVersion - 当前 schema 版本号
 * @param toVersion - 目标 schema 版本号
 * @returns 无返回值
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

/**
 * 更新元数据的 updatedAt 时间戳
 *
 * @returns 无返回值
 */
async function updateMetaTimestamp(): Promise<void> {
  const meta = await getMeta();
  if (meta !== undefined) {
    meta.updatedAt = Date.now();
    await setData(STORAGE_KEYS.meta, meta);
  }
}

// ── Onboarding ────────────────────────────────────────

/**
 * 检查用户是否已完成 Onboarding
 *
 * @returns 是否已完成 Onboarding
 */
export async function hasCompletedOnboarding(): Promise<boolean> {
  const done = await getData<boolean>(STORAGE_KEYS.onboardingDone);
  return done ?? false;
}

/**
 * 标记 Onboarding 已完成
 *
 * @returns 无返回值
 */
export async function markOnboardingDone(): Promise<void> {
  await setData(STORAGE_KEYS.onboardingDone, true);
}

// ── Search History ─────────────────────────────────────

const MAX_RECENT_SEARCHES = 20;

/**
 * 获取最近搜索词（带使用计数）。
 * 为兼容 v0 旧数据（纯字符串数组），读取时自动升级结构。
 *
 * @returns 最近搜索记录数组
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

/** 仅返回 query 字符串数组（用于旧 API 兼容）。
 * @returns 最近搜索词字符串数组
 */
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
 *
 * @param query - 搜索词
 * @returns 更新后的最近搜索词字符串数组
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

/**
 * 获取最近活动记录
 *
 * 过滤掉超过 72 小时的活动记录。
 *
 * @returns 最近活动记录数组
 */
export async function getRecentActivity(): Promise<ActivityRecord[]> {
  const raw = (await getData<ActivityRecord[]>(STORAGE_KEYS.activity)) ?? [];
  const cutoff = Date.now() - ACTIVITY_TTL_MS;
  return raw.filter((r) => r.ts >= cutoff);
}

/**
 * 添加一条活动记录
 *
 * 新记录插入数组头部，超过 MAX_ACTIVITY 时自动截断。
 *
 * @param record - 活动记录
 * @returns 更新后的活动记录数组
 */
export async function pushActivity(record: ActivityRecord): Promise<ActivityRecord[]> {
  const existing = await getRecentActivity();
  const next = [record, ...existing].slice(0, MAX_ACTIVITY);
  await setData(STORAGE_KEYS.activity, next);
  return next;
}

/**
 * 清空最近活动记录
 *
 * @returns 无返回值
 */
export async function clearActivity(): Promise<void> {
  await setData(STORAGE_KEYS.activity, []);
}

// ── Workspaces (F-29) ──────────────────────────────────

const MAX_WORKSPACES = 3;

/**
 * 获取所有工作区
 *
 * @returns 工作区数组
 */
export async function getWorkspaces(): Promise<Workspace[]> {
  return (await getData<Workspace[]>(STORAGE_KEYS.workspaces)) ?? [];
}

/**
 * 保存工作区列表
 *
 * 限制最多保存 MAX_WORKSPACES 个。
 *
 * @param list - 工作区数组
 * @returns 无返回值
 */
export async function saveWorkspaces(list: Workspace[]): Promise<void> {
  await setData(STORAGE_KEYS.workspaces, list.slice(0, MAX_WORKSPACES));
}

// ── Kanban (F-20) ──────────────────────────────────────

/**
 * 获取看板布局
 *
 * @returns 看板布局对象（未定义时为 undefined）
 */
export async function getKanbanLayout(): Promise<KanbanLayout | undefined> {
  return getData<KanbanLayout>(STORAGE_KEYS.kanban);
}

/**
 * 保存看板布局
 *
 * @param layout - 看板布局对象
 * @returns 无返回值
 */
export async function saveKanbanLayout(layout: KanbanLayout): Promise<void> {
  await setData(STORAGE_KEYS.kanban, layout);
}

// ── Stats (F-11) ───────────────────────────────────────

/**
 * 获取统计信息
 *
 * @returns 统计信息对象（未定义时为 undefined）
 */
export async function getStats(): Promise<StatsData | undefined> {
  return getData<StatsData>(STORAGE_KEYS.stats);
}

/**
 * 保存统计信息
 *
 * @param stats - 统计信息对象
 * @returns 无返回值
 */
export async function saveStats(stats: StatsData): Promise<void> {
  await setData(STORAGE_KEYS.stats, stats);
}

// ── OG Index (F-24) ────────────────────────────────────

/**
 * 获取 OG 数据
 *
 * @param url - 页面 URL
 * @returns OG 数据（未缓存时为 undefined）
 */
export async function getOgEntry(url: string): Promise<OgEntry | undefined> {
  const index = (await getData<Record<string, OgEntry>>(STORAGE_KEYS.ogIndex)) ?? {};
  return index[url];
}

/**
 * 保存 OG 数据
 *
 * @param entry - OG 数据对象
 * @returns 无返回值
 */
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

/**
 * 清空 OG 数据索引
 *
 * @returns 无返回值
 */
export async function clearOgIndex(): Promise<void> {
  await setData(STORAGE_KEYS.ogIndex, {});
}

// ── Auto Snapshot Meta (F-23) ──────────────────────────

/**
 * 获取自动快照元数据
 *
 * @returns 自动快照元数据（未定义时为 undefined）
 */
export async function getAutoSnapshotMeta(): Promise<AutoSnapshotMeta | undefined> {
  return getData<AutoSnapshotMeta>(STORAGE_KEYS.autoSnapshotMeta);
}

/**
 * 保存自动快照元数据
 *
 * @param meta - 自动快照元数据对象
 * @returns 无返回值
 */
export async function saveAutoSnapshotMeta(meta: AutoSnapshotMeta): Promise<void> {
  await setData(STORAGE_KEYS.autoSnapshotMeta, meta);
}

// ── Metrics (§17) ──────────────────────────────────────

/**
 * 获取指标事件列表
 *
 * @returns 指标事件数组
 */
export async function getMetrics(): Promise<MetricEvent[]> {
  return (await getData<MetricEvent[]>(STORAGE_KEYS.metrics)) ?? [];
}

/**
 * 清空指标事件列表
 *
 * @returns 无返回值
 */
export async function clearMetrics(): Promise<void> {
  await setData(STORAGE_KEYS.metrics, []);
}

// ── Speed Dial / 常用站点 ──────────────────────────────

/**
 * 获取所有常用站点，按 order 升序排列
 *
 * @returns 常用站点数组
 */
export async function getSpeedDialSites(): Promise<SpeedDialSite[]> {
  const sites = (await getData<SpeedDialSite[]>(STORAGE_KEYS.speedDial)) ?? [];
  return sites.sort((a, b) => a.order - b.order);
}

/**
 * 保存全部常用站点列表（不限制数量，内部函数）
 * @param sites
 */
async function saveSpeedDialSites(sites: SpeedDialSite[]): Promise<void> {
  const sorted = [...sites].sort((a, b) => a.order - b.order);
  await setData(STORAGE_KEYS.speedDial, sorted);
}

/**
 * 新增一个常用站点（不可变操作）
 *
 * @param site - 常用站点对象
 * @returns 更新后的常用站点数组
 */
export async function addSpeedDialSite(site: SpeedDialSite): Promise<SpeedDialSite[]> {
  const sites = await getSpeedDialSites();
  const newSites = [...sites, site];
  await saveSpeedDialSites(newSites);
  return newSites;
}

/**
 * 更新一个常用站点（不可变操作）
 *
 * @param updated - 待更新的常用站点（必须包含 id）
 * @returns 更新后的常用站点数组
 */
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

/**
 * 删除一个常用站点
 *
 * @param id - 待删除的站点 ID
 * @returns 删除后的常用站点数组
 */
export async function removeSpeedDialSite(id: string): Promise<SpeedDialSite[]> {
  const sites = await getSpeedDialSites();
  const filtered = sites.filter((s) => s.id !== id);
  await saveSpeedDialSites(filtered);
  return filtered;
}

/**
 * 重排常用站点（不可变操作）
 *
 * @param reorderedIds - 重排后的 ID 数组
 * @returns 重排后的常用站点数组
 */
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
