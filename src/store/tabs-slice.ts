/* eslint-disable i18n-zh/no-bare-zh-in-js */
/**
 * Zustand Store — Tabs Slice
 *
 * 标签页状态与操作入口。通过 SW broadcast 增量维护 live tabs 列表，
 * 关闭/跳转操作失败后自动静默刷新全量 tabs 以确保 UI 同步。
 */

import { create } from "zustand";
import type { LiveTab, SwBroadcastMessage, WindowInfo, ClosedTabSnapshot } from "@/shared/types";
import { CLOSE_CONFIRM_THRESHOLD } from "@/shared/types/settings";
import {
  queryAllTabs,
  getAllWindows,
  getCurrentWindow,
  activateTab,
  closeTab,
  closeTabs,
  getFaviconUrl,
  discardTab as chromeDiscardTab,
  queryTabGroups,
  WINDOW_ID_NONE,
  WINDOW_ID_CURRENT,
  type ChromeTabGroup,
} from "@/chrome";
import { extractHostname, shouldDisplayUrl, isSelfNewTabPage } from "@/chrome";
import { feedback } from "@/shared/ui/feedback";
import { translate } from "@/shared/i18n/core";
import { swBroadcast } from "@/shared/utils/sw-broadcast";
import { track } from "@/shared/utils/metrics";
import { useUndoStore } from "./undo-slice";
import { useSelectionStore } from "./selection-slice";
import { useSettingsStore } from "./settings-slice";
import { BRAND } from "@/shared/config/brand";
import { addToTrash } from "@/repositories/trash-repo";
import type { TrashedTab } from "@/shared/types";
import { archiveSelectedTabs } from "@/services/archive";

interface TabsState {
  tabs: LiveTab[];
  currentWindowId: number;
  windows: Map<number, WindowInfo>;
  loading: boolean;
  error: string | null;

  /** 拉取所有标签页。silent=true 时不设 loading=true，适合静默刷新。 */
  loadAllTabs: (options?: { silent?: boolean }) => Promise<void>;
  handleBroadcast: (message: SwBroadcastMessage) => void;
  jumpToTab: (tabId: number, windowId: number) => Promise<void>;
  closeSingleTab: (tabId: number) => Promise<void>;
  closeMultipleTabs: (tabIds: number[]) => Promise<void>;
  closeDomainGroup: (domain: string) => Promise<void>;
  closeAllNonPinned: () => Promise<void>;
  /** 休眠标签页以释放内存。 */
  discardTab: (tabId: number) => Promise<void>;
  discardMultipleTabs: (tabIds: number[]) => Promise<void>;
  discardDomainGroup: (domain: string) => Promise<void>;
}

function tabToLiveTab(tab: chrome.tabs.Tab, currentWindowId: number): LiveTab | null {
  if (tab.id == null) return null;
  const url = tab.url ?? tab.pendingUrl ?? "";
  if (isSelfNewTabPage(tab)) return null;
  if (!shouldDisplayUrl(url)) return null;

  /** 使用扩展同源的 _favicon/ 入口，避免跨域和控制台错误。非扩展上下文退回原始值。 */
  const extensionFavicon = getFaviconUrl(url);
  const favIconUrl = extensionFavicon !== "" ? extensionFavicon : (tab.favIconUrl ?? "");

  return {
    id: tab.id,
    url,
    title: tab.title ?? url,
    favIconUrl,
    windowId: tab.windowId,
    index: tab.index,
    incognito: tab.incognito,
    pinned: tab.pinned,
    audible: tab.audible ?? false,
    mutedInfo: tab.mutedInfo ? { muted: tab.mutedInfo.muted } : undefined,
    groupId: tab.groupId ?? -1,
    lastAccessed: tab.lastAccessed ?? 0,
    hostname: extractHostname(url),
    isCurrentWindow: tab.windowId === currentWindowId,
    discarded: tab.discarded ?? false,
    splitViewId: tab.splitViewId,
  };
}

function liveTabToSnapshot(tab: LiveTab): ClosedTabSnapshot {
  return {
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl,
    windowId: tab.windowId,
    pinned: tab.pinned,
  };
}

function liveTabToTrashedTab(tab: LiveTab): TrashedTab {
  return {
    id: tab.id,
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl,
    hostname: tab.hostname,
    pinned: tab.pinned,
    windowId: tab.windowId,
    groupId: tab.groupId ?? -1,
  };
}

/** 构建窗口信息映射，避免按窗口反复 `filter` 全量标签。 */
function buildWindowMap(
  allWindows: chrome.windows.Window[],
  allTabs: chrome.tabs.Tab[],
): Map<number, WindowInfo> {
  const tabsCountByWindowId = new Map<number, number>();
  for (const tab of allTabs) {
    tabsCountByWindowId.set(tab.windowId, (tabsCountByWindowId.get(tab.windowId) ?? 0) + 1);
  }

  const windowMap = new Map<number, WindowInfo>();
  for (const win of allWindows) {
    if (win.id == null) continue;
    windowMap.set(win.id, {
      id: win.id,
      focused: win.focused,
      type: win.type ?? "normal",
      incognito: win.incognito,
      tabsCount: tabsCountByWindowId.get(win.id) ?? 0,
    });
  }
  return windowMap;
}

/** 局部更新某个标签页的休眠状态。 */
function patchTabDiscardedState(tabs: LiveTab[], tabId: number, discarded: boolean): LiveTab[] {
  return tabs.map((tab) => (tab.id === tabId ? { ...tab, discarded } : tab));
}

/** 批量调用 Chrome 的 discard，并保留逐项成功/失败信息。 */
async function discardTabsBatch(
  tabIds: number[],
): Promise<{ succeededIds: number[]; failedIds: number[] }> {
  const results = await Promise.allSettled(tabIds.map((tabId) => chromeDiscardTab(tabId)));
  const succeededIds: number[] = [];
  const failedIds: number[] = [];

  results.forEach((result, index) => {
    const tabId = tabIds[index];
    if (tabId === undefined) return;
    if (result.status === "fulfilled") {
      succeededIds.push(tabId);
    } else {
      failedIds.push(tabId);
    }
  });

  return { succeededIds, failedIds };
}

function getCloseConfirmThreshold(): number {
  const value = useSettingsStore.getState().settings.closeConfirmThreshold;
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : CLOSE_CONFIRM_THRESHOLD;
}

export const useTabsStore = create<TabsState>((set, get) => ({
  tabs: [],
  currentWindowId: WINDOW_ID_CURRENT,
  windows: new Map(),
  loading: false,
  error: null,

  loadAllTabs: async (options) => {
    const silent = options?.silent === true;
    if (silent) {
      set({ error: null });
    } else {
      set({ loading: true, error: null });
    }
    try {
      const [allTabs, currentWindow, tabGroupsResult, allWindows] = await Promise.all([
        queryAllTabs(),
        getCurrentWindow(),
        queryTabGroups(),
        getAllWindows(),
      ]);

      const currentWindowId = currentWindow.id ?? WINDOW_ID_CURRENT;

      const groupMap = new Map<number, ChromeTabGroup>();
      for (const g of tabGroupsResult) {
        groupMap.set(g.id, g);
      }

      const liveTabs = allTabs
        .map((tab) => {
          const liveTab = tabToLiveTab(tab, currentWindowId);
          if (liveTab === null) return null;
          if (liveTab.groupId !== -1) {
            const group = groupMap.get(liveTab.groupId);
            if (group !== undefined) {
              liveTab.groupTitle = group.title;
              liveTab.groupColor = group.color;
              liveTab.groupCollapsed = group.collapsed;
            }
          }
          return liveTab;
        })
        .filter(Boolean) as LiveTab[];

      const windowMap = buildWindowMap(allWindows, allTabs);
      // 仅在窗口数据实际变化时更新 Map 引用，避免触发 WindowView 等订阅者的无效重渲染
      const prevWindows = get().windows;
      const windowsChanged =
        prevWindows.size !== windowMap.size ||
        [...windowMap.keys()].some((k) => !prevWindows.has(k)) ||
        [...windowMap.entries()].some(
          ([k, v]) => prevWindows.get(k)?.tabsCount !== v.tabsCount,
        );

      set({
        tabs: liveTabs,
        currentWindowId,
        ...(windowsChanged ? { windows: windowMap } : {}),
        ...(silent ? {} : { loading: false }),
      });

      void import("./metadata-slice").then(({ useMetadataStore }) => {
        void useMetadataStore.getState().gcWindowAliases([...windowMap.keys()]);
      });
    } catch (err) {
      if (!silent) {
        feedback.error(translate("加载标签页失败，请刷新页面"), err);
      } else {
        console.warn(`${BRAND.logTag} silent refresh failed`, err);
      }
      set(silent ? { error: String(err) } : { loading: false, error: String(err) });
    }
  },

  handleBroadcast: (message) => {
    const { tabs } = get();

    switch (message.type) {
      case "tab-created": {
        void get().loadAllTabs({ silent: true });
        break;
      }
      case "tab-updated": {
        const { id, url, title, favIconUrl } = message.payload;
        set({
          tabs: tabs.flatMap((t) => {
            if (t.id !== id) return [t];
            const incomingUrl = typeof url === "string" ? url : t.url;
            if (typeof url === "string" && (isSelfNewTabPage({ url }) || !shouldDisplayUrl(url))) {
              useSelectionStore.getState().removeIds([t.id]);
              return [];
            }
            const extensionFavicon = incomingUrl !== "" ? getFaviconUrl(incomingUrl) : "";
            const incomingTitle = typeof title === "string" && title !== "" ? title : t.title;
            const incomingFavicon = typeof favIconUrl === "string" ? favIconUrl : t.favIconUrl;
            return [
              {
                ...t,
                url: incomingUrl,
                title: incomingTitle,
                favIconUrl: extensionFavicon !== "" ? extensionFavicon : incomingFavicon,
                hostname: typeof url === "string" && url !== "" ? extractHostname(url) : t.hostname,
              },
            ];
          }),
        });
        break;
      }
      case "tab-removed": {
        const { id } = message.payload;
        if (typeof id === "number") {
          useSelectionStore.getState().removeIds([id]);
        }
        set({ tabs: tabs.filter((t) => t.id !== id) });
        break;
      }
      case "tab-activated": {
        const { id } = message.payload;
        set({
          tabs: tabs.map((t) => (t.id === id ? { ...t, lastAccessed: Date.now() } : t)),
        });
        break;
      }
      case "tab-moved":
      case "tab-attached":
      case "tab-detached":
      case "tab-grouped":
      case "tab-ungrouped":
      case "tab-group-updated":
      case "window-created":
      case "window-removed":
      case "window-card-order-changed": {
        void get().loadAllTabs({ silent: true });
        break;
      }
      case "tab-discarded": {
        const { id, discarded } = message.payload;
        if (typeof id === "number" && typeof discarded === "boolean") {
          set({ tabs: patchTabDiscardedState(tabs, id, discarded) });
        }
        break;
      }
      case "window-focus-changed": {
        const { windowId } = message.payload;
        if (typeof windowId === "number" && windowId !== WINDOW_ID_NONE) {
          set({ currentWindowId: windowId });
        }
        break;
      }
      case "bookmark-created":
      case "bookmark-changed":
      case "bookmark-removed":
      case "bookmark-moved": {
        void get().loadAllTabs({ silent: true });
        break;
      }
    }
  },

  jumpToTab: async (tabId, windowId) => {
    try {
      await activateTab(tabId, windowId);
      void track("tab_jump", { tabId, windowId, otherWindow: windowId !== get().currentWindowId });
    } catch (err) {
      feedback.error(translate("跳转失败，标签页可能已关闭"), err);
      set({ error: String(err) });
      void get().loadAllTabs({ silent: true });
    }
  },

  /**
   * 关闭单个标签页。Undo/回收站写入失败不阻塞关闭操作。
   */
  closeSingleTab: async (tabId) => {
    const { tabs } = get();
    const tab = tabs.find((t) => t.id === tabId);
    if (tab === undefined) return;

    try {
      const snapshots = [liveTabToSnapshot(tab)];
      void addToTrash([liveTabToTrashedTab(tab)]).catch(() => {});
      void useUndoStore
        .getState()
        .addRecord(snapshots, `关闭 "${tab.title}"`)
        .catch((err) => {
          console.warn(`${BRAND.logTag} addRecord failed, undo will be unavailable`, err);
        });
      await closeTab(tabId);
      void track("tab_close", { title: tab.title, hostname: tab.hostname });
    } catch (err) {
      feedback.error(translate("关闭失败，请重试"), err);
      set({ error: String(err) });
      void get().loadAllTabs({ silent: true });
      throw err;
    }
  },

  /** 批量关闭标签页。 */
  closeMultipleTabs: async (tabIds) => {
    const { tabs } = get();
    const targets = tabs.filter((t) => tabIds.includes(t.id));
    if (targets.length === 0) return;

    try {
      const snapshots = targets.map(liveTabToSnapshot);
      void addToTrash(targets.map(liveTabToTrashedTab)).catch(() => {});
      void useUndoStore
        .getState()
        .addRecord(snapshots, `关闭 ${targets.length} 个标签页`)
        .catch((err) => {
          console.warn(`${BRAND.logTag} addRecord failed, undo will be unavailable`, err);
        });
      await closeTabs(tabIds);
      void track("tab_close_batch", { count: targets.length });
    } catch (err) {
      feedback.error(translate("关闭失败，请重试"), err);
      set({ error: String(err) });
      void get().loadAllTabs({ silent: true });
      throw err;
    }
  },

  closeDomainGroup: async (domain) => {
    const { tabs } = get();
    const groupTabs = tabs.filter((t) => t.hostname === domain);
    if (groupTabs.length === 0) return;

    const nonPinned = groupTabs.filter((t) => !t.pinned);
    if (nonPinned.length === 0) return;

    /** 超过阈值时弹出确认对话框，提供「关闭」和「归档」选项。 */
    if (nonPinned.length > getCloseConfirmThreshold()) {
      const action = await new Promise<"close" | "archive" | "cancel">((resolve) => {
        feedback.modal.confirm({
          title: translate("closeConfirm.title", { count: nonPinned.length }),
          content: translate("closeConfirm.description"),
          okText: translate("closeConfirm.closeBtn"),
          okButtonProps: { danger: true },
          cancelText: translate("closeConfirm.archiveBtn"),
          cancelButtonProps: { type: "primary" },
          onOk: () => resolve("close"),
          onCancel: () => resolve("archive"),
        });
      });

      if (action === "archive") {
        try {
          const { archivedCount, closedCount } = await archiveSelectedTabs(nonPinned.map((t) => t.id));
          feedback.success(translate("closeConfirm.archiveSuccess", { count: archivedCount }));
          if (closedCount < archivedCount) {
            feedback.warning(
              translate("closeConfirm.archivePartial", {
                count: archivedCount - closedCount,
              }),
            );
          }
          void track("tab_archive_domain", { domain, count: archivedCount });
        } catch (err) {
          feedback.error(translate("closeConfirm.archiveFailed"), err);
          set({ error: String(err) });
          void get().loadAllTabs({ silent: true });
          throw err;
        }
        return;
      }
    }

    try {
      const snapshots = nonPinned.map(liveTabToSnapshot);
      void addToTrash(nonPinned.map(liveTabToTrashedTab)).catch(() => {});
      void useUndoStore
        .getState()
        .addRecord(snapshots, `关闭 ${domain} 的 ${nonPinned.length} 个标签页`)
        .catch((err) => {
          console.warn(`${BRAND.logTag} addRecord failed, undo will be unavailable`, err);
        });
      await closeTabs(nonPinned.map((t) => t.id));
      feedback.success(translate("已关闭 {count} 个标签页", { count: nonPinned.length }));
      void track("tab_close_domain", { domain, count: nonPinned.length });
    } catch (err) {
      feedback.error(translate("关闭分组失败，请重试"), err);
      set({ error: String(err) });
      void get().loadAllTabs({ silent: true });
      throw err;
    }
  },

  closeAllNonPinned: async () => {
    const { tabs } = get();
    const nonPinned = tabs.filter((t) => !t.pinned);
    if (nonPinned.length === 0) return;

    /** 超过阈值时弹出确认对话框，提供「关闭」和「归档」选项。 */
    if (nonPinned.length > getCloseConfirmThreshold()) {
      const action = await new Promise<"close" | "archive" | "cancel">((resolve) => {
        feedback.modal.confirm({
          title: translate("closeConfirm.title", { count: nonPinned.length }),
          content: translate("closeConfirm.description"),
          okText: translate("closeConfirm.closeBtn"),
          okButtonProps: { danger: true },
          cancelText: translate("closeConfirm.archiveBtn"),
          cancelButtonProps: { type: "primary" },
          onOk: () => resolve("close"),
          onCancel: () => resolve("archive"),
        });
      });

      if (action === "archive") {
        try {
          const { archivedCount, closedCount } = await archiveSelectedTabs(nonPinned.map((t) => t.id));
          feedback.success(translate("closeConfirm.archiveSuccess", { count: archivedCount }));
          if (closedCount < archivedCount) {
            feedback.warning(
              translate("closeConfirm.archivePartial", {
                count: archivedCount - closedCount,
              }),
            );
          }
          void track("tab_archive_all", { count: archivedCount });
        } catch (err) {
          feedback.error(translate("closeConfirm.archiveFailed"), err);
          set({ error: String(err) });
          void get().loadAllTabs({ silent: true });
          throw err;
        }
        return;
      }
    }

    try {
      const snapshots = nonPinned.map(liveTabToSnapshot);
      void addToTrash(nonPinned.map(liveTabToTrashedTab)).catch(() => {});
      void useUndoStore
        .getState()
        .addRecord(snapshots, `关闭全部 ${nonPinned.length} 个非固定标签页`)
        .catch((err) => {
          console.warn(`${BRAND.logTag} addRecord failed, undo will be unavailable`, err);
        });
      await closeTabs(nonPinned.map((t) => t.id));
      feedback.success(translate("已关闭 {count} 个标签页", { count: nonPinned.length }));
      void track("tab_close_all", { count: nonPinned.length });
    } catch (err) {
      feedback.error(translate("关闭失败，请重试"), err);
      set({ error: String(err) });
      void get().loadAllTabs({ silent: true });
      throw err;
    }
  },

  discardTab: async (tabId) => {
    const { succeededIds } = await discardTabsBatch([tabId]);
    if (succeededIds.length === 0) {
      const err = new Error(`Discard failed for tab ${tabId}`);
      feedback.error(translate("休眠失败，请重试"), err);
      set({ error: String(err) });
      throw err;
    }

    set((state) => ({ tabs: patchTabDiscardedState(state.tabs, tabId, true) }));
    feedback.success(translate("已休眠标签页，内存已释放"));
    void track("tab_discard", { tabId });
    swBroadcast("tab-discarded", { id: tabId, discarded: true });
  },

  discardMultipleTabs: async (tabIds) => {
    if (tabIds.length === 0) return;

    const { succeededIds, failedIds } = await discardTabsBatch(tabIds);
    if (succeededIds.length === 0) {
      const err = new Error("Discard failed for all selected tabs");
      feedback.error(translate("休眠失败，请重试"), err);
      set({ error: String(err) });
      throw err;
    }

    const succeededSet = new Set(succeededIds);
    set((state) => ({
      tabs: state.tabs.map((tab) => (succeededSet.has(tab.id) ? { ...tab, discarded: true } : tab)),
    }));

    feedback.success(translate("已休眠 {count} 个标签页", { count: succeededIds.length }));
    void track("tab_discard_batch", { count: succeededIds.length });
    if (failedIds.length > 0) {
      feedback.warning(
        translate("仍有 {count} 个标签页休眠失败，请重试", { count: failedIds.length }),
      );
    }

    for (const tabId of succeededIds) {
      swBroadcast("tab-discarded", { id: tabId, discarded: true });
    }
  },

  discardDomainGroup: async (domain) => {
    const { tabs } = get();
    const groupTabs = tabs.filter(
      (tab) => tab.hostname === domain && !tab.pinned && !tab.discarded,
    );
    if (groupTabs.length === 0) return;

    const { succeededIds, failedIds } = await discardTabsBatch(groupTabs.map((tab) => tab.id));
    if (succeededIds.length === 0) {
      const err = new Error(`Discard failed for domain ${domain}`);
      feedback.error(translate("休眠失败，请重试"), err);
      set({ error: String(err) });
      throw err;
    }

    const succeededSet = new Set(succeededIds);
    set((state) => ({
      tabs: state.tabs.map((tab) => (succeededSet.has(tab.id) ? { ...tab, discarded: true } : tab)),
    }));

    feedback.success(
      translate("已休眠 {domain} 的 {count} 个标签页", { domain, count: succeededIds.length }),
    );
    void track("tab_discard_domain", { domain, count: succeededIds.length });
    if (failedIds.length > 0) {
      feedback.warning(
        translate("仍有 {count} 个标签页休眠失败，请重试", { count: failedIds.length }),
      );
    }

    for (const tab of groupTabs) {
      if (succeededSet.has(tab.id)) {
        swBroadcast("tab-discarded", { id: tab.id, discarded: true, windowId: tab.windowId });
      }
    }
  },
}));
