/**
 * Service Worker
 *
 * Responsibilities:
 * 1. Listen to chrome.tabs / chrome.windows events
 * 2. Broadcast changes to all new tab pages via BroadcastChannel
 * 3. Handle context menu for "Save All Tabs"
 * 4. Alarms for periodic stats snapshot
 * 5. StatsCollector —— 采集 onActivated 激活次数，按 URL × day 聚合持久化（F-11）
 * 6. 自动快照 —— 按 autoSnapshotFrequency 周期性静默归档（F-23）
 */

import { swBroadcast } from '@/shared/utils/sw-broadcast';
import { archiveCurrentWindowTabs } from './archive-handler';
import { createAutoSnapshot } from '@/services/archive-service';
import {
  getSettings,
  getStats,
  saveStats,
  getAutoSnapshotMeta,
  saveAutoSnapshotMeta,
} from '@/repositories';
import type { StatsData, StatsRecord } from '@/shared/types';
import { BRAND } from '@/shared/config/brand';
import { CONFIG } from '@/shared/config';
import { APP_INTERNAL_IDS, STORAGE_KEYS } from '@/shared/config/storage-keys';

/** 统一日志前缀：SW 内所有 console.log/warn/error 都走 SW_LOG_TAG */
const SW_LOG_TAG = `${BRAND.logTag} SW`;

/** 上一次轮询时的 tab discarded 状态缓存，用于检测 discard 变化 */
const cachedTabDiscardedState = new Map<number, boolean>();

// ── StatsCollector（F-11） ────────────────────────────
/**
 * 激活计数按 URL × day 聚合。每 30s 或 onSuspend 时 flush 落盘。
 */
interface InMemoryCounts {
  /** URL → count（本批次） */
  byUrl: Map<string, number>;
  lastFlushAt: number;
  dirty: boolean;
}

const statsMem: InMemoryCounts = {
  byUrl: new Map<string, number>(),
  lastFlushAt: 0,
  dirty: false,
};

// 从 CONFIG 读取（支持运行时覆盖）
const STATS_FLUSH_INTERVAL_MS = CONFIG.performance.statsFlushIntervalMs;
const STATS_RETAIN_DAYS = CONFIG.performance.statsRetainDays;

function urlKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString().replace(/\/+$/, '');
  } catch {
    return url;
  }
}

function todayStr(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function incrementStats(url: string): void {
  if (url === '') return;
  const key = urlKey(url);
  statsMem.byUrl.set(key, (statsMem.byUrl.get(key) ?? 0) + 1);
  statsMem.dirty = true;
}

async function flushStats(force = false): Promise<void> {
  if (!statsMem.dirty) return;
  if (!force && Date.now() - statsMem.lastFlushAt < STATS_FLUSH_INTERVAL_MS) return;
  const snapshot = new Map(statsMem.byUrl);
  try {
    const existing: StatsData = (await getStats()) ?? { daily: [], lastFlushAt: 0 };
    const today = todayStr();
    let dayRecord = existing.daily.find((r) => r.day === today);
    if (dayRecord === undefined) {
      dayRecord = { day: today, counts: {} };
      existing.daily.push(dayRecord);
    }
    for (const [url, count] of snapshot.entries()) {
      dayRecord.counts[url] = (dayRecord.counts[url] ?? 0) + count;
    }
    // 保留最近 30 天
    const cutoff = new Date(Date.now() - STATS_RETAIN_DAYS * 86400_000);
    const cutoffStr = `${cutoff.getUTCFullYear()}-${String(cutoff.getUTCMonth() + 1).padStart(2, '0')}-${String(
      cutoff.getUTCDate(),
    ).padStart(2, '0')}`;
    existing.daily = existing.daily.filter((r: StatsRecord) => r.day >= cutoffStr);
    existing.lastFlushAt = Date.now();
    await saveStats(existing);
    statsMem.byUrl.clear();
    statsMem.dirty = false;
    statsMem.lastFlushAt = Date.now();
  } catch (err) {
    console.warn(`${SW_LOG_TAG} flushStats failed`, err);
    for (const [url, count] of snapshot.entries()) {
      statsMem.byUrl.set(url, (statsMem.byUrl.get(url) ?? 0) + count);
    }
    statsMem.dirty = true;
  }
}

// ── Tab Event Listeners ───────────────────────────────

chrome.tabs.onCreated.addListener((tab) => {
  swBroadcast('tab-created', {
    id: tab.id,
    url: tab.url ?? tab.pendingUrl ?? '',
    title: tab.title ?? '',
    windowId: tab.windowId,
    pinned: tab.pinned,
    incognito: tab.incognito,
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only broadcast meaningful changes
  if (changeInfo.url || changeInfo.title || changeInfo.favIconUrl || changeInfo.status === 'complete') {
    swBroadcast('tab-updated', {
      id: tabId,
      url: tab.url ?? '',
      title: tab.title ?? '',
      favIconUrl: tab.favIconUrl ?? '',
      windowId: tab.windowId,
      status: changeInfo.status,
    });
  }

  // 检测 discarded 状态变化
  const discarded = tab.discarded ?? false;
  const prev = cachedTabDiscardedState.get(tabId);
  if (prev !== discarded) {
    cachedTabDiscardedState.set(tabId, discarded);
    swBroadcast('tab-discarded', { id: tabId, discarded, windowId: tab.windowId });
  }

  // OG description 抓取（F-24，enableOgFetch=true 且授权 <all_urls> 时触发）
  if (changeInfo.status === 'complete' && tab.url !== undefined && /^https?:\/\//.test(tab.url)) {
    void maybeFetchOg(tab.url);
  }
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  swBroadcast('tab-removed', {
    id: tabId,
    windowId: removeInfo.windowId,
    isWindowClosing: removeInfo.isWindowClosing,
  });
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  swBroadcast('tab-activated', {
    id: activeInfo.tabId,
    windowId: activeInfo.windowId,
  });
  // StatsCollector：记一次激活
  void (async () => {
    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      const url = tab.url ?? tab.pendingUrl ?? '';
      if (url !== '') incrementStats(url);
      void flushStats(false);
    } catch {
      // ignore
    }
  })();
});

chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
  swBroadcast('tab-moved', {
    id: tabId,
    windowId: moveInfo.windowId,
    fromIndex: moveInfo.fromIndex,
    toIndex: moveInfo.toIndex,
  });
});

// ── Window Event Listeners ────────────────────────────

chrome.windows.onFocusChanged.addListener((windowId) => {
  swBroadcast('window-focus-changed', { windowId });
});

// ── Context Menu ──────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'app-save-all',
    title: chrome.i18n.getMessage('context_save_all') || `Save all tabs to ${BRAND.name}`,
    contexts: ['action'],
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  void (async () => {
    if (info.menuItemId === 'app-save-all') {
      try {
        await archiveCurrentWindowTabs();
      } catch (err) {
        console.error(`${SW_LOG_TAG} Save all tabs failed:`, err);
      }
    }
  })();
});

// ── 全局快捷键 ──────────────────────────────────

chrome.commands.onCommand.addListener((command) => {
  void (async () => {
    if (command === APP_INTERNAL_IDS.openWorkspaceCommand) {
      try {
        const url = chrome.runtime.getURL('src/pages/newtab/index.html');
        await chrome.tabs.create({ url });
      } catch (err) {
        console.error(`${SW_LOG_TAG} Open ${BRAND.name} failed:`, err);
      }
    }

    if (command === 'save-all-tabs') {
      try {
        await archiveCurrentWindowTabs();
      } catch (err) {
        console.error(`${SW_LOG_TAG} Save all (command) failed:`, err);
      }
    }

    if (command === 'toggle-search') {
      try {
        const url = chrome.runtime.getURL('src/pages/newtab/index.html#search');
        await chrome.tabs.create({ url });
      } catch (err) {
        console.error(`${SW_LOG_TAG} Toggle search failed:`, err);
      }
    }
  })();
});
// ── Alarms ────────────────────────────────────────────

void chrome.alarms.create('app-stats-heartbeat', { periodInMinutes: 1 });
void chrome.alarms.create('app-auto-snapshot', { periodInMinutes: 60 });
void chrome.alarms.create('app-trending-refresh', { periodInMinutes: 30 });

async function autoSnapshotIfNeeded(): Promise<void> {
  try {
    const settings = await getSettings();
    const freq = settings.autoSnapshotFrequency ?? '12h';
    if (freq === 'off') return;

    // 解析频率为毫秒
    const freqMs = (() => {
      switch (freq) {
        case '6h':
          return 6 * 3600 * 1000;
        case '12h':
          return 12 * 3600 * 1000;
        case '24h':
          return 24 * 3600 * 1000;
        default:
          return 12 * 3600 * 1000;
      }
    })();

    const meta = (await getAutoSnapshotMeta()) ?? { lastSnapshotAt: 0 };
    const now = Date.now();
    if (now - meta.lastSnapshotAt < freqMs) return;

    // 查询所有窗口当前 Tab，只在"当前焦点窗口 Tab ≥ 10"时快照
    const windows = await chrome.windows.getAll({ populate: true });
    const focused = windows.find((w) => w.focused) ?? windows[0];
    if (!focused?.tabs) return;
    const nonPinned = focused.tabs.filter((t) => !t.pinned && !t.incognito);
    if (nonPinned.length < 10) return;

    const created = await createAutoSnapshot(nonPinned);
    if (created !== null) {
      await saveAutoSnapshotMeta({ lastSnapshotAt: now });
      console.log(`${SW_LOG_TAG} auto snapshot created`, created.id);
    }
  } catch (err) {
    console.warn(`${SW_LOG_TAG} auto snapshot failed`, err);
  }
}

// 检测 tab discarded 状态变化（用于跨窗口同步）
async function checkDiscardedTabs(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id === undefined) continue;
      const prev = cachedTabDiscardedState.get(tab.id);
      const curr = tab.discarded ?? false;
      if (prev !== undefined && prev !== curr) {
        swBroadcast('tab-discarded', { id: tab.id, discarded: curr, windowId: tab.windowId });
      }
      cachedTabDiscardedState.set(tab.id, curr);
    }
  } catch {
    // ignore
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === APP_INTERNAL_IDS.statsHeartbeatAlarm) {
    void checkDiscardedTabs();
    void flushStats(true);
  } else if (alarm.name === APP_INTERNAL_IDS.autoSnapshotAlarm) {
    void autoSnapshotIfNeeded();
  } else if (alarm.name === APP_INTERNAL_IDS.trendingRefreshAlarm) {
    void refreshTrendingCache();
  }
});

// ── Lifecycle ─────────────────────────────────────────

self.addEventListener('install', () => {
  console.log(`${SW_LOG_TAG} Installed`);
});

self.addEventListener('activate', () => {
  console.log(`${SW_LOG_TAG} Activated`);
});

/**
 * Service Worker 挂起前刷盘，避免数据丢失。
 *
 * 注意：Chrome MV3 的 Service Worker 没有可靠的挂起前事件，
 * 已移除 chrome.runtime.onSuspend（MV3 不可用）。
 * 当前已有每分钟一次的 heartbeat alarm 来定期刷盘。
 */

// ── OG Fetcher（F-24） ────────────────────────────────
// ogInFlight 已迁移到 chrome.storage.session，见 getOgInFlight/setOgInFlight 函数
// 从 CONFIG 读取（支持运行时覆盖）
const OG_CONCURRENCY = CONFIG.performance.ogConcurrency;
const OG_TIMEOUT_MS = CONFIG.performance.ogTimeoutMs;
const OG_MAX_BYTES = CONFIG.performance.ogMaxBytes;

async function maybeFetchOg(url: string): Promise<void> {
  try {
    const settings = await getSettings();
    if (settings.enableOgFetch !== true) return;

    // 从 session storage 读取当前并发数
    const result = await chrome.storage.session.get('ogInFlight');
    const currentInFlight = (result['ogInFlight'] as number) ?? 0;
    if (currentInFlight >= OG_CONCURRENCY) return;

    // 已存在则跳过
    const { getOgEntry, saveOgEntry } = await import('@/repositories');
    const existing = await getOgEntry(url);
    if (existing !== undefined && Date.now() - existing.fetchedAt < 7 * 86400_000) return;

    // 增加并发计数
    await chrome.storage.session.set({ ogInFlight: currentInFlight + 1 });
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), OG_TIMEOUT_MS);
      const resp = await fetch(url, {
        method: 'GET',
        headers: { Range: `bytes=0-${OG_MAX_BYTES - 1}` },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!resp.ok) return;
      const text = await resp.text();

      // 解析 meta description（避免 DOMParser 在 SW 不可用，这里用 regex）
      const ogMatch = /<meta[^>]+property\s*=\s*['"]og:description['"][^>]*content\s*=\s*['"]([^'"]*)['"]/i.exec(text);
      const descMatch = /<meta[^>]+name\s*=\s*['"]description['"][^>]*content\s*=\s*['"]([^'"]*)['"]/i.exec(text);
      const titleMatch = /<title>([^<]*)<\/title>/i.exec(text);
      const description = (ogMatch?.[1] ?? descMatch?.[1] ?? '').slice(0, 500);
      if (description === '') return;

      await saveOgEntry({
        url,
        title: titleMatch?.[1]?.slice(0, 200) ?? '',
        description,
        fetchedAt: Date.now(),
      });
    } catch {
      // 静默失败
    } finally {
      // 减少并发计数
      const updated = await chrome.storage.session.get('ogInFlight');
      const updatedValue = (updated['ogInFlight'] as number) ?? 0;
      await chrome.storage.session.set({ ogInFlight: Math.max(0, updatedValue - 1) });
    }
  } catch {
    // 静默
  }
}

// ── Trending Cache Refresh (v1.4) ────────────────────

/**
 * 后台静默刷新热榜缓存
 *
 * 仅当存在缓存（说明用户使用过热榜功能）时才刷新，
 * 避免从未用过热榜的用户产生不必要的网络请求。
 */
async function refreshTrendingCache(): Promise<void> {
  try {
    const { storageGet, storageSet } = await import('@/chrome');
    const cache = await storageGet<Record<string, unknown>>(STORAGE_KEYS.trendingCache);
    // 无缓存 → 用户从未用过热榜，跳过
    if (!cache || !cache.boards || typeof cache.boards !== 'object') return;

    const boards = cache.boards as Record<string, Record<string, unknown>>;
    const boardIds = Object.keys(boards);
    if (boardIds.length === 0) return;

    // 使用小尘API刷新每个已缓存的平台
    const FETCH_TIMEOUT_MS = 6000;
    const MAX_ITEMS = 20;
    const API_BASE = 'https://api.xcvts.cn/api/hotlist';

    for (const boardId of boardIds) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        const resp = await fetch(`${API_BASE}?type=${encodeURIComponent(boardId)}`, {
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (!resp.ok) continue;
        const json = await resp.json() as {
          success?: boolean;
          data?: Record<string, unknown>[];
          title?: string;
          subtitle?: string;
          update_time?: string;
        };

        if (json.success !== true || !Array.isArray(json.data)) continue;
        if (json.data.length === 0) continue;

        const items = json.data.slice(0, MAX_ITEMS).map((raw) => ({
          id: String(raw.index ?? raw.id ?? ''),
          title: String(raw.title ?? ''),
          desc: raw.desc ? String(raw.desc) : undefined,
          pic: raw.pics ? String(raw.pics) : undefined,
          hot: typeof raw.hot === 'number' ? raw.hot : undefined,
          hotLabel: typeof raw.hot === 'string' ? raw.hot : undefined,
          url: String(raw.url ?? ''),
          mobileUrl: raw.mobilUrl ? String(raw.mobilUrl) : undefined,
        })).filter((item: { title: string }) => item.title !== '');

        (cache.boards as Record<string, unknown>)[boardId] = {
          ...(boards[boardId] ?? {}),
          items,
          updateTime: json.update_time,
          from: 'xcvts',
        };
      } catch {
        // 单平台刷新失败不影响其他
      }
    }

    (cache as Record<string, unknown>).lastRefreshAt = Date.now();
    await storageSet(STORAGE_KEYS.trendingCache, cache);
  } catch (err) {
    console.warn(`${SW_LOG_TAG} trending cache refresh failed`, err);
  }
}
