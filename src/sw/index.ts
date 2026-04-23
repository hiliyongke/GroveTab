/**
 * Canopy — Service Worker
 *
 * Responsibilities:
 * 1. Listen to chrome.tabs / chrome.windows events
 * 2. Broadcast changes to all new tab pages via BroadcastChannel
 * 3. Handle context menu for "Save All Tabs"
 * 4. Alarms for periodic stats snapshot
 */

import { swBroadcast } from '@/shared/utils/sw-broadcast';
import { archiveCurrentWindowTabs } from './archive-handler';

/** 上一次轮询时的 tab discarded 状态缓存，用于检测 discard 变化 */
const cachedTabDiscardedState = new Map<number, boolean>();

/** 检查 tab 的 discarded 状态变化并广播 */
async function checkDiscardedTabs(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id === undefined) continue;
      const prev = cachedTabDiscardedState.get(tab.id);
      const curr = tab.discarded ?? false;
      if (prev !== undefined && prev !== curr) {
        // discarded 状态变化：false→true 为 discard，true→false 为 restore
        swBroadcast('tab-discarded', { id: tab.id, discarded: curr, windowId: tab.windowId });
      }
      cachedTabDiscardedState.set(tab.id, curr);
    }
  } catch {
    // 忽略轮询错误，避免 SW 因异常而停止
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
    title: chrome.i18n.getMessage('context_save_all') || 'Save all tabs to Canopy',
    contexts: ['action'],
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  void (async () => {
    if (info.menuItemId === 'canopy-save-all') {
      try {
        await archiveCurrentWindowTabs();
      } catch (err) {
        console.error('[Canopy SW] Save all tabs failed:', err);
      }
    }
  })();
});

// ── 全局快捷键 ────────────────────────────────────────

chrome.commands.onCommand.addListener((command) => {
  void (async () => {
    if (command === 'open-canopy') {
      /** 在当前窗口打开 Canopy 新标签页 */
      try {
        const url = chrome.runtime.getURL('src/pages/newtab/index.html');
        await chrome.tabs.create({ url });
      } catch (err) {
        console.error('[Canopy SW] Open Canopy failed:', err);
      }
    }

    if (command === 'save-all-tabs') {
      /** 归档当前窗口所有标签——复用 archive-handler 公共逻辑 */
      try {
        await archiveCurrentWindowTabs();
      } catch (err) {
        console.error('[Canopy SW] Save all (command) failed:', err);
      }
    }

    if (command === 'toggle-search') {
      /** 打开 Canopy 并聚焦搜索框——通过 URL hash 传递信号 */
      try {
        const url = chrome.runtime.getURL('src/pages/newtab/index.html#search');
        await chrome.tabs.create({ url });
      } catch (err) {
        console.error('[Canopy SW] Toggle search failed:', err);
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
  console.log('[Canopy SW] Installed');
});

self.addEventListener('activate', () => {
  console.log('[Canopy SW] Activated');
});
