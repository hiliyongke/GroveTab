/**
 * Chrome API — 标签页、窗口、会话、存储的 Promise 化统一封装
 *
 * 设计原则：
 *   1. 所有外部调用点只依赖本文件，不直接触 `chrome.xxx`——便于统一容错
 *   2. 每个调用包一层「超时 + 错误归一化 + 标准日志」
 *      - 超时：防止 Service Worker 沉睡/通信异常导致的 Promise hang 死
 *      - 错误归一化：`chrome.runtime.lastError` 和 rejection 统一成 Error 抛出
 *      - 标准日志：出错时打品牌化前缀 + 接口名，便于线上排查
 *   3. 只做「封装」不做「兜底」——失败一律抛出，由上层 store/UI 决定是否 toast
 */

import { BRAND } from '@/shared/config/brand';

const CHROME_LOG_TAG = `${BRAND.logTag}/chrome`;

/**
 * 将一个可能永远不 resolve 的 Promise 用超时包住
 *
 * @param promise    原始 Promise
 * @param ms         超时阈值（毫秒）
 * @param label      用于错误信息的接口名
 * @throws `Error(label) timeout` 超时后抛出
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${CHROME_LOG_TAG} ${label} timeout after ${ms}ms`));
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(normalizeError(err, label));
      },
    );
  });
}

/**
 * 把 chrome API 抛出的任意值统一成 Error 实例
 *
 * Chrome API 在 Manifest V3 下一般会 reject 一个 Error，但历史版本里偶尔
 * reject 字符串 或 `{ message: ... }` 结构，这里统一成 Error，并带上接口上下文。
 */
function normalizeError(err: unknown, label: string): Error {
  if (err instanceof Error) {
    // 保留原 stack，仅在 message 前加上下文
    err.message = `${CHROME_LOG_TAG} ${label}: ${err.message}`;
    return err;
  }
  const msg =
    typeof err === 'string'
      ? err
      : (err as { message?: string })?.message ?? JSON.stringify(err);
  return new Error(`${CHROME_LOG_TAG} ${label}: ${msg}`);
}

/** 常规 chrome API 的默认超时（ms）—— 足够覆盖正常执行但能兜住 SW 沉睡导致的 hang */
const DEFAULT_TIMEOUT = 5000;

/** 带超时 + 错误归一化的 chrome API 调用器 */
export function safeCall<T>(label: string, fn: () => Promise<T>, timeout = DEFAULT_TIMEOUT): Promise<T> {
  try {
    return withTimeout(fn(), timeout, label);
  } catch (err) {
    // 同步抛出（极少数实现会同步抛）的情况也归一化
    return Promise.reject(normalizeError(err, label));
  }
}

// ── Tabs ──────────────────────────────────────────────

/**
 * 查询标签页。
 *
 * @param queryInfo Chrome tabs.query 的查询条件；默认查询全部标签页。
 */
export async function queryTabs(queryInfo: chrome.tabs.QueryInfo = {}): Promise<chrome.tabs.Tab[]> {
  return safeCall('tabs.query', () => chrome.tabs.query(queryInfo));
}

export async function queryAllTabs(): Promise<chrome.tabs.Tab[]> {
  return queryTabs({});
}

/**
 * 激活（跳转）一个 tab + 聚焦其所在窗口
 *
 * 分两步走是因为 chrome.tabs.update 不会自动 focus 窗口；
 * 任何一步失败都会抛出——上层可据此给出 toast 反馈。
 */
export async function activateTab(tabId: number, windowId?: number): Promise<void> {
  await safeCall('tabs.update(active)', () => chrome.tabs.update(tabId, { active: true }));
  if (windowId) {
    await safeCall('windows.update(focused)', () => chrome.windows.update(windowId, { focused: true }));
  }
}

/**
 * 关闭单个 tab
 *
 * ⚠️ 常见失败：
 *   - tabId 已不存在（用户从浏览器 UI 自行关闭 + SW broadcast 未及时同步）
 *   - Chrome 进程回收（MV3 SW 未运行）
 * 这两种情况都会由 safeCall 抛出带上下文的 Error，上层需 toast。
 */
export async function closeTab(tabId: number): Promise<void> {
  await safeCall('tabs.remove', () => chrome.tabs.remove(tabId));
}

/**
 * 批量关闭 tabs
 *
 * chrome.tabs.remove 支持数组——一次调用原子关闭，不需要并发 N 个请求。
 * 若其中某个 tabId 已失效，整个 Promise 会 reject，上层需自行决定是否重试。
 */
export async function closeTabs(tabIds: number[]): Promise<void> {
  if (tabIds.length === 0) return;
  await safeCall('tabs.remove(batch)', () => chrome.tabs.remove(tabIds));
}

/**
 * 新建单个 tab（如恢复会话时在已有窗口追加）
 */
export async function createTab(createProperties: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab> {
  return safeCall('tabs.create', () => chrome.tabs.create(createProperties));
}

/**
 * 丢弃（休眠）单个标签页——释放内存但保留标签页位置。
 * 丢弃后标签页会变成灰色占位符，点击后自动恢复。
 * 已丢弃的标签页再次调用会静默成功（幂等）。
 */
export async function discardTab(tabId: number): Promise<void> {
  await safeCall('tabs.discard', () => chrome.tabs.discard(tabId));
}

/**
 * 获取当前窗口 —— 恢复会话等场景需要
 */
export async function getCurrentWindow(): Promise<chrome.windows.Window> {
  return safeCall('windows.getCurrent', () => chrome.windows.getCurrent());
}

// ── Windows ───────────────────────────────────────────

export async function getAllWindows(): Promise<chrome.windows.Window[]> {
  return safeCall('windows.getAll', () => chrome.windows.getAll({ populate: false }));
}

// ── Storage ───────────────────────────────────────────

export async function storageGet<T>(key: string): Promise<T | undefined> {
  const result = await safeCall('storage.local.get', () => chrome.storage.local.get(key));
  return result[key] as T | undefined;
}

export async function storageSet<T>(key: string, value: T): Promise<void> {
  await safeCall('storage.local.set', () => chrome.storage.local.set({ [key]: value }));
}

export async function storageRemove(key: string): Promise<void> {
  await safeCall('storage.local.remove', () => chrome.storage.local.remove(key));
}

/**
 * 列出 chrome.storage.local 中的所有键。
 * 用途：一键重置等批量操作，需先枚举全部键。
 */
export async function storageGetAllKeys(): Promise<string[]> {
  const all = await safeCall('storage.local.get(null)', () => chrome.storage.local.get(null));
  return Object.keys(all);
}

// ── Favicon ───────────────────────────────────────────

/**
 * 根据 URL 构造 Chrome 内置 favicon 地址
 *
 * MV3 + `favicon` permission 下，正确的入口是
 * `chrome-extension://<id>/_favicon/?pageUrl=...&size=...`。
 *
 * 该 URL 与扩展页面同源，既不会触发 CORS 错误，也能被 canvas 安全读像素。
 * 老的 `chrome://favicon2/...` 形式在 MV3 里访问会被拦下并打红控制台，禁用之。
 *
 * 非扩展上下文（如 `pnpm dev` 直接在浏览器里预览）返回空串，让调用方用
 * `tab.favIconUrl` 本身兜底。
 */
export function getFaviconUrl(url: string, size = 32): string {
  try {
    // 校验 URL 合法性
    new URL(url);
  } catch {
    return '';
  }
  // 仅在扩展上下文才构造 _favicon URL；普通页面预览拿不到 chrome.runtime.id
  const runtimeId =
    typeof chrome !== 'undefined' && chrome?.runtime?.id ? chrome.runtime.id : '';
  if (!runtimeId) return '';
  return `chrome-extension://${runtimeId}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=${size}`;
}

// ── Tab Groups ────────────────────────────────────────

/** Chrome 原生 Tab Group 信息 */
export interface ChromeTabGroup {
  id: number;
  title?: string;
  color: string;
  collapsed: boolean;
  windowId: number;
}

/**
 * 获取当前窗口的所有 Tab Group
 *
 * chrome.tabGroups API 需要 `tabGroups` permission。
 * 失败时返回空数组（兼容无权限或非扩展上下文）。
 */
export async function queryTabGroups(windowId?: number): Promise<ChromeTabGroup[]> {
  try {
    const opts: chrome.tabGroups.QueryInfo = {};
    if (windowId != null) opts.windowId = windowId;
    return safeCall('tabGroups.query', () => chrome.tabGroups.query(opts));
  } catch {
    return [];
  }
}

// ── Split Screen ──────────────────────────────────────

/**
 * 分屏：将指定标签页移到新窗口，并将原窗口和新窗口各调整到屏幕 50%
 *
 * 流程：
 *   1. 获取原窗口位置/尺寸
 *   2. 将标签移到新窗口（chrome.windows.create）
 *   3. 原窗口缩小到左半屏
 *   4. 新窗口缩小到右半屏
 *
 * @returns 新窗口的 ID
 */
export async function splitTabToSide(tabId: number): Promise<number> {
  // 1. 获取原 tab 和窗口信息
  const tab = await safeCall('tabs.get', () => chrome.tabs.get(tabId));
  const originWindow = await safeCall('windows.get', () => chrome.windows.get(tab.windowId));
  const ol = originWindow.left ?? 0;
  const ot = originWindow.top ?? 0;
  const ow = originWindow.width ?? screen.availWidth;
  const oh = originWindow.height ?? screen.availHeight;

  // 2. 将 tab 移到新窗口
  const newWindow = await safeCall('windows.create', () =>
    chrome.windows.create({ tabId, focused: true }),
  );
  if (!newWindow?.id) throw new Error(`${CHROME_LOG_TAG} splitTabToSide: new window has no id`);

  // 3. 计算半屏位置
  const halfWidth = Math.floor(ow / 2);

  // 4. 原窗口 → 左半屏
  await safeCall('windows.update(origin)', () =>
    chrome.windows.update(tab.windowId, {
      left: ol,
      top: ot,
      width: halfWidth,
      height: oh,
      focused: false,
    }),
  );

  // 5. 新窗口 → 右半屏
  await safeCall('windows.update(new)', () =>
    chrome.windows.update(newWindow.id!, {
      left: ol + halfWidth,
      top: ot,
      width: halfWidth,
      height: oh,
      focused: true,
    }),
  );

  return newWindow.id;
}

// ── Tab Move ──────────────────────────────────────────

/**
 * 批量移动标签页到指定窗口
 */
export async function moveTabs(tabIds: number[], windowId: number, index = -1): Promise<chrome.tabs.Tab[]> {
  if (tabIds.length === 0) return [];
  return safeCall('tabs.move', () => chrome.tabs.move(tabIds, { windowId, index }));
}
