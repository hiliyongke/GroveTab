/**
 * Zustand Store — Tabs Slice
 *
 * Manages the list of live tabs with incremental updates from SW broadcasts.
 */

import { create } from 'zustand';
import type { LiveTab, SwBroadcastMessage, WindowInfo } from '@/shared/types';
import { queryAllTabs, getAllWindows, activateTab, closeTab, closeTabs, getFaviconUrl } from '@/chrome';
import { extractHostname, shouldDisplayUrl, isSelfNewTabPage } from '@/chrome';

interface TabsState {
  /** All live tabs (filtered for display) */
  tabs: LiveTab[];
  /** Current window ID */
  currentWindowId: number;
  /** Window info map */
  windows: Map<number, WindowInfo>;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;

  // Actions
  /** Initial full load of all tabs */
  loadAllTabs: () => Promise<void>;
  /** Handle SW broadcast message */
  handleBroadcast: (message: SwBroadcastMessage) => void;
  /** Activate (jump to) a tab */
  jumpToTab: (tabId: number, windowId: number) => Promise<void>;
  /** Close a single tab */
  closeSingleTab: (tabId: number) => Promise<void>;
  /** Close multiple tabs */
  closeMultipleTabs: (tabIds: number[]) => Promise<void>;
}

function tabToLiveTab(tab: chrome.tabs.Tab, currentWindowId: number): LiveTab | null {
  const url = tab.url || tab.pendingUrl || '';
  // Skip self new tab pages and non-displayable URLs
  if (isSelfNewTabPage(tab)) return null;
  if (!shouldDisplayUrl(url)) return null;

  return {
    id: tab.id!,
    url,
    title: tab.title || url,
    favIconUrl: tab.favIconUrl || getFaviconUrl(url),
    windowId: tab.windowId,
    incognito: tab.incognito,
    pinned: tab.pinned,
    audible: tab.audible ?? false,
    groupId: tab.groupId ?? -1,
    lastAccessed: tab.lastAccessed ?? 0,
    hostname: extractHostname(url),
    isCurrentWindow: tab.windowId === currentWindowId,
  };
}

export const useTabsStore = create<TabsState>((set, get) => ({
  tabs: [],
  currentWindowId: chrome.windows?.WINDOW_ID_CURRENT ?? -1,
  windows: new Map(),
  loading: false,
  error: null,

  loadAllTabs: async () => {
    set({ loading: true, error: null });
    try {
      const [allTabs, currentWindow] = await Promise.all([
        queryAllTabs(),
        chrome.windows.getCurrent(),
      ]);

      const currentWindowId = currentWindow.id!;
      const liveTabs = allTabs
        .map((tab) => tabToLiveTab(tab, currentWindowId))
        .filter(Boolean) as LiveTab[];

      // Build window info
      const allWindows = await getAllWindows();
      const windowMap = new Map<number, WindowInfo>();
      for (const win of allWindows) {
        windowMap.set(win.id!, {
          id: win.id!,
          focused: win.focused,
          type: win.type ?? 'normal',
          incognito: win.incognito,
          tabsCount: allTabs.filter((t) => t.windowId === win.id).length,
        });
      }

      set({
        tabs: liveTabs,
        currentWindowId,
        windows: windowMap,
        loading: false,
      });
    } catch (err) {
      set({ loading: false, error: String(err) });
    }
  },

  handleBroadcast: (message) => {
    const { tabs } = get();

    switch (message.type) {
      case 'tab-created': {
        // Reload all tabs to get accurate state
        get().loadAllTabs();
        break;
      }
      case 'tab-updated': {
        const { id, url, title, favIconUrl } = message.payload;
        set({
          tabs: tabs.map((t) =>
            t.id === id
              ? {
                  ...t,
                  url: (url as string) || t.url,
                  title: (title as string) || t.title,
                  favIconUrl: (favIconUrl as string) || t.favIconUrl,
                  hostname: url ? extractHostname(url as string) : t.hostname,
                }
              : t,
          ),
        });
        break;
      }
      case 'tab-removed': {
        const { id } = message.payload;
        set({ tabs: tabs.filter((t) => t.id !== id) });
        break;
      }
      case 'tab-activated': {
        const { id } = message.payload;
        // Update lastAccessed for the activated tab
        set({
          tabs: tabs.map((t) =>
            t.id === id ? { ...t, lastAccessed: Date.now() } : t,
          ),
        });
        break;
      }
      case 'tab-moved': {
        get().loadAllTabs();
        break;
      }
      case 'window-focus-changed': {
        const { windowId } = message.payload;
        if (windowId && windowId !== chrome.windows.WINDOW_ID_NONE) {
          set({
            currentWindowId: windowId as number,
            tabs: tabs.map((t) => ({
              ...t,
              isCurrentWindow: t.windowId === windowId,
            })),
          });
        }
        break;
      }
    }
  },

  jumpToTab: async (tabId, windowId) => {
    try {
      await activateTab(tabId, windowId);
    } catch (err) {
      set({ error: String(err) });
    }
  },

  closeSingleTab: async (tabId) => {
    try {
      await closeTab(tabId);
      // The tab-removed broadcast will update the store
    } catch (err) {
      set({ error: String(err) });
    }
  },

  closeMultipleTabs: async (tabIds) => {
    try {
      await closeTabs(tabIds);
    } catch (err) {
      set({ error: String(err) });
    }
  },
}));
