/**
 * Canopy — Service Worker
 *
 * Responsibilities:
 * 1. Listen to chrome.tabs / chrome.windows events
 * 2. Broadcast changes to all new tab pages via BroadcastChannel
 * 3. Handle context menu for "Save All Tabs"
 * 4. Alarms for periodic stats snapshot
 */

import type { SwBroadcastMessage } from '@/shared/types';

const CHANNEL_NAME = 'canopy-sw-broadcast';
const channel = new BroadcastChannel(CHANNEL_NAME);

function broadcast(type: SwBroadcastMessage['type'], payload: Record<string, unknown> = {}): void {
  const message: SwBroadcastMessage = {
    type,
    payload,
    timestamp: Date.now(),
  };
  channel.postMessage(message);
}

// ── Tab Event Listeners ───────────────────────────────

chrome.tabs.onCreated.addListener((tab) => {
  broadcast('tab-created', {
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
    broadcast('tab-updated', {
      id: tabId,
      url: tab.url ?? '',
      title: tab.title ?? '',
      favIconUrl: tab.favIconUrl ?? '',
      windowId: tab.windowId,
      status: changeInfo.status,
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  broadcast('tab-removed', {
    id: tabId,
    windowId: removeInfo.windowId,
    isWindowClosing: removeInfo.isWindowClosing,
  });
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  broadcast('tab-activated', {
    id: activeInfo.tabId,
    windowId: activeInfo.windowId,
  });
});

chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
  broadcast('tab-moved', {
    id: tabId,
    windowId: moveInfo.windowId,
    fromIndex: moveInfo.fromIndex,
    toIndex: moveInfo.toIndex,
  });
});

// ── Window Event Listeners ────────────────────────────

chrome.windows.onFocusChanged.addListener((windowId) => {
  broadcast('window-focus-changed', { windowId });
});

// ── Context Menu ──────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'canopy-save-all',
    title: chrome.i18n.getMessage('context_save_all') || 'Save all tabs to Canopy',
    contexts: ['action'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === 'canopy-save-all') {
    try {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const toSave = tabs.filter((tab) => {
        const url = tab.url || tab.pendingUrl || '';
        if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:')) return false;
        if (tab.pinned) return false;
        if (tab.incognito) return false;
        return true;
      });
      if (toSave.length === 0) return;

      const { nanoid } = await import('nanoid');
      const session = {
        id: nanoid(10),
        name: `会话 ${new Date().toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
        createdAt: Date.now(),
        tabs: toSave.map((tab) => ({
          url: tab.url || tab.pendingUrl || '',
          title: tab.title || '',
          favIconUrl: tab.favIconUrl || '',
          hostname: (() => { try { return new URL(tab.url || '').hostname; } catch { return ''; } })(),
          pinned: tab.pinned,
        })),
        tabCount: toSave.length,
      };

      // 保存到 storage
      const result = await chrome.storage.local.get('canopy_sessions');
      const sessions: unknown[] = Array.isArray(result.canopy_sessions) ? result.canopy_sessions : [];
      sessions.unshift(session);
      await chrome.storage.local.set({ canopy_sessions: sessions });

      // 关闭已归档标签
      const tabIds = toSave.map((t) => t.id).filter((id): id is number => id !== undefined);
      if (tabIds.length > 0) {
        await chrome.tabs.remove(tabIds);
      }
    } catch (err) {
      console.error('[Canopy SW] Save all tabs failed:', err);
    }
  }
});

// ── 全局快捷键 ────────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
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
    /** 归档当前窗口所有标签——与上下文菜单同一逻辑 */
    try {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const toSave = tabs.filter((tab) => {
        const url = tab.url || tab.pendingUrl || '';
        if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:')) return false;
        if (tab.pinned) return false;
        if (tab.incognito) return false;
        return true;
      });
      if (toSave.length === 0) return;

      const { nanoid } = await import('nanoid');
      const session = {
        id: nanoid(10),
        name: `会话 ${new Date().toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
        createdAt: Date.now(),
        tabs: toSave.map((tab) => ({
          url: tab.url || tab.pendingUrl || '',
          title: tab.title || '',
          favIconUrl: tab.favIconUrl || '',
          hostname: (() => { try { return new URL(tab.url || '').hostname; } catch { return ''; } })(),
          pinned: tab.pinned,
        })),
        tabCount: toSave.length,
      };

      const result = await chrome.storage.local.get('canopy_sessions');
      const sessions: unknown[] = Array.isArray(result.canopy_sessions) ? result.canopy_sessions : [];
      sessions.unshift(session);
      await chrome.storage.local.set({ canopy_sessions: sessions });

      const tabIds = toSave.map((t) => t.id).filter((id): id is number => id !== undefined);
      if (tabIds.length > 0) {
        await chrome.tabs.remove(tabIds);
      }
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
});

// ── Alarms ────────────────────────────────────────────

chrome.alarms.create('canopy-stats-heartbeat', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'canopy-stats-heartbeat') {
    // Will be expanded in Phase 7 (Frequency stats)
    // For now, just ensure SW stays alive
  }
});

// ── Lifecycle ─────────────────────────────────────────

self.addEventListener('install', () => {
  console.log('[Canopy SW] Installed');
});

self.addEventListener('activate', () => {
  console.log('[Canopy SW] Activated');
});
