/**
 * History Repository —— 插件原生历史记录的存储仓库
 *
 * 提供三类数据的 CRUD：
 *   1. HistoryEvent[]：细粒度操作时间线
 *   2. ClosedTabRecord[]：最近关闭的标签（高频 / 一键恢复）
 *   3. ClosedWindowRecord[]：整窗关闭快照
 *
 * 注意事项：
 *   - 所有写入路径都做 LRU 截断和 TTL 过滤，避免 chrome.storage.local 配额爆炸
 *   - 隐身（incognito）事件默认丢弃
 *   - URL 黑名单（chrome:// / about: / extension:// 等）默认丢弃
 *   - SW 与 UI 都依赖本仓库；不要依赖 React/DOM
 */

import { storageGet, storageSet } from '@/chrome';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';
import { formatDateKey } from '@/shared/utils/date';
import type {
  ClosedTabRecord,
  ClosedWindowRecord,
  DailySnapshot,
  HistoryEvent,
  SnapshotDiff,
  UserSettings,
} from '@/shared/types';

// ── 容量与过滤策略 ─────────────────────────

/** HistoryEvent 默认最大保留条数（足够支撑「今天 / 昨天 / 本周」浏览） */
export const MAX_HISTORY_EVENTS = 500;
/** HistoryEvent TTL：30 天 */
export const HISTORY_EVENT_TTL_MS = 30 * 24 * 3600 * 1000;

/** 最近关闭的默认最大保留条数（最高频功能，给得稍多） */
export const MAX_CLOSED_TABS = 100;
/** 最近关闭默认 TTL：7 天（很久之前的 closed tab 用户多半也不想恢复了） */
export const CLOSED_TAB_TTL_MS = 7 * 24 * 3600 * 1000;

/** 整窗关闭快照最大数量 */
export const MAX_CLOSED_WINDOWS = 30;

// ── 隐私设置读取（与 settings-slice 解耦，在 SW 中也可用） ────────────

/**
 * 历史记录运行时实际生效的限制参数（从 UserSettings 读出并装载默认值）。
 */
export interface HistoryLimits {
  enabled: boolean;
  recordEvents: boolean;
  maxClosedTabs: number;
  maxEvents: number;
  closedTabsTtlMs: number;
  blocklist: string[];
}

/**
 * 安全清洗设置：充填默认 + 范围 clamp。
 *
 * 将所有用户设置字段归一到合法范围，避免 NaN、越界值污染下游逻辑。
 *
 * @param settings 用户原始设置（可能残缺或非法）
 * @returns 归一化后的历史记录限制参数
 */
export function resolveHistoryLimits(settings?: Partial<UserSettings>): HistoryLimits {
  const s = settings ?? {};
  const clamp = (v: number | undefined, fallback: number, min: number, max: number): number => {
    if (typeof v !== 'number' || Number.isNaN(v)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(v)));
  };
  const ttlHours = clamp(s.historyClosedTabsTtlHours, 168, 0, 24 * 365);
  return {
    enabled: s.historyEnabled !== false,
    recordEvents: s.historyRecordEvents !== false,
    maxClosedTabs: clamp(s.historyMaxClosedTabs, 50, 10, 500),
    maxEvents: clamp(s.historyMaxEvents, MAX_HISTORY_EVENTS, 50, 5000),
    closedTabsTtlMs: ttlHours === 0 ? Number.POSITIVE_INFINITY : ttlHours * 3600 * 1000,
    blocklist: Array.isArray(s.historyUrlBlocklist) ? s.historyUrlBlocklist.map((s) => s.toLowerCase()) : [],
  };
}

/**
 * SW 上下文使用：从 chrome.storage 读取 settings，并返回 HistoryLimits。
 *
 * 未设置时全部走默认值（充分反脆、不依赖仓库封装）。
 * 本函数封装了 storageGet + resolveHistoryLimits 的两步操作，供仓库内部复用。
 *
 * @returns 归一化后的历史记录限制参数
 */
async function loadLimits(): Promise<HistoryLimits> {
  const settings = await storageGet<UserSettings>(STORAGE_KEYS.settings);
  return resolveHistoryLimits(settings);
}

/**
 * hostname 是否命中用户黑名单（含子域名后缀匹配）。
 *
 * 支持后缀匹配：`blocklist` 中包含 `example.com` 时，
 * `sub.example.com` 也会被判定为命中。
 *
 * @param hostname 待检测的 hostname
 * @param blocklist 用户配置的黑名单列表（已转小写）
 * @returns 命中黑名单返回 true，否则返回 false
 */
function isHostnameBlocked(hostname: string, blocklist: string[]): boolean {
  if (blocklist.length === 0) return false;
  const h = hostname.toLowerCase();
  return blocklist.some((b) => h === b || h.endsWith(`.${b}`));
}
/**
 * 应当忽略的 URL 前缀。
 * - chrome:// / chrome-extension:// / about: / edge:// 等内置 URL 没必要进历史
 * - 空 url 也忽略（pendingUrl 没解析出来时会出现）
 */
const IGNORED_URL_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'about:',
  'about://',
  'view-source:',
  'file://',
];

/**
 * URL 是否应被忽略（内置协议、空值等）。
 *
 * 内置页面（chrome://、edge:// 等）和空 URL 不产生历史记录，
 * 避免污染用户时间线。
 *
 * @param url 待检测的 URL（可能未定义）
 * @returns 应忽略返回 true，否则返回 false
 */
export function isUrlIgnored(url: string | undefined): boolean {
  if (url === undefined || url === '') return true;
  const lower = url.toLowerCase();
  return IGNORED_URL_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/**
 * 从 URL 中安全提取 hostname。
 *
 * 包裹 `new URL()` 避免非法 URL 抛错，解析失败返回空字符串。
 * 供 `appendHistoryEvent` 等函数在无 DOM 环境下使用。
 *
 * @param url 待解析的 URL 字符串
 * @returns hostname 字符串；解析失败返回空字符串
 */
function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * 生成唯一 ID（优先 crypto.randomUUID，失败回退到时间戳 + 随机串）。
 *
 * Service Worker 环境与现代浏览器均可用；回退方案保证离线可用。
 *
 * @returns 唯一 ID 字符串
 */
function genId(): string {
  // crypto.randomUUID 在 SW 与现代浏览器均可用；fallback 兜底
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ── HistoryEvent CRUD ──────────────────────────────

/**
 * 读取所有历史事件（按 ts 倒序，已过滤 TTL）。
 *
 * 自动剔除超过 `HISTORY_EVENT_TTL_MS` 的过期事件，
 * 返回按时间倒序排列的列表。
 *
 * @returns 历史事件数组（倒序）
 */
export async function getHistoryEvents(): Promise<HistoryEvent[]> {
  const raw = (await storageGet<HistoryEvent[]>(STORAGE_KEYS.historyEvents)) ?? [];
  if (raw.length === 0) return [];
  const cutoff = Date.now() - HISTORY_EVENT_TTL_MS;
  return raw
    .filter((e) => e.ts >= cutoff)
    .sort((a, b) => b.ts - a.ts);
}

/**
 * 追加一条历史事件（自动注入 id/ts，自动 LRU/TTL）。
 *
 * 调用方传入“事件描述”，本函数负责：
 *   1. 自动补 id/ts（除非已传）
 *   2. 把"忽略 URL"或"隐身"事件直接丢弃
 *   3. 尊重用户设置：全局开关 / 事件录入开关 / 黑名单 / 容量
 *   4. LRU 截断到 settings.historyMaxEvents
 *   5. 落盘 + 返回最新列表
 * @param partial 事件描述（缺 id/ts 时自动补）
 * @returns 写入后的最新历史事件列表
 */
export async function appendHistoryEvent(
  partial: Omit<HistoryEvent, 'id' | 'ts'> & Partial<Pick<HistoryEvent, 'id' | 'ts'>>,
): Promise<HistoryEvent[]> {
  if (partial.incognito === true) {
    // 隐身事件：直接丢弃，永不落盘
    return getHistoryEvents();
  }
  if (isUrlIgnored(partial.url)) {
    // 内置/扩展 URL：丢弃
    return getHistoryEvents();
  }

  // 读设置：全局开关 / 事件开关 / 黑名单 / 容量
  const limits = await loadLimits();
  if (!limits.enabled || !limits.recordEvents) {
    return getHistoryEvents();
  }
  const hostname = partial.hostname ?? (partial.url ? safeHostname(partial.url) : '');
  if (hostname !== '' && isHostnameBlocked(hostname, limits.blocklist)) {
    return getHistoryEvents();
  }

  const event: HistoryEvent = {
    id: partial.id ?? genId(),
    ts: partial.ts ?? Date.now(),
    type: partial.type,
    title: partial.title,
    url: partial.url,
    favIconUrl: partial.favIconUrl,
    windowId: partial.windowId,
    hostname: hostname === '' ? undefined : hostname,
    incognito: false,
    extra: partial.extra,
    undoable: partial.undoable,
    undoContext: partial.undoContext,
  };

  const existing = (await storageGet<HistoryEvent[]>(STORAGE_KEYS.historyEvents)) ?? [];
  const cutoff = Date.now() - HISTORY_EVENT_TTL_MS;
  const next = [event, ...existing.filter((e) => e.ts >= cutoff)].slice(0, limits.maxEvents);
  await storageSet(STORAGE_KEYS.historyEvents, next);
  return next;
}
/**
 * 删除单条历史事件。
 *
 * @param id 要删除的事件 ID
 * @returns 删除后的最新历史事件列表
 */
export async function deleteHistoryEvent(id: string): Promise<HistoryEvent[]> {
  const existing = (await storageGet<HistoryEvent[]>(STORAGE_KEYS.historyEvents)) ?? [];
  const next = existing.filter((e) => e.id !== id);
  await storageSet(STORAGE_KEYS.historyEvents, next);
  return next;
}

/**
 * 将一条事件标记为「已撤销」。
 *
 * 仅将 undoable 置为 false，并记录 undone:true 于 extra，保留 trail；
 * 不从列表中移除，便于审计。
 *
 * @param id 要标记撤销的事件 ID
 * @returns 更新后的最新历史事件列表
 */
export async function markHistoryEventUndone(id: string): Promise<HistoryEvent[]> {
  const existing = (await storageGet<HistoryEvent[]>(STORAGE_KEYS.historyEvents)) ?? [];
  const next = existing.map<HistoryEvent>((e) => {
    if (e.id !== id) return e;
    return {
      ...e,
      undoable: false,
      extra: { ...(e.extra ?? {}), undone: true, undoneAt: Date.now() },
    };
  });
  await storageSet(STORAGE_KEYS.historyEvents, next);
  return next;
}

/**
 * 按类型批量删除（如"清空所有搜索类事件"）。
 *
 * @param types 要删除的事件类型数组
 * @returns 删除后的最新历史事件列表
 */
export async function deleteHistoryEventsByType(types: Array<HistoryEvent['type']>): Promise<HistoryEvent[]> {
  const set = new Set(types);
  const existing = (await storageGet<HistoryEvent[]>(STORAGE_KEYS.historyEvents)) ?? [];
  const next = existing.filter((e) => !set.has(e.type));
  await storageSet(STORAGE_KEYS.historyEvents, next);
  return next;
}

/** 清空全部历史事件 */
export async function clearHistoryEvents(): Promise<void> {
  await storageSet(STORAGE_KEYS.historyEvents, []);
}

// ── ClosedTab CRUD ─────────────────────────────────

/**
 * 读取最近关闭的标签（按 ts 倒序，已按设置中的 TTL 过滤）。
 *
 * 自动剔除超过用户设置 TTL 的过期记录。
 *
 * @returns 最近关闭的标签列表（倒序）
 */
export async function getClosedTabs(): Promise<ClosedTabRecord[]> {
  const raw = (await storageGet<ClosedTabRecord[]>(STORAGE_KEYS.closedTabs)) ?? [];
  if (raw.length === 0) return [];
  const limits = await loadLimits();
  const cutoff = limits.closedTabsTtlMs === Number.POSITIVE_INFINITY
    ? -Infinity
    : Date.now() - limits.closedTabsTtlMs;
  return raw
    .filter((e) => e.ts >= cutoff)
    .sort((a, b) => b.ts - a.ts);
}

/**
 * 追加一条"最近关闭"记录。
 *
 * @param partial
 * @returns 最新列表（已 LRU/TTL 截断）
 */
export async function pushClosedTab(
  partial: Omit<ClosedTabRecord, 'id' | 'ts' | 'hostname'> & Partial<Pick<ClosedTabRecord, 'id' | 'ts' | 'hostname'>>,
): Promise<ClosedTabRecord[]> {
  if (partial.incognito) return getClosedTabs();
  if (isUrlIgnored(partial.url)) return getClosedTabs();

  const limits = await loadLimits();
  if (!limits.enabled) return getClosedTabs();
  const hostname = partial.hostname ?? safeHostname(partial.url);
  if (hostname !== '' && isHostnameBlocked(hostname, limits.blocklist)) {
    return getClosedTabs();
  }

  const record: ClosedTabRecord = {
    id: partial.id ?? genId(),
    ts: partial.ts ?? Date.now(),
    url: partial.url,
    title: partial.title,
    favIconUrl: partial.favIconUrl,
    windowId: partial.windowId,
    hostname,
    fromWindowClose: partial.fromWindowClose,
    pinned: partial.pinned,
    incognito: false,
  };

  const existing = (await storageGet<ClosedTabRecord[]>(STORAGE_KEYS.closedTabs)) ?? [];
  const cutoff = limits.closedTabsTtlMs === Number.POSITIVE_INFINITY
    ? -Infinity
    : Date.now() - limits.closedTabsTtlMs;
  const next = [record, ...existing.filter((e) => e.ts >= cutoff)].slice(0, limits.maxClosedTabs);
  await storageSet(STORAGE_KEYS.closedTabs, next);
  return next;
}

/**
 * 删除单条"最近关闭"（用户手动从列表移除，或恢复后清理）。
 *
 * @param id 要删除的记录 ID
 * @returns 删除后的最新列表
 */
export async function deleteClosedTab(id: string): Promise<ClosedTabRecord[]> {
  const existing = (await storageGet<ClosedTabRecord[]>(STORAGE_KEYS.closedTabs)) ?? [];
  const next = existing.filter((e) => e.id !== id);
  await storageSet(STORAGE_KEYS.closedTabs, next);
  return next;
}

/** 清空"最近关闭"列表 */
export async function clearClosedTabs(): Promise<void> {
  await storageSet(STORAGE_KEYS.closedTabs, []);
}

// ── ClosedWindow CRUD ──────────────────────────────

/**
 * 读取所有整窗关闭快照（按 ts 倒序）。
 *
 * @returns 整窗关闭快照列表（倒序）
 */
export async function getClosedWindows(): Promise<ClosedWindowRecord[]> {
  const raw = (await storageGet<ClosedWindowRecord[]>(STORAGE_KEYS.closedWindows)) ?? [];
  return [...raw].sort((a, b) => b.ts - a.ts);
}

/**
 * 追加一条整窗关闭快照。
 *
 * 自动注入 id/ts，按 `MAX_CLOSED_WINDOWS` 截断。
 *
 * @param partial 快照描述（缺 id/ts 时自动补）
 * @returns 写入后的最新列表
 */
export async function pushClosedWindow(
  partial: Omit<ClosedWindowRecord, 'id' | 'ts'> & Partial<Pick<ClosedWindowRecord, 'id' | 'ts'>>,
): Promise<ClosedWindowRecord[]> {
  const record: ClosedWindowRecord = {
    id: partial.id ?? genId(),
    ts: partial.ts ?? Date.now(),
    windowId: partial.windowId,
    tabIds: partial.tabIds,
    tabCount: partial.tabCount,
    preview: partial.preview,
  };
  const existing = (await storageGet<ClosedWindowRecord[]>(STORAGE_KEYS.closedWindows)) ?? [];
  const next = [record, ...existing].slice(0, MAX_CLOSED_WINDOWS);
  await storageSet(STORAGE_KEYS.closedWindows, next);
  return next;
}

/**
 * 删除单条整窗关闭快照。
 *
 * @param id 要删除的快照 ID
 * @returns 删除后的最新列表
 */
export async function deleteClosedWindow(id: string): Promise<ClosedWindowRecord[]> {
  const existing = (await storageGet<ClosedWindowRecord[]>(STORAGE_KEYS.closedWindows)) ?? [];
  const next = existing.filter((e) => e.id !== id);
  await storageSet(STORAGE_KEYS.closedWindows, next);
  return next;
}

/**
 *
 */
export async function clearClosedWindows(): Promise<void> {
  await storageSet(STORAGE_KEYS.closedWindows, []);
}

// ── DailySnapshot：每日标签页快照（驱动「昨天 → 今天」对比） ──

/** 默认保留多少天的快照（FIFO 截断；超出按日期最早淘汰） */
export const MAX_DAILY_SNAPSHOTS = 14;

/**
 * 把一个时间戳格式化为 `YYYY-MM-DD`（按用户本地时区）。
 * 委托给 shared/utils/date 的统一实现，保持与 stats-slice 一致。
 */
export const snapshotDateKey = formatDateKey;

/** 读取所有快照（按 dateKey 升序：旧 → 新）。
 *
 * @returns 每日快照数组（升序）
 */
export async function getDailySnapshots(): Promise<DailySnapshot[]> {
  const raw = (await storageGet<DailySnapshot[]>(STORAGE_KEYS.dailySnapshots)) ?? [];
  return [...raw].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

/**
 * 写入一份当日快照；同 dateKey 已存在时直接覆盖（一天一条），
 * 数据按 dateKey 升序保存，超过保留上限按最早 FIFO 截断。
 *
 * @param snapshot 当日快照数据
 * @returns 写入后的最新快照列表
 */
export async function upsertDailySnapshot(snapshot: DailySnapshot): Promise<DailySnapshot[]> {
  const existing = (await storageGet<DailySnapshot[]>(STORAGE_KEYS.dailySnapshots)) ?? [];
  const filtered = existing.filter((s) => s.dateKey !== snapshot.dateKey);
  const merged = [...filtered, snapshot].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  // 超过上限 → 砍掉最早的
  const next = merged.length > MAX_DAILY_SNAPSHOTS
    ? merged.slice(merged.length - MAX_DAILY_SNAPSHOTS)
    : merged;
  await storageSet(STORAGE_KEYS.dailySnapshots, next);
  return next;
}

/**
 * 取昨天那条（YYYY-MM-DD 严格匹配，没拍则 undefined）。
 *
 * 用于「昨天 → 今天」的对比场景。
 *
 * @param referenceTs 参考时间戳（默认当前时间）
 * @returns 昨天的快照；不存在则返回 undefined
 */
export async function getYesterdaySnapshot(referenceTs: number = Date.now()): Promise<DailySnapshot | undefined> {
  const yKey = snapshotDateKey(referenceTs - 24 * 3600 * 1000);
  const all = await getDailySnapshots();
  return all.find((s) => s.dateKey === yKey);
}

/**
 * 取今天那条。
 *
 * 用于获取当日的标签页快照。
 *
 * @param referenceTs 参考时间戳（默认当前时间）
 * @returns 今天的快照；不存在则返回 undefined
 */
export async function getTodaySnapshot(referenceTs: number = Date.now()): Promise<DailySnapshot | undefined> {
  const key = snapshotDateKey(referenceTs);
  const all = await getDailySnapshots();
  return all.find((s) => s.dateKey === key);
}

/**
 * 计算「昨天 → 今天」的 diff。
 *
 * 对比两个快照的 hosts  map，生成新增/消失的域名列表和标签页数量变化。
 * 任一快照缺失则返回 null，外层据此降级展示。
 *
 * @param yesterday 昨天的快照（可能 undefined）
 * @param today 今天的快照（可能 undefined）
 * @returns 包含新增/消失列表和数量变化的 diff 对象；无法对比时返回 null
 */
export function diffSnapshots(
  yesterday: DailySnapshot | undefined,
  today: DailySnapshot | undefined,
): SnapshotDiff | null {
  if (yesterday === undefined || today === undefined) return null;
  const yMap = new Map<string, number>(yesterday.hosts);
  const tMap = new Map<string, number>(today.hosts);
  const added: SnapshotDiff['added'] = [];
  const removed: SnapshotDiff['removed'] = [];
  for (const [host, count] of tMap) {
    if (!yMap.has(host)) added.push({ host, count });
  }
  for (const [host, count] of yMap) {
    if (!tMap.has(host)) removed.push({ host, count });
  }
  // 数量更多的排前面
  added.sort((a, b) => b.count - a.count);
  removed.sort((a, b) => b.count - a.count);
  return {
    yesterday,
    today,
    added,
    removed,
    delta: today.totalTabs - yesterday.totalTabs,
  };
}

/** 清空所有每日快照 */
export async function clearDailySnapshots(): Promise<void> {
  await storageSet(STORAGE_KEYS.dailySnapshots, []);
}

// ── 一键全清 ───────────────────────────────────────

/** 清空所有"插件原生历史"相关数据（用于设置页危险区按钮） */
export async function clearAllNativeHistory(): Promise<void> {
  await Promise.all([
    clearHistoryEvents(),
    clearClosedTabs(),
    clearClosedWindows(),
    clearDailySnapshots(),
  ]);
}
