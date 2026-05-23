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
import type { LiveTab, SwBroadcastMessage, WindowInfo } from "@/shared/types";
import {
  queryAllTabs,
  getAllWindows,
  getCurrentWindow,
  activateTab,
  closeTab,
  closeTabs,
  getFaviconUrl,
  queryTabGroups,
} from "@/chrome";
import { extractHostname, shouldDisplayUrl, isSelfNewTabPage } from "@/chrome";
import { feedback } from "@/shared/ui/feedback";
import { translate } from "@/shared/i18n/core";
import { swBroadcast } from "@/shared/utils/sw-broadcast";
import { track } from "@/shared/utils/metrics";
import {
  buildTabGroupMap,
  buildWindowMap,
  confirmBeforeClose,
  discardTabsBatch,
  patchTabDiscardedState,
  toClosedTabSnapshot,
  toLiveTab,
  withTabGroupInfo,
} from "@/features/tabs/services/tabs-service";
import { useUndoStore } from "./undo-slice";
import { useSelectionStore } from "./selection-slice";
import { useSettingsStore } from "./settings-slice";
import { BRAND } from "@/shared/config/brand";
import { TABS_CONSTANTS } from "@/shared/config/constants";

interface TabsState {
  /** 所有实时标签页列表（已过滤，用于展示） */
  tabs: LiveTab[];
  /** 当前窗口 ID */
  currentWindowId: number;
  /** 窗口信息映射表（windowId → WindowInfo） */
  windows: Map<number, WindowInfo>;
  /** 全局加载状态：true 时 UI 展示 Spin */
  loading: boolean;
  /** 错误信息：非 null 时表示最近一次操作失败 */
  error: string | null;

  // Actions
  /**
   * 拉取所有标签页。
   *
   * @param options.silent  设为 true 时不翻全局 `loading=true`，适合「局部操作完成后静默兜底刷新」的场景
   *                        （例如合并去重 / 关闭多个 tab 后，防止 SW broadcast 漏发）。默认 false，
   *                        保留首次加载展示 Spin 的行为。
   */
  loadAllTabs: (options?: { silent?: boolean }) => Promise<void>;
  /** 处理 Service Worker 广播消息（tab 创建/更新/移除/激活/移动/丢弃/窗口聚焦变化） */
  handleBroadcast: (message: SwBroadcastMessage) => void;
  /** 激活（跳转至）指定标签页 */
  jumpToTab: (tabId: number, windowId: number) => Promise<void>;
  /** 关闭单个标签页（自动创建撤销记录） */
  closeSingleTab: (tabId: number) => Promise<void>;
  /** 关闭多个标签页（自动创建撤销记录） */
  closeMultipleTabs: (tabIds: number[]) => Promise<void>;
  /** 关闭指定域名分组内的所有标签页 */
  closeDomainGroup: (domain: string) => Promise<void>;
  /** 关闭所有非固定标签页（超过阈值时弹出确认） */
  closeAllNonPinned: () => Promise<void>;
  /** 丢弃（休眠）单个标签页，释放内存但保留位置 */
  discardTab: (tabId: number) => Promise<void>;
  /** 丢弃（休眠）多个标签页，统一反馈并只做一次状态同步 */
  discardMultipleTabs: (tabIds: number[]) => Promise<void>;
  /** 丢弃（休眠）整个域名分组下的所有标签页 */
  discardDomainGroup: (domain: string) => Promise<void>;
}

/**
 * 获取关闭确认阈值
 *
 * 从 settings store 中读取用户配置的关闭确认阈值。
 * 若配置无效（非数字、非有限数、≤0），返回默认值 20。
 *
 * @returns 关闭确认阈值（tab 数量），超过此值会弹出确认对话框
 */
function getCloseConfirmThreshold(): number {
  const value = useSettingsStore.getState().settings.closeConfirmThreshold;
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : TABS_CONSTANTS.DEFAULT_CLOSE_CONFIRM_THRESHOLD;
}

/**
 * 获取 chrome.windows.WINDOW_ID_NONE 的安全替代值
 *
 * 在扩展环境返回 chrome.windows.WINDOW_ID_NONE，
 * 在非扩展环境（如测试、SSR）返回 -1 作为降级值。
 *
 * @returns 表示"无窗口"的 ID 值
 */
function getWindowIdNone(): number {
  return typeof chrome !== "undefined" && chrome.windows !== undefined
    ? chrome.windows.WINDOW_ID_NONE
    : -1;
}

/**
 * 获取初始当前窗口 ID
 *
 * 在扩展环境返回 chrome.windows.WINDOW_ID_CURRENT（让 Chrome 自行解析为实际窗口 ID），
 * 在非扩展环境返回 -1 作为降级值。
 *
 * @returns 初始窗口 ID（扩展环境为 WINDOW_ID_CURRENT，否则为 -1）
 */
function getInitialCurrentWindowId(): number {
  return typeof chrome !== "undefined" && chrome.windows !== undefined
    ? chrome.windows.WINDOW_ID_CURRENT
    : -1;
}

export const useTabsStore = create<TabsState>((set, get) => ({
  tabs: [],
  currentWindowId: getInitialCurrentWindowId(),
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

      const currentWindowId = currentWindow.id ?? getInitialCurrentWindowId();
      const groupMap = buildTabGroupMap(tabGroupsResult);

      const liveTabs = allTabs
        .map((tab) => {
          const liveTab = toLiveTab(tab, currentWindowId);
          if (liveTab === null) return null;
          return withTabGroupInfo(liveTab, groupMap);
        })
        .filter(Boolean) as LiveTab[];

      const allWindows = await getAllWindows();
      const windowMap = buildWindowMap(allWindows, allTabs);

      set({
        tabs: liveTabs,
        currentWindowId,
        windows: windowMap,
        ...(silent ? {} : { loading: false }),
      });
    } catch (err) {
      if (!silent) {
        feedback.error(translate("tabs.loadFailed"), err);
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
      case "tab-moved": {
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
        if (typeof windowId === "number" && windowId !== getWindowIdNone()) {
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
    }
  },

  jumpToTab: async (tabId, windowId) => {
    try {
      await activateTab(tabId, windowId);
      void track("tab_jump", { tabId, windowId, otherWindow: windowId !== get().currentWindowId });
    } catch (err) {
      // 常见失败：目标 tab 已被用户关闭、窗口已 minimize 等——给出明确反馈
      feedback.error(translate("tabs.jumpFailed"), err);
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
   * @param tabId
   */
  closeSingleTab: async (tabId) => {
    const { tabs } = get();
    const tab = tabs.find((t) => t.id === tabId);
    if (tab === undefined) return;

    try {
      const snapshots = [toClosedTabSnapshot(tab)];
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
      feedback.error(translate("tabs.closeFailed"), err);
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
   * @param tabIds
   */
  closeMultipleTabs: async (tabIds) => {
    const { tabs } = get();
    const targets = tabs.filter((t) => tabIds.includes(t.id));
    if (targets.length === 0) return;

    try {
      const snapshots = targets.map(toClosedTabSnapshot);
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
      feedback.error(translate("tabs.closeFailed"), err);
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
     * 批量关闭安全阈值：超过阈值时弹出确认对话框
     *
     * 使用公共函数 confirmBeforeClose 让用户二次确认，避免误操作。
     * 确认后才执行关闭；取消则静默返回。
     */
    const confirmed = await confirmBeforeClose(
      nonPinned.length,
      getCloseConfirmThreshold(),
      "tabs.closeConfirmTitle",
      "tabs.closeDomainConfirmContent",
      { domain, count: nonPinned.length },
    );
    if (!confirmed) return;

    try {
      const snapshots = nonPinned.map(toClosedTabSnapshot);
      void useUndoStore
        .getState()
        .addRecord(snapshots, `关闭 ${domain} 的 ${nonPinned.length} 个标签页`)
        .catch((err) => {
          console.warn(`${BRAND.logTag} addRecord failed, undo will be unavailable`, err);
        });
      await closeTabs(nonPinned.map((t) => t.id));
      // 批量操作给出成功反馈，让用户明确感知"点了就有结果"
      feedback.success(translate("tabs.closedCount", { count: nonPinned.length }));
      void track("tab_close_domain", { domain, count: nonPinned.length });
    } catch (err) {
      feedback.error(translate("tabs.closeGroupFailed"), err);
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
     * 批量关闭安全阈值：超过阈值时弹出确认对话框
     *
     * 使用公共函数 confirmBeforeClose 让用户二次确认，避免误操作。
     * 确认后才执行关闭；取消则静默返回。
     */
    const confirmed = await confirmBeforeClose(
      nonPinned.length,
      getCloseConfirmThreshold(),
      "tabs.closeConfirmTitle",
      "tabs.closeConfirmContent",
      { count: nonPinned.length },
    );
    if (!confirmed) return;

    try {
      const snapshots = nonPinned.map(toClosedTabSnapshot);
      void useUndoStore
        .getState()
        .addRecord(snapshots, `关闭全部 ${nonPinned.length} 个非固定标签页`)
        .catch((err) => {
          console.warn(`${BRAND.logTag} addRecord failed, undo will be unavailable`, err);
        });
      await closeTabs(nonPinned.map((t) => t.id));
      feedback.success(translate("tabs.closedCount", { count: nonPinned.length }));
      void track("tab_close_all", { count: nonPinned.length });
    } catch (err) {
      feedback.error(translate("tabs.closeFailed"), err);
      set({ error: String(err) });
      void get().loadAllTabs({ silent: true });
      throw err;
    }
  },

  discardTab: async (tabId) => {
    const { succeededIds } = await discardTabsBatch([tabId]);
    if (succeededIds.length === 0) {
      const err = new Error(`Discard failed for tab ${tabId}`);
      feedback.error(translate("tabs.discardFailed"), err);
      set({ error: String(err) });
      throw err;
    }

    set((state) => ({ tabs: patchTabDiscardedState(state.tabs, tabId, true) }));
    feedback.success(translate("tabs.discarded"));
    void track("tab_discard", { tabId });
    swBroadcast("tab-discarded", { id: tabId, discarded: true });
  },

  discardMultipleTabs: async (tabIds) => {
    if (tabIds.length === 0) return;

    const { succeededIds, failedIds } = await discardTabsBatch(tabIds);
    if (succeededIds.length === 0) {
      const err = new Error("Discard failed for all selected tabs");
      feedback.error(translate("tabs.discardFailed"), err);
      set({ error: String(err) });
      throw err;
    }

    const succeededSet = new Set(succeededIds);
    set((state) => ({
      tabs: state.tabs.map((tab) => (succeededSet.has(tab.id) ? { ...tab, discarded: true } : tab)),
    }));

    feedback.success(translate("tabs.discardedCount", { count: succeededIds.length }));
    void track("tab_discard_batch", { count: succeededIds.length });
    if (failedIds.length > 0) {
      feedback.warning(translate("tabs.discardPartial", { count: failedIds.length }));
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
      feedback.error(translate("tabs.discardFailed"), err);
      set({ error: String(err) });
      throw err;
    }

    const succeededSet = new Set(succeededIds);
    set((state) => ({
      tabs: state.tabs.map((tab) => (succeededSet.has(tab.id) ? { ...tab, discarded: true } : tab)),
    }));

    feedback.success(translate("tabs.discardedGroup", { domain, count: succeededIds.length }));
    void track("tab_discard_domain", { domain, count: succeededIds.length });
    if (failedIds.length > 0) {
      feedback.warning(translate("tabs.discardPartial", { count: failedIds.length }));
    }

    for (const tab of groupTabs) {
      if (succeededSet.has(tab.id)) {
        swBroadcast("tab-discarded", { id: tab.id, discarded: true, windowId: tab.windowId });
      }
    }
  },
}));
