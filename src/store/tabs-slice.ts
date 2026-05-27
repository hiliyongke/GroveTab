/* eslint-disable i18n-zh/no-bare-zh-in-js */
/**
 * Zustand Store — Tabs Slice
 *
 * Slice 依赖关系：
 *   - 依赖 settings-slice：读取 settings（defaultView, uiVisibility, closeConfirmThreshold 等）
 *   - 依赖 undo-slice：关闭 tab 时创建 undo record（closeSingleTab, closeMultipleTabs, closeDomainGroup, closeAllNonPinned）
 *   - 依赖 selection-slice：关闭/丢弃操作后清除已删除 tab 的选中态
 *   - 被 metadata-slice 间接依赖：metadata 的 pin/unpin 操作可能触发 tabs 刷新
 *
 * 上游被以下模块依赖：
 *   - AppWorkspace：消费 tabs, loading, error 等状态
 *   - AppContent/App.tsx：消费 loadAllTabs, handleBroadcast 等
 *
 * 统一的 tab 状态与操作入口，职责：
 *   1. 通过 SW broadcast 增量维护 live tabs 列表
 *   2. 所有「动」tab 的操作（关闭 / 跳转）在此集中容错：
 *      - 内部 try/catch 所有 chrome API 调用
 *      - 失败时直接调用 `feedback.error(...)` 给用户可感反馈
 *      - 失败时仍重抛给调用方，便于上层（如 DedupInfoBar）切 loading=false
 *   3. 关闭类操作自动创建 undo record（fire-and-forget，不阻塞关闭）
 *
 * 关键设计决策：
 *   - UI 层调用 action 时不需要再包 try/catch——反馈由 store 统一负责
 *   - Action 失败后会**静默刷新全量 tabs**（silent: true），
 *     修复 "chrome 端已改变但 UI 未同步" 的幽灵态
 */

import { create } from "zustand";
import type { LiveTab, SwBroadcastMessage, WindowInfo, ClosedTabSnapshot } from "@/shared/types";
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
  /**
   * 拉取所有 tabs。
   *
   * @param options.silent  设为 true 时不翻全局 `loading=true`，适合「局部操作完成后静默兜底刷新」的场景
   *                        （例如合并去重 / 关闭多个 tab 后，防止 SW broadcast 漏发）。默认 false，
   *                        保留首次加载展示 Spin 的行为。
   */
  loadAllTabs: (options?: { silent?: boolean }) => Promise<void>;
  /** Handle SW broadcast message */
  handleBroadcast: (message: SwBroadcastMessage) => void;
  /** Activate (jump to) a tab */
  jumpToTab: (tabId: number, windowId: number) => Promise<void>;
  /** Close a single tab (creates undo record) */
  closeSingleTab: (tabId: number) => Promise<void>;
  /** Close multiple tabs (creates undo record) */
  closeMultipleTabs: (tabIds: number[]) => Promise<void>;
  /** Close all tabs in a domain group */
  closeDomainGroup: (domain: string) => Promise<void>;
  /** Close all non-pinned tabs (with confirmation if >20) */
  closeAllNonPinned: () => Promise<void>;
  /** 丢弃（休眠）单个标签页，释放内存但保留位置 */
  discardTab: (tabId: number) => Promise<void>;
  /** 丢弃（休眠）多个标签页，统一反馈并只做一次状态同步 */
  discardMultipleTabs: (tabIds: number[]) => Promise<void>;
  /** 丢弃（休眠）整个域名的标签页 */
  discardDomainGroup: (domain: string) => Promise<void>;
}

function tabToLiveTab(tab: chrome.tabs.Tab, currentWindowId: number): LiveTab | null {
  if (tab.id == null) return null;
  const url = tab.url ?? tab.pendingUrl ?? "";
  if (isSelfNewTabPage(tab)) return null;
  if (!shouldDisplayUrl(url)) return null;

  /**
   * favicon 策略：统一走扩展同源的 `_favicon/` 入口。
   *
   * Chrome 给的 `tab.favIconUrl` 很多时候是远程站点 URL，直接塞给 `<img>` 会导致：
   *   - 站点离线 / 图标 404 时控制台打红 `net::ERR_*`
   *   - 有些站点图标带 CORS 限制，也会污染控制台
   *
   * 改用 `chrome-extension://<id>/_favicon/?pageUrl=...` 后：
   *   - 与 newtab 页同源，不会触发 CORS 报错
   *   - Chrome 内部自己去抓远程图标并缓存，失败也只是返回空图，不污染控制台
   *   - canvas 可以安全地读像素做取色
   *
   * 仅在扩展上下文有效；普通浏览器预览（无 chrome.runtime.id）退回原始值。
   */
  const extensionFavicon = getFaviconUrl(url);
  const favIconUrl = extensionFavicon !== "" ? extensionFavicon : (tab.favIconUrl ?? "");

  return {
    id: tab.id,
    url,
    title: tab.title ?? url,
    favIconUrl,
    windowId: tab.windowId,
    incognito: tab.incognito,
    pinned: tab.pinned,
    audible: tab.audible ?? false,
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
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 20;
}

export const useTabsStore = create<TabsState>((set, get) => ({
  tabs: [],
  currentWindowId: WINDOW_ID_CURRENT,
  windows: new Map(),
  loading: false,
  error: null,

  loadAllTabs: async (options) => {
    const silent = options?.silent === true;
    // 静默模式下只重置 error，不碰 loading——避免合并/批量关闭后主视图闪回 Spin
    if (silent) {
      set({ error: null });
    } else {
      set({ loading: true, error: null });
    }
    try {
      const [allTabs, currentWindow, tabGroupsResult] = await Promise.all([
        queryAllTabs(),
        getCurrentWindow(),
        queryTabGroups(), // 获取所有 Tab Group 信息
      ]);

      const currentWindowId = currentWindow.id ?? WINDOW_ID_CURRENT;

      /** 构建 groupId → groupInfo 的快速查找表 */
      const groupMap = new Map<number, ChromeTabGroup>();
      for (const g of tabGroupsResult) {
        groupMap.set(g.id, g);
      }

      const liveTabs = allTabs
        .map((tab) => {
          const liveTab = tabToLiveTab(tab, currentWindowId);
          if (liveTab === null) return null;
          // 注入 Tab Group 信息
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

      const allWindows = await getAllWindows();
      const windowMap = buildWindowMap(allWindows, allTabs);

      set({
        tabs: liveTabs,
        currentWindowId,
        windows: windowMap,
        // 静默模式本来就没翻 loading，这里也不覆盖；非静默模式才落回 false
        ...(silent ? {} : { loading: false }),
      });

      void import("./metadata-slice").then(({ useMetadataStore }) => {
        void useMetadataStore.getState().gcWindowAliases([...windowMap.keys()]);
      });
    } catch (err) {
      // 首次加载失败需要用户感知；静默刷新失败只打日志，避免打扰
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
        // broadcast 驱动的刷新必须静默：否则每次新开 tab，主视图就闪一次全屏 Spin
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
            // 同步沿用 tabToLiveTab 的策略：若有 URL 就走扩展同源 favicon，
            // 避免 sw 广播把远程 favIconUrl 写回 store 导致 `<img>` 跨域报错。
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
        // 同 tab-created：静默刷新，避免主视图闪 Spin
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
          set({
            currentWindowId: windowId,
            tabs: tabs.map((t) => ({
              ...t,
              isCurrentWindow: t.windowId === windowId,
            })),
          });
        }
        break;
      }
      // ── Bookmark 事件 ──────────────────────────────
      // 书签变更不直接影响 tabs 列表，但可能间接导致新标签页打开
      // （如用户从书签栏点击书签），因此触发静默全量刷新以保持一致性。
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
      // 常见失败：目标 tab 已被用户关闭、窗口已 minimize 等——给出明确反馈
      feedback.error(translate("跳转失败，标签页可能已关闭"), err);
      set({ error: String(err) });
      // 兜底刷新，清掉 UI 里已经不存在的 tab
      void get().loadAllTabs({ silent: true });
    }
  },

  /**
   * 关闭单个 tab
   *
   * ⚠️ 历史 Bug 防回归：
   *   原实现把 addRecord 和 closeTab 放在同一个 try 里 await 串联——
   *   一旦 addRecord 内部 chrome.storage.local 写入 hang 住或抛错（容量超限、I/O 异常等），
   *   closeTab 永远不会被执行 → 浏览器 tab 没有被关闭，且外层调用方的 loading 永远转圈。
   *   现在：Undo 仅作为「锦上添花」——失败只告警到 console，绝不阻塞真正的关闭。
   *
   * 错误处理：任何 chrome API 失败会 toast + 兜底刷新，UI 层不需要再包 try/catch。
   */
  closeSingleTab: async (tabId) => {
    const { tabs } = get();
    const tab = tabs.find((t) => t.id === tabId);
    if (tab === undefined) return;

    try {
      const snapshots = [liveTabToSnapshot(tab)];
      // Undo 写入失败不阻塞关闭（见 closeSingleTab 注释）
      void useUndoStore
        .getState()
        .addRecord(snapshots, `关闭 "${tab.title}"`)
        .catch((err) => {
          console.warn(`${BRAND.logTag} addRecord failed, undo will be unavailable`, err);
        });
      await closeTab(tabId);
      void track("tab_close", { title: tab.title, hostname: tab.hostname });
      // 关闭成功后不强制刷新——SW broadcast 的 tab-removed 会驱动 UI 移除
    } catch (err) {
      feedback.error(translate("关闭失败，请重试"), err);
      set({ error: String(err) });
      // 兜底：可能真关掉了但 broadcast 丢失，silent 刷新同步 UI
      void get().loadAllTabs({ silent: true });
      throw err;
    }
  },

  /**
   * 关闭多个 tab —— 合并去重 / 多选场景的主要入口
   *
   * 成功后会展示 "已关闭 N 个标签页" 的反馈；失败由 feedback 统一兜。
   * 调用方（如 DedupInfoBar）可以继续用 try/finally 控制自己的 busy 状态，
   * 但不需要再自己调用 message.error——已被 store 统一处理。
   */
  closeMultipleTabs: async (tabIds) => {
    const { tabs } = get();
    const targets = tabs.filter((t) => tabIds.includes(t.id));
    if (targets.length === 0) return;

    try {
      const snapshots = targets.map(liveTabToSnapshot);
      void useUndoStore
        .getState()
        .addRecord(snapshots, `关闭 ${targets.length} 个标签页`)
        .catch((err) => {
          console.warn(`${BRAND.logTag} addRecord failed, undo will be unavailable`, err);
        });
      await closeTabs(tabIds);
      void track("tab_close_batch", { count: targets.length });
    } catch (err) {
      // 同时落入 store error 和 feedback：
      //   - feedback 让用户立即看到结果
      //   - set error 让未来的错误面板/重试 UI 可消费
      //   - throw 让直接调用方（DedupInfoBar 合并按钮等）能感知失败并切回非 loading
      feedback.error(translate("关闭失败，请重试"), err);
      set({ error: String(err) });
      void get().loadAllTabs({ silent: true });
      throw err;
    }
  },

  closeDomainGroup: async (domain) => {
    const { tabs } = get();
    // domain 来自 groupTabsByDomain 的分组键（hostname），精确匹配即可
    const groupTabs = tabs.filter((t) => t.hostname === domain);
    if (groupTabs.length === 0) return;

    const nonPinned = groupTabs.filter((t) => !t.pinned);
    if (nonPinned.length === 0) return;

    /**
     * 批量关闭安全阈值：超过 20 个 tab 时弹出确认对话框
     *
     * 使用 antd Modal.confirm 让用户二次确认，避免误操作。
     * 确认后才执行关闭；取消则静默返回。
     */
    if (nonPinned.length > getCloseConfirmThreshold()) {
      const confirmed = await new Promise<boolean>((resolve) => {
        feedback.modal.confirm({
          title: translate("确认关闭"),
          content: translate("即将关闭 {domain} 下的 {count} 个标签页，此操作可撤销。是否继续？", {
            domain,
            count: nonPinned.length,
          }),
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });
      if (!confirmed) return;
    }

    try {
      const snapshots = nonPinned.map(liveTabToSnapshot);
      void useUndoStore
        .getState()
        .addRecord(snapshots, `关闭 ${domain} 的 ${nonPinned.length} 个标签页`)
        .catch((err) => {
          console.warn(`${BRAND.logTag} addRecord failed, undo will be unavailable`, err);
        });
      await closeTabs(nonPinned.map((t) => t.id));
      // 批量操作给出成功反馈，让用户明确感知"点了就有结果"
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

    /**
     * 批量关闭安全阈值：超过 20 个 tab 时弹出确认对话框
     *
     * 使用 antd Modal.confirm 让用户二次确认，避免误操作。
     * 确认后才执行关闭；取消则静默返回。
     */
    if (nonPinned.length > getCloseConfirmThreshold()) {
      const confirmed = await new Promise<boolean>((resolve) => {
        feedback.modal.confirm({
          title: translate("确认关闭"),
          content: translate("即将关闭 {count} 个标签页，此操作可撤销。是否继续？", {
            count: nonPinned.length,
          }),
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });
      if (!confirmed) return;
    }

    try {
      const snapshots = nonPinned.map(liveTabToSnapshot);
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
