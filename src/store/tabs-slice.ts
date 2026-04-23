/**
 * Zustand Store — Tabs Slice
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

import { create } from 'zustand';
import type { LiveTab, SwBroadcastMessage, WindowInfo, ClosedTabSnapshot } from '@/shared/types';
import { queryAllTabs, getAllWindows, activateTab, closeTab, closeTabs, getFaviconUrl, discardTab as chromeDiscardTab, discardTabs as chromeDiscardTabs, queryTabGroups, type ChromeTabGroup } from '@/chrome';
import { extractHostname, shouldDisplayUrl, isSelfNewTabPage } from '@/chrome';
import { feedback } from '@/shared/ui/feedback';
import { translate } from '@/shared/i18n/core';
import { swBroadcast } from '@/shared/utils/sw-broadcast';
import { useUndoStore } from './undo-slice';

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
  /** 丢弃（休眠）整个域名的标签页 */
  discardDomainGroup: (domain: string) => Promise<void>;
}

function tabToLiveTab(tab: chrome.tabs.Tab, currentWindowId: number): LiveTab | null {
  const url = tab.url || tab.pendingUrl || '';
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
  const favIconUrl = extensionFavicon || tab.favIconUrl || '';

  return {
    id: tab.id!,
    url,
    title: tab.title || url,
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

export const useTabsStore = create<TabsState>((set, get) => ({
  tabs: [],
  currentWindowId: chrome.windows?.WINDOW_ID_CURRENT ?? -1,
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
        chrome.windows.getCurrent(),
        queryTabGroups(), // 获取所有 Tab Group 信息
      ]);

      const currentWindowId = currentWindow.id!;

      /** 构建 groupId → groupInfo 的快速查找表 */
      const groupMap = new Map<number, ChromeTabGroup>();
      for (const g of tabGroupsResult) {
        groupMap.set(g.id, g);
      }

      const liveTabs = allTabs
        .map((tab) => {
          const liveTab = tabToLiveTab(tab, currentWindowId);
          if (!liveTab) return null;
          // 注入 Tab Group 信息
          if (liveTab.groupId !== -1) {
            const group = groupMap.get(liveTab.groupId);
            if (group) {
              liveTab.groupTitle = group.title;
              liveTab.groupColor = group.color;
            }
          }
          return liveTab;
        })
        .filter(Boolean) as LiveTab[];

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
        // 静默模式本来就没翻 loading，这里也不覆盖；非静默模式才落回 false
        ...(silent ? {} : { loading: false }),
      });
    } catch (err) {
      // 首次加载失败需要用户感知；静默刷新失败只打日志，避免打扰
      if (!silent) {
        feedback.error(translate('tabs.loadFailed'), err);
      } else {
        console.warn('[Canopy] silent refresh failed', err);
      }
      set(silent ? { error: String(err) } : { loading: false, error: String(err) });
    }
  },

  handleBroadcast: (message) => {
    const { tabs } = get();

    switch (message.type) {
      case 'tab-created': {
        // broadcast 驱动的刷新必须静默：否则每次新开 tab，主视图就闪一次全屏 Spin
        void get().loadAllTabs({ silent: true });
        break;
      }
      case 'tab-updated': {
        const { id, url, title, favIconUrl } = message.payload;
        set({
          tabs: tabs.map((t) => {
            if (t.id !== id) return t;
            const newUrl = (url as string) || t.url;
            // 同步沿用 tabToLiveTab 的策略：若有 URL 就走扩展同源 favicon，
            // 避免 sw 广播把远程 favIconUrl 写回 store 导致 `<img>` 跨域报错。
            const extensionFavicon = newUrl ? getFaviconUrl(newUrl) : '';
            return {
              ...t,
              url: newUrl,
              title: (title as string) || t.title,
              favIconUrl: extensionFavicon || (favIconUrl as string) || t.favIconUrl,
              hostname: url ? extractHostname(url as string) : t.hostname,
            };
          }),
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
        set({
          tabs: tabs.map((t) =>
            t.id === id ? { ...t, lastAccessed: Date.now() } : t,
          ),
        });
        break;
      }
      case 'tab-moved': {
        // 同 tab-created：静默刷新，避免主视图闪 Spin
        void get().loadAllTabs({ silent: true });
        break;
      }
      case 'tab-discarded': {
        // discarded 状态变化（休眠/恢复）需要全量刷新才能正确更新所有 tab 的 discarded 标记
        void get().loadAllTabs({ silent: true });
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
      // 常见失败：目标 tab 已被用户关闭、窗口已 minimize 等——给出明确反馈
      feedback.error(translate('tabs.jumpFailed'), err);
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
    if (!tab) return;

    try {
      const snapshots = [liveTabToSnapshot(tab)];
      // Undo 写入失败不阻塞关闭（见 closeSingleTab 注释）
      void useUndoStore
        .getState()
        .addRecord(snapshots, `关闭 "${tab.title}"`)
        .catch((err) => {
          console.warn('[Canopy] addRecord failed, undo will be unavailable', err);
        });
      await closeTab(tabId);
      // 关闭成功后不强制刷新——SW broadcast 的 tab-removed 会驱动 UI 移除
    } catch (err) {
      feedback.error(translate('tabs.closeFailed'), err);
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
          console.warn('[Canopy] addRecord failed, undo will be unavailable', err);
        });
      await closeTabs(tabIds);
    } catch (err) {
      // 同时落入 store error 和 feedback：
      //   - feedback 让用户立即看到结果
      //   - set error 让未来的错误面板/重试 UI 可消费
      //   - throw 让直接调用方（DedupInfoBar 合并按钮等）能感知失败并切回非 loading
      feedback.error(translate('tabs.closeFailed'), err);
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
    if (nonPinned.length > 20) {
      const confirmed = await new Promise<boolean>((resolve) => {
        feedback.modal.confirm({
          title: translate('tabs.closeConfirmTitle'),
          content: translate('tabs.closeDomainConfirmContent', { domain, count: nonPinned.length }),
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
          console.warn('[Canopy] addRecord failed, undo will be unavailable', err);
        });
      await closeTabs(nonPinned.map((t) => t.id));
      // 批量操作给出成功反馈，让用户明确感知"点了就有结果"
      feedback.success(translate('tabs.closedCount', { count: nonPinned.length }));
    } catch (err) {
      feedback.error(translate('tabs.closeGroupFailed'), err);
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
    if (nonPinned.length > 20) {
      const confirmed = await new Promise<boolean>((resolve) => {
        feedback.modal.confirm({
          title: translate('tabs.closeConfirmTitle'),
          content: translate('tabs.closeConfirmContent', { count: nonPinned.length }),
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
          console.warn('[Canopy] addRecord failed, undo will be unavailable', err);
        });
      await closeTabs(nonPinned.map((t) => t.id));
      feedback.success(translate('tabs.closedCount', { count: nonPinned.length }));
    } catch (err) {
      feedback.error(translate('tabs.closeFailed'), err);
      set({ error: String(err) });
      void get().loadAllTabs({ silent: true });
      throw err;
    }
  },

  discardTab: async (tabId) => {
    try {
      await chromeDiscardTab(tabId);
      feedback.success(translate('tabs.discarded'));
      // 立即广播，确保其他 Canopy 窗口同步更新（不等 SW alarm 轮询）
      swBroadcast('tab-discarded', { id: tabId, discarded: true });
      void get().loadAllTabs({ silent: true });
    } catch (err) {
      feedback.error(translate('tabs.discardFailed'), err);
      void get().loadAllTabs({ silent: true });
      throw err;
    }
  },

  discardDomainGroup: async (domain) => {
    const { tabs } = get();
    const groupTabs = tabs.filter((t) => t.hostname === domain && !t.pinned && !t.discarded);
    if (groupTabs.length === 0) return;

    try {
      await chromeDiscardTabs(groupTabs.map((t) => t.id));
      feedback.success(translate('tabs.discardedGroup', { domain, count: groupTabs.length }));
      // 广播休眠事件，其他 Canopy 窗口同步更新
      for (const t of groupTabs) {
        swBroadcast('tab-discarded', { id: t.id, discarded: true, windowId: t.windowId });
      }
      void get().loadAllTabs({ silent: true });
    } catch (err) {
      feedback.error(translate('tabs.discardFailed'), err);
      void get().loadAllTabs({ silent: true });
      throw err;
    }
  },
}));
