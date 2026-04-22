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

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'canopy-save-all') {
    // Will be implemented in Phase 5 (Archive)
    console.log('[Canopy SW] Save all tabs triggered');
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
