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

import { swBroadcast } from "@/shared/utils/sw-broadcast";
import { archiveCurrentWindowTabs } from "./archive-handler";
import { createAutoSnapshot } from "@/services/archive";
import { maybeFetchOg } from "./og-fetcher";
import { refreshTrendingCache } from "./trending-refresh";
import { executeScheduledRules, executeOnEventRules } from "./automation-engine";
import { incrementStats, incrementFocusTime, flushStats, flushFocusTime, handleTabSwitch } from "./collector";
import {
  getSettings,
  getAutoSnapshotMeta,
  saveAutoSnapshotMeta,
  appendHistoryEvent,
  pushClosedTab,
  pushClosedWindow,
  isUrlIgnored,
  upsertDailySnapshot,
  getTodaySnapshot,
  snapshotDateKey,
  getActiveFocusSession,
  setActiveFocusSession,
} from "@/repositories";
import { BRAND } from "@/shared/config/brand";
import { CONFIG } from "@/shared/config";
import { APP_INTERNAL_IDS } from "@/shared/config/storage-keys";

/** 统一日志前缀：SW 内所有 console.log/warn/error 都走 SW_LOG_TAG */
const SW_LOG_TAG = `${BRAND.logTag} SW`;

/** 上一次轮询时的 tab discarded 状态缓存，用于检测 discard 变化 */
const cachedTabDiscardedState = new Map<number, boolean>();

// ── 历史记录快照缓存 ────────────────────────────────
/**
 * tabs.onRemoved 触发时，tab 已被删除、拿不到 url/title。
 * 因此需要在每次 onCreated/onUpdated 中维护一份内存快照，
 * onRemoved 时从快照读取写入「最近关闭」列表。
 *
 * 【注意】MV3 SW 会被挂起。获其他请求唤醒后，这份内存快照会丢失；
 * 另外补上「启动时全量拉一次」的兑底（见下面 hydrateTabSnapshots）。
 */
interface TabSnapshot {
  id: number;
  url: string;
  title: string;
  favIconUrl: string;
  windowId: number;
  pinned: boolean;
  incognito: boolean;
}
const tabSnapshots = new Map<number, TabSnapshot>();
/** tabId → groupId 缓存，用于识别标签被加入/移出 Tab Group。 */
const tabGroupSnapshots = new Map<number, number>();

/** 记录「本次被成套关闭」的窗口： windowId -> closedTab 记录 id 集 */
const windowCloseBuffer = new Map<number, string[]>();

function snapshotTab(tab: chrome.tabs.Tab): void {
  if (tab.id === undefined) return;
  tabSnapshots.set(tab.id, {
    id: tab.id,
    url: tab.url ?? tab.pendingUrl ?? "",
    title: tab.title ?? "",
    favIconUrl: tab.favIconUrl ?? "",
    windowId: tab.windowId,
    pinned: tab.pinned ?? false,
    incognito: tab.incognito ?? false,
  });
  tabGroupSnapshots.set(tab.id, tab.groupId ?? -1);
}

/** SW 启动时全量补一次，避免被挂起后快照丢失 */
async function hydrateTabSnapshots(): Promise<void> {
  try {
    const allTabs = await chrome.tabs.query({});
    for (const tab of allTabs) snapshotTab(tab);
  } catch {
    /* SW 初始化期间调用可能失败 */
  }
}
void hydrateTabSnapshots();

/**
 * 「每日标签页快照」：
 *   - 在 SW 启动 / 安装 / onStartup 时调用
 *   - 同一天只拍一次（按本地时区 YYYY-MM-DD 判重）
 *   - 拍照内容：当前所有标签页按 hostname 聚合的 [host, count] 列表
 *
 * 用作 HistoryView 顶部「昨天 → 今天」对比的源数据。
 */
async function maybeCaptureDailySnapshot(): Promise<void> {
  try {
    const today = await getTodaySnapshot();
    if (today !== undefined) return; // 今天已拍过

    const tabs = await chrome.tabs.query({});
    const counter = new Map<string, number>();
    for (const t of tabs) {
      // 与 historyEvents 同步策略：忽略 chrome:// 等内置页和隐身窗口
      if (t.incognito) continue;
      const url = t.url ?? t.pendingUrl ?? "";
      if (isUrlIgnored(url)) continue;
      let host = "";
      try {
        host = new URL(url).hostname;
      } catch {
        continue;
      }
      if (host === "") continue;
      counter.set(host, (counter.get(host) ?? 0) + 1);
    }
    const hosts = [...counter.entries()].sort((a, b) => b[1] - a[1]);
    await upsertDailySnapshot({
      dateKey: snapshotDateKey(),
      ts: Date.now(),
      totalTabs: tabs.filter((t) => !t.incognito).length,
      hosts,
    });
  } catch (err) {
    console.warn(`${SW_LOG_TAG} maybeCaptureDailySnapshot failed:`, err);
  }
}
// 启动即尝试一次（同一天有则跳过）
void maybeCaptureDailySnapshot();
chrome.runtime.onStartup.addListener(() => {
  void maybeCaptureDailySnapshot();
});

/**
 * 在指定窗口被整体关闭后的一个宏任务周期里，把该窗口下累积的 closedTab
 * 起一个 ClosedWindowRecord 快照。动机：Chrome 关闭窗口时会贯穿着发 N 个 tab onRemoved
 * 事件（isWindowClosing=true），收集完后起一个“整窗快照”便于一键恢复。
 */
const windowCloseFlushTimers = new Map<number, ReturnType<typeof setTimeout>>();
function scheduleWindowCloseFlush(windowId: number): void {
  const existing = windowCloseFlushTimers.get(windowId);
  if (existing !== undefined) clearTimeout(existing);
  const timer = setTimeout(() => {
    void (async () => {
      windowCloseFlushTimers.delete(windowId);
      const ids = windowCloseBuffer.get(windowId) ?? [];
      windowCloseBuffer.delete(windowId);
      if (ids.length < 2) return; // 单 tab 没必要当作整窗快照
      try {
        await pushClosedWindow({
          windowId,
          tabIds: ids,
          tabCount: ids.length,
          preview: "",
        });
        await appendHistoryEvent({
          type: "window_closed",
          windowId,
          extra: { tabCount: ids.length },
        });
      } catch (err) {
        console.warn(`${SW_LOG_TAG} flush window close failed`, err);
      }
    })();
  }, 800);
  windowCloseFlushTimers.set(windowId, timer);
}

// StatsCollector + FocusTimeTracker → sw/collector.ts (CODE-01 阶段3)

// ── Tab Event Listeners ───────────────────────────────

chrome.tabs.onCreated.addListener((tab) => {
  // 维护快照
  snapshotTab(tab);
  // 记录“打开新标签页”事件（仅当 url 有意义时）
  const url = tab.url ?? tab.pendingUrl ?? "";
  if (url !== "" && !isUrlIgnored(url)) {
    void appendHistoryEvent({
      type: "tab_opened",
      url,
      title: tab.title ?? "",
      favIconUrl: tab.favIconUrl ?? "",
      windowId: tab.windowId,
      incognito: tab.incognito,
    });
  }
  swBroadcast("tab-created", {
    id: tab.id,
    url: tab.url ?? tab.pendingUrl ?? "",
    title: tab.title ?? "",
    windowId: tab.windowId,
    pinned: tab.pinned,
    incognito: tab.incognito,
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const previousGroupId = tabGroupSnapshots.get(tabId) ?? -1;
  const nextGroupId = tab.groupId ?? -1;

  // 同步更新快照（拿到最新 url/title/favicon，供 onRemoved 读取）
  snapshotTab(tab);

  // 自动化规则引擎：URL 变更时触发 onEvent 规则
  if (changeInfo.url && tab.url) {
    void executeOnEventRules("tabUpdated", tab);
  }

  if (typeof changeInfo.groupId === "number" || previousGroupId !== nextGroupId) {
    swBroadcast(nextGroupId === -1 ? "tab-ungrouped" : "tab-grouped", {
      id: tabId,
      windowId: tab.windowId,
      previousGroupId,
      groupId: nextGroupId,
    });
  }

  // 仅广播有意义的变更
  if (
    changeInfo.url ||
    changeInfo.title ||
    changeInfo.favIconUrl ||
    changeInfo.status === "complete"
  ) {
    swBroadcast("tab-updated", {
      id: tabId,
      url: tab.url ?? "",
      title: tab.title ?? "",
      favIconUrl: tab.favIconUrl ?? "",
      windowId: tab.windowId,
      status: changeInfo.status,
    });
  }

  // 检测 discarded 状态变化
  const discarded = tab.discarded ?? false;
  const prev = cachedTabDiscardedState.get(tabId);
  if (prev !== discarded) {
    cachedTabDiscardedState.set(tabId, discarded);
    swBroadcast("tab-discarded", { id: tabId, discarded, windowId: tab.windowId });
  }

  // OG description 抓取（F-24，enableOgFetch=true 且授权 <all_urls> 时触发）
  if (changeInfo.status === "complete" && tab.url !== undefined && /^https?:\/\//.test(tab.url)) {
    void maybeFetchOg(tab.url);
  }
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  // 从快照中拿出被关闭 tab 的信息，写入「最近关闭」与「历史事件」
  const snap = tabSnapshots.get(tabId);
  tabSnapshots.delete(tabId);
  tabGroupSnapshots.delete(tabId);
  if (snap !== undefined && !snap.incognito && !isUrlIgnored(snap.url)) {
    void (async () => {
      try {
        const tabs = await pushClosedTab({
          url: snap.url,
          title: snap.title === "" ? snap.url : snap.title,
          favIconUrl: snap.favIconUrl,
          windowId: snap.windowId,
          fromWindowClose: removeInfo.isWindowClosing,
          pinned: snap.pinned,
          incognito: snap.incognito,
        });
        await appendHistoryEvent({
          type: "tab_closed",
          url: snap.url,
          title: snap.title,
          favIconUrl: snap.favIconUrl,
          windowId: snap.windowId,
          incognito: snap.incognito,
          extra: { fromWindowClose: removeInfo.isWindowClosing },
        });
        // 收集到 windowCloseBuffer、稍后起一个「整窗快照」
        if (removeInfo.isWindowClosing) {
          const newId = tabs[0]?.id ?? "";
          if (newId !== "") {
            const arr = windowCloseBuffer.get(snap.windowId) ?? [];
            arr.push(newId);
            windowCloseBuffer.set(snap.windowId, arr);
            scheduleWindowCloseFlush(snap.windowId);
          }
        }
      } catch (err) {
        console.warn(`${SW_LOG_TAG} record closed tab failed`, err);
      }
    })();
  }

  // FocusTimeTracker：如果被关闭的是当前激活标签，结算其时长（仅在设置开启时）
  void (async () => {
    try {
      const settings = await getSettings();
      if (settings.trackTabFocusTime === false) return;
      const session = await getActiveFocusSession();
      if (session !== null && session.tabId === tabId && snap !== undefined) {
        const duration = Date.now() - session.activatedAt;
        incrementFocusTime(snap.url, duration);
        await setActiveFocusSession(null);
        void flushFocusTime(false);
      }
    } catch {
      // ignore
    }
  })();

  swBroadcast("tab-removed", {
    id: tabId,
    windowId: removeInfo.windowId,
    isWindowClosing: removeInfo.isWindowClosing,
  });
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  swBroadcast("tab-activated", {
    id: activeInfo.tabId,
    windowId: activeInfo.windowId,
  });
  // StatsCollector：记一次激活
  void (async () => {
    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      const url = tab.url ?? tab.pendingUrl ?? "";
      if (url !== "") incrementStats(url);
      void flushStats(false);
      // FocusTimeTracker：记录标签切换（仅在设置开启时）
      const settings = await getSettings();
      if (settings.trackTabFocusTime !== false) {
        void handleTabSwitch(activeInfo.tabId, url);
      }
    } catch {
      // ignore
    }
  })();
});

chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
  swBroadcast("tab-moved", {
    id: tabId,
    windowId: moveInfo.windowId,
    fromIndex: moveInfo.fromIndex,
    toIndex: moveInfo.toIndex,
  });
});

/**
 * onAttached / onDetached：当用户**直接在浏览器原生标签栏**把 tab 拖到另一个窗口时触发，
 * Chrome 不会发 onMoved（onMoved 仅限同窗口内移动），必须监听这两条事件才能让插件 UI
 * 与浏览器实时双向同步。
 */
chrome.tabs.onAttached.addListener((tabId, attachInfo) => {
  // 同步快照中的 windowId，否则 onRemoved 时记录到错误窗口
  const snap = tabSnapshots.get(tabId);
  if (snap !== undefined) {
    snap.windowId = attachInfo.newWindowId;
  }
  swBroadcast("tab-attached", {
    id: tabId,
    windowId: attachInfo.newWindowId,
    newPosition: attachInfo.newPosition,
  });
});

chrome.tabs.onDetached.addListener((tabId, detachInfo) => {
  swBroadcast("tab-detached", {
    id: tabId,
    oldWindowId: detachInfo.oldWindowId,
    oldPosition: detachInfo.oldPosition,
  });
});

/**
 * onReplaced：预渲染 / 后台标签转前台等场景，旧 tabId 被替换为新 tabId。
 * 不广播详细 payload，触发一次全量刷新即可。
 */
chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  // 旧 id 不再有效，先把快照搬到新 id 上
  const snap = tabSnapshots.get(removedTabId);
  if (snap !== undefined) {
    tabSnapshots.delete(removedTabId);
    tabSnapshots.set(addedTabId, { ...snap, id: addedTabId });
  }
  const groupId = tabGroupSnapshots.get(removedTabId);
  if (groupId !== undefined) {
    tabGroupSnapshots.delete(removedTabId);
    tabGroupSnapshots.set(addedTabId, groupId);
  }
  // 借用 tab-updated 触发前端的全量静默刷新（store 对 tab-updated 不做全量刷新——
  // 这里改用 tab-moved 语义，前端会 silent reload）
  swBroadcast("tab-moved", { id: addedTabId, replacedFrom: removedTabId });
});

if (typeof chrome.tabGroups !== "undefined") {
  // Chrome 138+ 提供 onCreated；老版本运行时该事件可能不存在，做特性检测
  if (
    typeof (
      chrome.tabGroups as {
        onCreated?: chrome.events.Event<(group: chrome.tabGroups.TabGroup) => void>;
      }
    ).onCreated !== "undefined"
  ) {
    chrome.tabGroups.onCreated.addListener((group) => {
      swBroadcast("tab-group-updated", {
        id: group.id,
        title: group.title,
        color: group.color,
        collapsed: group.collapsed,
        windowId: group.windowId,
      });
    });
  }

  chrome.tabGroups.onUpdated.addListener((group) => {
    swBroadcast("tab-group-updated", {
      id: group.id,
      title: group.title,
      color: group.color,
      collapsed: group.collapsed,
      windowId: group.windowId,
    });
  });

  chrome.tabGroups.onMoved.addListener((group) => {
    swBroadcast("tab-group-updated", {
      id: group.id,
      title: group.title,
      color: group.color,
      collapsed: group.collapsed,
      windowId: group.windowId,
    });
  });

  chrome.tabGroups.onRemoved.addListener((group) => {
    swBroadcast("tab-ungrouped", {
      groupId: group.id,
      windowId: group.windowId,
    });
  });
}

// ── Bookmark Event Listeners（需求 5.1）─────────────────
// 仅在 bookmarks 权限已授予时注册（optional permission）
// chrome.bookmarks 在未授权时为 undefined
if (typeof chrome.bookmarks !== "undefined") {
  chrome.bookmarks.onCreated.addListener((id, bookmark) => {
    swBroadcast("bookmark-created", {
      id,
      url: bookmark.url,
      title: bookmark.title,
      parentId: bookmark.parentId,
    });
  });

  chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
    swBroadcast("bookmark-changed", { id, title: changeInfo.title, url: changeInfo.url });
  });

  chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
    swBroadcast("bookmark-removed", { id, parentId: removeInfo.parentId, index: removeInfo.index });
  });

  chrome.bookmarks.onMoved.addListener((id, moveInfo) => {
    swBroadcast("bookmark-moved", {
      id,
      parentId: moveInfo.parentId,
      oldParentId: moveInfo.oldParentId,
    });
  });
}

// ── Window Event Listeners ────────────────────────────

chrome.windows.onFocusChanged.addListener((windowId) => {
  swBroadcast("window-focus-changed", { windowId });
});

/**
 * 用户在浏览器中新建 / 关闭整个窗口时实时同步给插件 UI，
 * 让 WindowView 的卡片随浏览器动态增减，而不是等下次手动刷新。
 */
chrome.windows.onCreated.addListener((window) => {
  swBroadcast("window-created", {
    windowId: window.id,
    incognito: window.incognito,
    type: window.type,
  });
});

chrome.windows.onRemoved.addListener((windowId) => {
  swBroadcast("window-removed", { windowId });
});

// ── Context Menu ──────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "app-save-all",
    title: chrome.i18n.getMessage("context_save_all") || `Save all tabs to ${BRAND.name}`,
    contexts: ["action"],
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  void (async () => {
    if (info.menuItemId === "app-save-all") {
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
        const url = chrome.runtime.getURL("src/pages/newtab/index.html");
        await chrome.tabs.create({ url });
      } catch (err) {
        console.error(`${SW_LOG_TAG} Open ${BRAND.name} failed:`, err);
      }
    }

    if (command === "save-all-tabs") {
      try {
        await archiveCurrentWindowTabs();
      } catch (err) {
        console.error(`${SW_LOG_TAG} Save all (command) failed:`, err);
      }
    }

    if (command === "toggle-search") {
      try {
        // 尝试找到已打开的 GroveTab 窗口并聚焦
        const groveTabs = await chrome.tabs.query({
          url: chrome.runtime.getURL("src/pages/newtab/index.html"),
        });
        const existingTab = groveTabs.find((t) => !t.discarded && t.id !== undefined);
        if (existingTab?.id !== undefined) {
          // 已有窗口 → 聚焦 + 发送 toggle-search 信号
          await chrome.tabs.update(existingTab.id, { active: true });
          // 发消息让该窗口切换搜索框显隐（不走 hash，避免 URL 变化）
          await chrome.tabs.sendMessage(existingTab.id, { type: "toggle-search" });
        } else {
          // 无窗口 → 创建新标签并自动聚焦搜索
          const url = chrome.runtime.getURL("src/pages/newtab/index.html#search");
          await chrome.tabs.create({ url, active: true });
        }
      } catch (err) {
        console.error(`${SW_LOG_TAG} Toggle search failed:`, err);
      }
    }

    if (command === "open-history") {
      try {
        const url = chrome.runtime.getURL("src/pages/newtab/index.html#history");
        await chrome.tabs.create({ url });
      } catch (err) {
        console.error(`${SW_LOG_TAG} Open history failed:`, err);
      }
    }
  })();
});
// ── Alarms ────────────────────────────────────────────

void chrome.alarms.create(APP_INTERNAL_IDS.statsHeartbeatAlarm, { periodInMinutes: 1 });
void chrome.alarms.create(APP_INTERNAL_IDS.autoSnapshotAlarm, { periodInMinutes: 60 });
void chrome.alarms.create(APP_INTERNAL_IDS.trendingRefreshAlarm, { periodInMinutes: 30 });

async function autoSnapshotIfNeeded(): Promise<void> {
  try {
    const settings = await getSettings();
    const freq = settings.autoSnapshotFrequency ?? "12h";
    if (freq === "off") return;

    // 解析频率为毫秒
    const freqMs = (() => {
      switch (freq) {
        case "6h":
          return 6 * 3600 * 1000;
        case "12h":
          return 12 * 3600 * 1000;
        case "24h":
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
    if (nonPinned.length < CONFIG.performance.autoSnapshotMinTabs) return;

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
        swBroadcast("tab-discarded", { id: tab.id, discarded: curr, windowId: tab.windowId });
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
    void flushFocusTime(true);
    void executeScheduledRules();
  } else if (alarm.name === APP_INTERNAL_IDS.autoSnapshotAlarm) {
    void autoSnapshotIfNeeded();
  } else if (alarm.name === APP_INTERNAL_IDS.trendingRefreshAlarm) {
    void refreshTrendingCache();
  }
});

// Automation Rule Engine → sw/automation-engine.ts (CODE-01 阶段2)

// ── Lifecycle ─────────────────────────────────────────

self.addEventListener("install", () => {
  console.log(`${SW_LOG_TAG} Installed`);
});

self.addEventListener("activate", () => {
  console.log(`${SW_LOG_TAG} Activated`);
});

/**
 * Service Worker 挂起前刷盘，避免数据丢失。
 *
 * 注意：Chrome MV3 的 Service Worker 没有可靠的挂起前事件，
 * 已移除 chrome.runtime.onSuspend（MV3 不可用）。
 * 当前已有每分钟一次的 heartbeat alarm 来定期刷盘。
 */

// OG Fetcher → sw/og-fetcher.ts (CODE-01)
// Trending Cache Refresh → sw/trending-refresh.ts (CODE-01)
