/**
 * Canopy — Service Worker
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

const STATS_FLUSH_INTERVAL_MS = 30_000;
const STATS_RETAIN_DAYS = 30;

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
  statsMem.byUrl.clear();
  statsMem.dirty = false;
  statsMem.lastFlushAt = Date.now();
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
  } catch (err) {
        console.warn(`${SW_LOG_TAG} flushStats failed`, err);
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
    id: 'canopy-save-all',
    title: chrome.i18n.getMessage('context_save_all') || `Save all tabs to ${BRAND.name}`,
    contexts: ['action'],
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  void (async () => {
    if (info.menuItemId === 'canopy-save-all') {
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
    if (command === 'open-grovetab') {
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

void chrome.alarms.create('canopy-stats-heartbeat', { periodInMinutes: 1 });
void chrome.alarms.create('canopy-auto-snapshot', { periodInMinutes: 60 });

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
  if (alarm.name === 'canopy-stats-heartbeat') {
    void checkDiscardedTabs();
    void flushStats(true);
  } else if (alarm.name === 'canopy-auto-snapshot') {
    void autoSnapshotIfNeeded();
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
 * Chrome MV3 SW 真正挂起时无确定事件，但 chrome.runtime.onSuspend 在大多数情况下可用。
 */
try {
  chrome.runtime.onSuspend?.addListener(() => {
    void flushStats(true);
  });
} catch {
  // 某些老版本 Chrome 没有 onSuspend
}

// ── OG Fetcher（F-24） ────────────────────────────────
let ogInFlight = 0;
const OG_CONCURRENCY = 5;
const OG_TIMEOUT_MS = 3000;
const OG_MAX_BYTES = 50 * 1024;

async function maybeFetchOg(url: string): Promise<void> {
  try {
    const settings = await getSettings();
    if (settings.enableOgFetch !== true) return;
    if (ogInFlight >= OG_CONCURRENCY) return;

    // 已存在则跳过
    const { getOgEntry, saveOgEntry } = await import('@/repositories');
    const existing = await getOgEntry(url);
    if (existing !== undefined && Date.now() - existing.fetchedAt < 7 * 86400_000) return;

    ogInFlight += 1;
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
      ogInFlight -= 1;
    }
  } catch {
    // 静默
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

  // 检测 discarded 状态变化（Chrome Memory Saver 或其他扩展触发）——
  // 注意：changeInfo.discarded 不一定每次都存在，需要拿 tab 对象本身的 discarded 做比对
  const discarded = tab.discarded ?? false;
  const prev = cachedTabDiscardedState.get(tabId);
  if (prev !== discarded) {
    cachedTabDiscardedState.set(tabId, discarded);
    swBroadcast('tab-discarded', { id: tabId, discarded, windowId: tab.windowId });
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
    id: 'canopy-save-all',
    title: chrome.i18n.getMessage('context_save_all') || `Save all tabs to ${BRAND.name}`,
    contexts: ['action'],
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  void (async () => {
    if (info.menuItemId === 'canopy-save-all') {
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
    if (command === 'open-grovetab') {
      /** 在当前窗口打开 GroveTab 新标签页 */
      try {
        const url = chrome.runtime.getURL('src/pages/newtab/index.html');
        await chrome.tabs.create({ url });
      } catch (err) {
        console.error(`${SW_LOG_TAG} Open ${BRAND.name} failed:`, err);
      }
    }

    if (command === 'save-all-tabs') {
      /** 归档当前窗口所有标签——复用 archive-handler 公共逻辑 */
      try {
        await archiveCurrentWindowTabs();
      } catch (err) {
        console.error(`${SW_LOG_TAG} Save all (command) failed:`, err);
      }
    }

    if (command === 'toggle-search') {
      /** 打开 GroveTab 并聚焦搜索框——通过 URL hash 传递信号 */
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

void chrome.alarms.create('canopy-stats-heartbeat', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'canopy-stats-heartbeat') {
    // 检查 tab discarded 状态变化（用于跨窗口同步）
    void checkDiscardedTabs();
  }
});

// ── Lifecycle ─────────────────────────────────────────

self.addEventListener('install', () => {
  console.log(`${SW_LOG_TAG} Installed`);
});

self.addEventListener('activate', () => {
  console.log(`${SW_LOG_TAG} Activated`);
});
