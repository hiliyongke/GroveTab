/**
 * 仅开发预览使用：当页面在普通浏览器（非扩展）中打开时，
 * 注入一个最小可用的 `chrome.*` mock，让 UI 能渲染真实数据，
 * 并且可以**真实地响应**关闭 / 更新等操作。
 *
 * 关键修正（2026-04-22）：
 *   原版 remove/update 是 noop，导致点击关闭/去重/一键关闭等按钮时
 *   —— `chrome.tabs.remove()` 成功返回但数据没变，SW 广播也没有，
 *   —— 结果 UI 不刷新，必须 F5 才看到效果。
 *
 *   新版实现：
 *   1. 维护可变 `mockTabs` 数组作为单一数据源
 *   2. remove / update 真的改数据
 *   3. 改完后通过 `BroadcastChannel('app-sw-broadcast')` 广播
 *      对应的 tab-removed / tab-updated / tab-activated / tab-moved，
 *      让前端 `useSwBroadcast` 收到消息，走正常的 store 更新路径
 *   4. 同步也触发 `chrome.tabs.onRemoved/onActivated` 等监听器，
 *      以兼容未来其它消费方
 *
 * 生产构建会走 Chrome 扩展，不会加载本文件。
 */
(function () {
  if (typeof window === 'undefined') return;
  if (window.chrome && window.chrome.tabs) return; // 真实扩展环境，跳过

  const initialMockTabs = [
    ['tencent.com', '模板注册、模板处理设置 - 云点播 - 控制台', 'https://console.cloud.tencent.com/vod'],
    ['tencent.com', '概览', 'https://cloud.tencent.com/'],
    ['tencent.com', '腾讯云 Tea Design', 'https://tea-design.tencent.com/'],
    ['tencent.com', '腾讯云 - API 管理', 'https://console.cloud.tencent.com/cam'],
    ['tencent.com', '变更管理 - 控制台 Buffer 系统', 'https://cbs.tencent.com/'],
    ['tencent.com', '#60 VOC 控制台前端体验环境部署流水线', 'https://devops.tencent.com/p1'],
    ['tencent.com', '[VOC] 点播播放、剪辑同步工坊、云点播及视频处理', 'https://devops.tencent.com/p2'],
    ['reddit.com', 'Reddit – 全网生活地', 'https://reddit.com/'],
    ['codebuddy.cn', '腾讯云代码助手 CodeBuddy - AI 时代的智能编程伙伴', 'https://codebuddy.cn/'],
    ['127.0.0.1', 'Whistle Web Debugging Proxy', 'http://127.0.0.1:8899/'],
    ['yudesk.dev', 'GSD 实践指南 | YuD 落地工坊', 'https://yudesk.dev/gsd'],
    ['github.com', 'get-shit-done/README.zh-CN.md at main - gsd-build/get-shit-done', 'https://github.com/gsd-build'],
    ['woa.com', '我的工作 - TAPD 平台', 'https://tapd.woa.com/mywork'],
    ['woa.com', '边缘安全加速平台业务数据观测-API 文档-文档中心-腾讯云', 'https://docs.woa.com/'],
    ['woa.com', '#60 VOC 控制台前端体验环境部署流水线', 'https://devops.woa.com/p'],
    ['woa.com', '[VOC] 点播播放、剪辑同步工坊、云点播及视频处理-TAPD平台', 'https://tapd.woa.com/voc'],
    ['woa.com', '腾讯云 - API 管理', 'https://cloud.woa.com/api'],
    ['woa.com', '变更管理 - 控制台 Buffer 系统', 'https://cbs.woa.com/'],
    ['woa.com', '[用周Bug] 修复页面渲染延迟导致标签页 tab 数量显示不准确-EdgeOne-TAPD平台', 'https://tapd.woa.com/bug'],
    ['woa.com', '会并请求 - edgeone/tea-app-edgeone - 工蜂内网码', 'https://git.woa.com/ee'],
    ['woa.com', 'feat(version-schedule-change-record) [141] - 会并请求 - cdn/fusion-admin', 'https://git.woa.com/fu'],
    ['woa.com', 'AI助手-CodeWiki', 'https://codewiki.woa.com/'],
    ['woa.com', 'Tokens 看板', 'https://tokens.woa.com/'],
    ['woa.com', '变更管理 - 控制台 Buffer 系统', 'https://cbs.woa.com/2'],
    ['woa.com', 'Knot - MCP 管理', 'https://knot.woa.com/'],
    ['woa.com', 'LLM Chat', 'https://llm.woa.com/'],
  ];

  function shouldAvoidExternalFaviconProxy(hostname) {
    const lower = String(hostname || '').toLowerCase();
    if (
      lower === 'localhost' ||
      lower === 'woa.com' ||
      lower === 'oa.com' ||
      lower.endsWith('.local') ||
      lower.endsWith('.woa.com') ||
      lower.endsWith('.oa.com') ||
      !lower.includes('.')
    ) {
      return true;
    }

    if (/^(10|127)\./.test(lower)) return true;
    if (/^192\.168\./.test(lower)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(lower)) return true;

    return false;
  }

  function getMockFaviconUrl(hostname) {
    if (shouldAvoidExternalFaviconProxy(hostname)) return '';
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  }

  const now = Date.now();
  /** 可变的 tabs 数据源（mock 内部 state） */
  let mockTabs = initialMockTabs.map((t, i) => ({
    id: 1000 + i,
    windowId: 1,
    index: i,
    url: t[2],
    title: t[1],
    favIconUrl: getMockFaviconUrl(t[0]),
    active: i === 0,
    pinned: false,
    audible: false,
    discarded: false,
    autoDiscardable: true,
    incognito: false,
    lastAccessed: now - i * 60_000,
    status: 'complete',
    mutedInfo: { muted: false },
    groupId: -1,
    selected: false,
    highlighted: false,
  }));

  const storage = new Map();

  /**
   * Chrome event 监听器系统 —— 为每个事件名维护自己的 handler 列表，
   * 便于调用 remove/update 后能真正通知订阅方。
   */
  function createEvent() {
    const handlers = new Set();
    return {
      addListener: (fn) => { if (typeof fn === 'function') handlers.add(fn); },
      removeListener: (fn) => { handlers.delete(fn); },
      hasListener: (fn) => handlers.has(fn),
      dispatch: (...args) => { handlers.forEach((fn) => { try { fn(...args); } catch (e) { console.warn(e); } }); },
    };
  }

  const tabsOnCreated = createEvent();
  const tabsOnUpdated = createEvent();
  const tabsOnRemoved = createEvent();
  const tabsOnActivated = createEvent();
  const tabsOnMoved = createEvent();
  const storageOnChanged = createEvent();
  const runtimeOnMessage = createEvent();
  const windowsOnFocusChanged = createEvent();

  /**
   * 与前端 `useSwBroadcast` 对齐的 channel，模拟 Service Worker 的广播行为。
   * —— 关键：前端是通过这个 channel 来增量更新 tabs 状态的
   */
  const CHANNEL_NAME = 'app-sw-broadcast';
  let swChannel = null;
  try {
    swChannel = new BroadcastChannel(CHANNEL_NAME);
  } catch (e) {
    swChannel = null;
  }

  /**
   * 向前端广播一条 SW 风格的消息；同时触发对应的 chrome.* 监听器。
   * BroadcastChannel 不会把消息投递到发布者自己（浏览器规范），
   * 所以这里 **同时** 主动 dispatch 一次到前端页面上的 channel 监听器——
   * 通过在 window 上再建一个同名 channel 不可行（还是不回投），
   * 改用 setTimeout + 通过 `postMessage` 到自己的 listeners 来模拟。
   *
   * 更稳妥的做法：前端的 useSwBroadcast 订阅同一个 channel name，
   * dev-mock 通过持有的 channel 调用 postMessage 时，由于是在 **同一个浏览上下文**，
   * BroadcastChannel 的规范是 "同 origin 所有 window" 都会收到 —— **除了发布者自己所在的 channel 实例**。
   * 因此这里选择直接在 mock 侧手动跑一遍 store 通知通道：用 window 自定义事件桥接。
   */
  function broadcastSw(type, payload) {
    const message = { type, payload };
    // 1. BroadcastChannel 方式（普通场景足够）
    if (swChannel) {
      try { swChannel.postMessage(message); } catch (e) {}
    }
    // 2. 同 window 也再广播一条 window 事件 —— use-sw-broadcast 对应的
    //    hook 现在只监听 BroadcastChannel，但为了兜底未来可能的独立 tab 预览，
    //    这里放一条自定义事件，方便外部探针。
    try {
      window.dispatchEvent(new CustomEvent('app:sw-message', { detail: message }));
    } catch (e) {}
  }

  /**
   * BroadcastChannel 规范不会把消息投递给发布者自己的 channel 实例。
   * 为了让 dev-mock 与前端 `useSwBroadcast` 在同一个 window 内也能联通，
   * 这里 **猴子补丁** 全局 `BroadcastChannel`：对 `app-sw-broadcast` 通道额外开一条
   * 内存旁路，让 mock 的 postMessage 也能送达前端监听器。
   */
  (function patchBroadcastChannel() {
    if (typeof BroadcastChannel !== 'function') return;
    const NativeBC = BroadcastChannel;
    /** name → Set<listener> 内存旁路表 */
    const inProcessChannels = new Map();

    function PatchedBC(name) {
      const native = new NativeBC(name);
      const localListeners = new Set();
      const instanceToken = { localListeners, native };

      if (!inProcessChannels.has(name)) inProcessChannels.set(name, new Set());
      const bucket = inProcessChannels.get(name);
      bucket.add(instanceToken);

      // 公开与原生一致的接口
      Object.defineProperty(this, 'name', { value: name, enumerable: true });

      this.postMessage = (data) => {
        // 原生：跨 window/同 origin 仍旧正常广播（不会回投自己的 native 实例）
        try { native.postMessage(data); } catch (e) {}
        // 旁路：投递到 **同 window 其他 BroadcastChannel 实例** 的 localListeners
        const event = { data, type: 'message', origin: location.origin };
        bucket.forEach((token) => {
          if (token === instanceToken) return; // 跳过自己
          token.localListeners.forEach((fn) => {
            try { fn(event); } catch (e) { console.warn(e); }
          });
        });
      };

      this.addEventListener = (type, fn) => {
        if (type !== 'message' || typeof fn !== 'function') {
          native.addEventListener(type, fn);
          return;
        }
        localListeners.add(fn);
        native.addEventListener('message', fn);
      };

      this.removeEventListener = (type, fn) => {
        if (type === 'message') localListeners.delete(fn);
        native.removeEventListener(type, fn);
      };

      this.close = () => {
        localListeners.clear();
        bucket.delete(instanceToken);
        native.close();
      };

      /** onmessage setter —— 很多代码都用它 */
      let _onmessage = null;
      Object.defineProperty(this, 'onmessage', {
        get: () => _onmessage,
        set: (fn) => {
          if (_onmessage) {
            localListeners.delete(_onmessage);
            native.removeEventListener('message', _onmessage);
          }
          _onmessage = fn;
          if (typeof fn === 'function') {
            localListeners.add(fn);
            native.addEventListener('message', fn);
          }
        },
      });
    }

    window.BroadcastChannel = PatchedBC;
  })();

  /** 模拟 Service Worker 里的 tab 查询行为 */
  function findTab(id) {
    return mockTabs.find((t) => t.id === id);
  }

  /**
   * 关闭一个或多个 tab。真实删除 + 广播 + 触发监听器。
   * @param {number | number[]} tabIdOrIds
   */
  function removeTabs(tabIdOrIds) {
    const ids = Array.isArray(tabIdOrIds) ? tabIdOrIds : [tabIdOrIds];
    const removed = [];
    ids.forEach((id) => {
      const index = mockTabs.findIndex((t) => t.id === id);
      if (index >= 0) {
        const [tab] = mockTabs.splice(index, 1);
        removed.push(tab);
      }
    });
    // 通知监听器 & 广播
    removed.forEach((tab) => {
      tabsOnRemoved.dispatch(tab.id, { windowId: tab.windowId, isWindowClosing: false });
      broadcastSw('tab-removed', { id: tab.id, windowId: tab.windowId });
    });
    return Promise.resolve();
  }

  /**
   * 更新 tab（真正修改数据 + 广播）。当前主要支持 `active: true` 作为跳转语义。
   */
  function updateTab(id, props) {
    const tab = findTab(id);
    if (!tab) return Promise.resolve(undefined);
    if (props && typeof props === 'object') {
      if (props.active === true) {
        // 模拟 activate
        mockTabs.forEach((t) => { t.active = t.id === id; });
        tab.lastAccessed = Date.now();
        tabsOnActivated.dispatch({ tabId: id, windowId: tab.windowId });
        broadcastSw('tab-activated', { id, windowId: tab.windowId });
      }
      if (typeof props.pinned === 'boolean') {
        tab.pinned = props.pinned;
        const changeInfo = { pinned: props.pinned };
        tabsOnUpdated.dispatch(id, changeInfo, tab);
        broadcastSw('tab-updated', { id, pinned: props.pinned });
      }
      if (typeof props.muted === 'boolean' || (props.mutedInfo && typeof props.mutedInfo.muted === 'boolean')) {
        const muted = typeof props.muted === 'boolean' ? props.muted : props.mutedInfo.muted;
        tab.mutedInfo = { muted };
        const changeInfo = { mutedInfo: { muted } };
        tabsOnUpdated.dispatch(id, changeInfo, tab);
        broadcastSw('tab-updated', { id });
      }
    }
    return Promise.resolve(tab);
  }

  /** 简化：所有查询返回一份不可变副本，避免外部意外修改内部数组 */
  function queryTabs() {
    return Promise.resolve(mockTabs.map((t) => ({ ...t })));
  }

  window.chrome = {
    tabs: {
      query: queryTabs,
      get: (id) => {
        const t = findTab(id);
        return Promise.resolve(t ? { ...t } : undefined);
      },
      update: updateTab,
      remove: removeTabs,
      create: ({ url } = {}) => {
        const id = 2000 + mockTabs.length;
        const newTab = {
          id,
          windowId: 1,
          index: mockTabs.length,
          url: url || 'about:blank',
          title: url || 'New Tab',
          favIconUrl: '',
          active: false,
          pinned: false,
          audible: false,
          discarded: false,
          autoDiscardable: true,
          incognito: false,
          lastAccessed: Date.now(),
          status: 'complete',
          mutedInfo: { muted: false },
          groupId: -1,
          selected: false,
          highlighted: false,
        };
        mockTabs.push(newTab);
        tabsOnCreated.dispatch({ ...newTab });
        broadcastSw('tab-created', { id: newTab.id });
        return Promise.resolve({ ...newTab });
      },
      move: (id, { index }) => {
        const current = mockTabs.findIndex((t) => t.id === id);
        if (current < 0) return Promise.resolve(undefined);
        const [t] = mockTabs.splice(current, 1);
        mockTabs.splice(index, 0, t);
        mockTabs.forEach((tab, i) => { tab.index = i; });
        broadcastSw('tab-moved', { id, fromIndex: current, toIndex: index });
        return Promise.resolve(t);
      },
      onCreated: tabsOnCreated,
      onUpdated: tabsOnUpdated,
      onRemoved: tabsOnRemoved,
      onActivated: tabsOnActivated,
      onMoved: tabsOnMoved,
    },
    windows: {
      WINDOW_ID_NONE: -1,
      WINDOW_ID_CURRENT: -2,
      getCurrent: () => Promise.resolve({ id: 1, focused: true, type: 'normal', state: 'normal' }),
      getAll: () => Promise.resolve([{ id: 1, focused: true, type: 'normal', state: 'normal', incognito: false, tabs: mockTabs.map((t) => ({ ...t })) }]),
      get: () => Promise.resolve({ id: 1, focused: true, type: 'normal', state: 'normal', incognito: false }),
      update: () => Promise.resolve(),
      create: () => Promise.resolve({ id: 2, focused: true, type: 'normal', state: 'normal', tabs: [] }),
      onFocusChanged: windowsOnFocusChanged,
    },
    sessions: {
      getRecentlyClosed: () => Promise.resolve([]),
      restore: () => Promise.resolve(undefined),
    },
    storage: {
      local: {
        get: (key) => {
          if (typeof key === 'string') {
            return Promise.resolve(storage.has(key) ? { [key]: storage.get(key) } : {});
          }
          if (Array.isArray(key)) {
            const out = {};
            for (const k of key) if (storage.has(k)) out[k] = storage.get(k);
            return Promise.resolve(out);
          }
          const out = {};
          for (const [k, v] of storage) out[k] = v;
          return Promise.resolve(out);
        },
        set: (obj) => {
          for (const [k, v] of Object.entries(obj)) storage.set(k, v);
          return Promise.resolve();
        },
        remove: (key) => { storage.delete(key); return Promise.resolve(); },
        getBytesInUse: () => Promise.resolve(0),
      },
      onChanged: storageOnChanged,
    },
    runtime: {
      sendMessage: () => Promise.resolve(),
      onMessage: runtimeOnMessage,
      getManifest: () => ({ version: '0.0.0-dev' }),
    },
    i18n: {
      getUILanguage: () => 'zh-CN',
    },
  };

  console.warn('[DevMock] chrome.* API 为假数据，仅用于浏览器预览（关闭/更新/跳转均可实时生效）');
})();
