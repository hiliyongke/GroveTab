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
 * @returns 包装后的 Promise，超时后抛出错误
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
 *
 * @param err 原始错误（可能是 Error、字符串或其他类型）
 * @param label 接口标识（用于错误日志）
 * @returns 归一化后的 Error 实例
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

/**
 * 带超时 + 错误归一化的 chrome API 调用器
 *
 * 所有对 chrome.* API 的调用都应通过此函数，以确保：
 *   - 不会因 SW 沉睡而永久 hang（超时保护）
 *   - 错误信息统一格式，便于日志排查
 *   - 同步抛出的异常也能被正确捕获
 *
 * @param label   用于错误日志的接口标识（如 'tabs.query'）
 * @param fn      返回 Promise 的 chrome API 调用（懒执行）
 * @param timeout 超时阈值（ms），默认 DEFAULT_TIMEOUT(5000)
 * @returns API 调用的原始返回值
 * @throws 超时或 API 执行失败时抛出归一化后的 Error
 */
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
 * @returns 符合条件的标签页列表
 */
export async function queryTabs(queryInfo: chrome.tabs.QueryInfo = {}): Promise<chrome.tabs.Tab[]> {
  return safeCall('tabs.query', () => chrome.tabs.query(queryInfo));
}

/**
 * 查询所有标签页（无条件查询）
 *
 * 等价于 queryTabs({})， convenience 封装。
 * @returns 所有窗口中所有标签页的完整列表
 */
export async function queryAllTabs(): Promise<chrome.tabs.Tab[]> {
  return queryTabs({});
}

/**
 * 激活（跳转）一个 tab + 聚焦其所在窗口
 *
 * 分两步走是因为 chrome.tabs.update 不会自动 focus 窗口；
 * 任何一步失败都会抛出——上层可据此给出 toast 反馈。
 *
 * @param tabId     要激活的标签页 ID
 * @param windowId  可选，标签页所在窗口 ID
 * @returns 无返回值
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
 * @param tabId 要关闭的标签页 ID
 */
export async function closeTab(tabId: number): Promise<void> {
  await safeCall('tabs.remove', () => chrome.tabs.remove(tabId));
}

/**
 * 批量关闭 tabs
 *
 * chrome.tabs.remove 支持数组——一次调用原子关闭，不需要并发 N 个请求。
 * 若其中某个 tabId 已失效，整个 Promise 会 reject，上层需自行决定是否重试。
 *
 * @param tabIds 要关闭的标签页 ID 数组
 * @returns 无返回值
 */
export async function closeTabs(tabIds: number[]): Promise<void> {
  if (tabIds.length === 0) return;
  await safeCall('tabs.remove(batch)', () => chrome.tabs.remove(tabIds));
}

/**
 * 新建单个 tab（如恢复会话时在已有窗口追加）
 *
 * @param createProperties 创建标签页的属性
 * @returns 新创建的标签页对象
 */
export async function createTab(createProperties: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab> {
  return safeCall('tabs.create', () => chrome.tabs.create(createProperties));
}

/**
 * 丢弃（休眠）单个标签页——释放内存但保留标签页位置。
 * 丢弃后标签页会变成灰色占位符，点击后自动恢复。
 * 已丢弃的标签页再次调用会静默成功（幂等）。
 *
 * @param tabId 要丢弃的标签页 ID
 * @returns 无返回值
 */
export async function discardTab(tabId: number): Promise<void> {
  await safeCall('tabs.discard', () => chrome.tabs.discard(tabId));
}

/**
 * 获取当前窗口对象
 *
 * 恢复会话等场景需要拿到当前窗口的尺寸/位置信息。
 *
 * @returns 当前聚焦的窗口对象
 * @throws 当无窗口焦点或权限不足时抛出
 */
export async function getCurrentWindow(): Promise<chrome.windows.Window> {
  return safeCall('windows.getCurrent', () => chrome.windows.getCurrent());
}

// ── Windows ───────────────────────────────────────────

/**
 * 获取所有窗口（不含标签页详情）
 *
 * 使用 `populate: false` 避免一次性拉取所有标签页数据，
 * 减少 MV3 Service Worker 内存压力。如需标签页信息请单独调用 queryTabs。
 * @returns 所有窗口的对象数组（不含 tabs 字段）
 */
export async function getAllWindows(): Promise<chrome.windows.Window[]> {
  return safeCall('windows.getAll', () => chrome.windows.getAll({ populate: false }));
}

// ── Storage ───────────────────────────────────────────

/**
 * 从 chrome.storage.local 读取单个键值
 *
 * 封装了 chrome.storage.local.get 的类型安全包装。
 * 若 key 不存在，返回 undefined（不会抛异常）。
 *
 * @param key 要读取的存储键名
 * @returns 反序列化后的值，或 undefined（key 不存在时）
 */
export async function storageGet<T>(key: string): Promise<T | undefined> {
  const result = await safeCall('storage.local.get', () => chrome.storage.local.get(key));
  return result[key] as T | undefined;
}

/**
 * 向 chrome.storage.local 写入单个键值
 *
 * 值是按 JSON 序列化后存储的，注意不要存函数 / Symbol 等不可序列化值。
 *
 * @param key   存储键名
 * @param value 要存储的值（会被 JSON.stringify）
 * @returns 无返回值
 */
export async function storageSet<T>(key: string, value: T): Promise<void> {
  await safeCall('storage.local.set', () => chrome.storage.local.set({ [key]: value }));
}

/**
 * 从 chrome.storage.local 删除单个键
 *
 * 若 key 不存在，Chrome 会静默成功（不会抛异常）。
 *
 * @param key 要删除的存储键名
 * @returns 无返回值
 */
export async function storageRemove(key: string): Promise<void> {
  await safeCall('storage.local.remove', () => chrome.storage.local.remove(key));
}

/**
 * 列出 chrome.storage.local 中的所有键
 *
 * 用途：一键重置等批量操作，需先枚举全部键。
 *
 * @returns 所有存储键名组成的数组
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
 *
 * @param url  目标网页 URL（用于定位 favicon）
 * @param size 期望的 favicon 尺寸，默认 32
 * @returns 扩展内置 favicon 代理 URL；异常或不在扩展上下文时返回空串
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

/** Chrome 原生 Tab Group 的简化表示 */
export interface ChromeTabGroup {
  /** Tab Group 的唯一 ID（由 Chrome 分配） */
  id: number;
  /** 用户自定义的组标题，未设置时为 undefined */
  title?: string;
  /** 组的颜色标识（Chrome 预定义色值） */
  color: string;
  /** 组是否已折叠（折叠后组内标签页不单独显示） */
  collapsed: boolean;
  /** 该组所属的窗口 ID */
  windowId: number;
}

/**
 * 获取指定窗口的所有 Tab Group
 *
 * chrome.tabGroups API 需要 `tabGroups` permission。
 * 失败时返回空数组（兼容无权限或非扩展上下文）。
 *
 * @param windowId 目标窗口 ID；不传则查询所有窗口
 * @returns Tab Group 列表，失败时返回空数组
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
 * @param tabId 要分屏的标签页 ID
 * @returns 新创建的窗口 ID
 * @throws 当无法获取原窗口信息或新窗口创建失败时抛出
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
 *
 * 移动后标签页在原窗口消失，出现在目标窗口的指定位置。
 * 空数组调用会直接返回空数组，不做 API 调用。
 *
 * @param tabIds   要移动的标签页 ID 数组
 * @param windowId 目标窗口 ID
 * @param index    插入位置索引，-1 表示插到末尾
 * @returns 移动后的标签页对象数组
 * @throws 当 windowId 无效或权限不足时抛出
 */
export async function moveTabs(tabIds: number[], windowId: number, index = -1): Promise<chrome.tabs.Tab[]> {
  if (tabIds.length === 0) return [];
  return safeCall('tabs.move', () => chrome.tabs.move(tabIds, { windowId, index }));
}
