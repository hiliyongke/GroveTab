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

import { BRAND } from "@/shared/config/brand";

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
    typeof err === "string" ? err : ((err as { message?: string })?.message ?? JSON.stringify(err));
  return new Error(`${CHROME_LOG_TAG} ${label}: ${msg}`);
}

/** 常规 chrome API 的默认超时（ms）—— 足够覆盖正常执行但能兜住 SW 沉睡导致的 hang */
const DEFAULT_TIMEOUT = 5000;

/** 带超时 + 错误归一化的 chrome API 调用器 */
export function safeCall<T>(
  label: string,
  fn: () => Promise<T>,
  timeout = DEFAULT_TIMEOUT,
): Promise<T> {
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
  return safeCall("tabs.query", () => chrome.tabs.query(queryInfo));
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
  await safeCall("tabs.update(active)", () => chrome.tabs.update(tabId, { active: true }));
  if (windowId) {
    await safeCall("windows.update(focused)", () =>
      chrome.windows.update(windowId, { focused: true }),
    );
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
  await safeCall("tabs.remove", () => chrome.tabs.remove(tabId));
}

/**
 * 批量关闭 tabs
 *
 * chrome.tabs.remove 支持数组——一次调用原子关闭，不需要并发 N 个请求。
 * 若其中某个 tabId 已失效，整个 Promise 会 reject，上层需自行决定是否重试。
 */
export async function closeTabs(tabIds: number[]): Promise<void> {
  if (tabIds.length === 0) return;
  await safeCall("tabs.remove(batch)", () => chrome.tabs.remove(tabIds));
}

/**
 * 新建单个 tab（如恢复会话时在已有窗口追加）
 */
export async function createTab(
  createProperties: chrome.tabs.CreateProperties,
): Promise<chrome.tabs.Tab> {
  return safeCall("tabs.create", () => chrome.tabs.create(createProperties));
}

/**
 * 丢弃（休眠）单个标签页——释放内存但保留标签页位置。
 * 丢弃后标签页会变成灰色占位符，点击后自动恢复。
 * 已丢弃的标签页再次调用会静默成功（幂等）。
 */
export async function discardTab(tabId: number): Promise<void> {
  await safeCall("tabs.discard", () => chrome.tabs.discard(tabId));
}

/**
 * 获取当前窗口 —— 恢复会话等场景需要
 */
export async function getCurrentWindow(): Promise<chrome.windows.Window> {
  return safeCall("windows.getCurrent", () => chrome.windows.getCurrent());
}

// ── Windows ───────────────────────────────────────────

export async function getAllWindows(): Promise<chrome.windows.Window[]> {
  return safeCall("windows.getAll", () => chrome.windows.getAll({ populate: false }));
}

export async function createWindow(
  createData: chrome.windows.CreateData = {},
): Promise<chrome.windows.Window> {
  const window = await safeCall("windows.create", () => chrome.windows.create(createData));
  if (!window) throw new Error(`${CHROME_LOG_TAG} windows.create: window was not returned`);
  return window;
}

export async function createWindowWithTab(tabId: number): Promise<chrome.windows.Window> {
  return createWindow({ tabId, focused: true });
}

export async function closeWindow(windowId: number): Promise<void> {
  await safeCall("windows.remove", () => chrome.windows.remove(windowId));
}

// ── Storage ───────────────────────────────────────────

export async function storageGet<T>(key: string): Promise<T | undefined> {
  const result = await safeCall("storage.local.get", () => chrome.storage.local.get(key));
  return result[key] as T | undefined;
}

export async function storageSet<T>(key: string, value: T): Promise<void> {
  await safeCall("storage.local.set", () => chrome.storage.local.set({ [key]: value }));
}

export async function storageRemove(key: string): Promise<void> {
  await safeCall("storage.local.remove", () => chrome.storage.local.remove(key));
}

/**
 * 列出 chrome.storage.local 中的所有键。
 * 用途：一键重置等批量操作，需先枚举全部键。
 */
export async function storageGetAllKeys(): Promise<string[]> {
  const all = await safeCall("storage.local.get(null)", () => chrome.storage.local.get(null));
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
    return "";
  }
  // 仅在扩展上下文才构造 _favicon URL；普通页面预览拿不到 chrome.runtime.id
  const runtimeId = typeof chrome !== "undefined" && chrome?.runtime?.id ? chrome.runtime.id : "";
  if (!runtimeId) return "";
  return `chrome-extension://${runtimeId}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=${size}`;
}

// ── Split Screen / Window Arrangement ─────────────────

/** 单个窗口的目标几何位置（像素）。 */
export interface WindowRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 内置布局预设——用于把 N 个窗口排进同一屏幕区域。 */
export type SplitLayout =
  | "side-by-side" // 左右各 50%
  | "stacked" // 上下各 50%
  | "grid-2x2" // 田字 2×2
  | "main-side" // 左 2/3 主 + 右 1/3 侧栏
  | "thirds"; // 三等分横向

/**
 * 计算给定屏幕区域下，N 个窗口按布局应分到的几何位置。
 *
 * 不依赖 chrome API，纯几何函数，便于单测与跨进程复用。
 *
 * @param layout  目标布局
 * @param count   窗口数量
 * @param bounds  可用屏幕区域（默认整个 availWidth/Height）
 */
export function computeLayoutRects(
  layout: SplitLayout,
  count: number,
  bounds: WindowRect,
): WindowRect[] {
  if (count <= 0) return [];
  const { left, top, width, height } = bounds;

  switch (layout) {
    case "side-by-side": {
      // 偶数：均分；奇数：先两两并排，最后一个占整行
      const half = Math.floor(width / 2);
      return Array.from({ length: count }).map((_, i) => ({
        left: left + (i % 2 === 0 ? 0 : half),
        top,
        width: half,
        height,
      }));
    }
    case "stacked": {
      const each = Math.floor(height / count);
      return Array.from({ length: count }).map((_, i) => ({
        left,
        top: top + i * each,
        width,
        height: each,
      }));
    }
    case "grid-2x2": {
      const halfW = Math.floor(width / 2);
      const halfH = Math.floor(height / 2);
      return Array.from({ length: Math.min(count, 4) }).map((_, i) => ({
        left: left + (i % 2 === 0 ? 0 : halfW),
        top: top + (i < 2 ? 0 : halfH),
        width: halfW,
        height: halfH,
      }));
    }
    case "main-side": {
      const mainW = Math.floor((width * 2) / 3);
      const sideW = width - mainW;
      // 第一个占主区，其余在侧栏纵向均分
      const sideCount = Math.max(count - 1, 1);
      const sideH = Math.floor(height / sideCount);
      return Array.from({ length: count }).map((_, i) => {
        if (i === 0) {
          return { left, top, width: mainW, height };
        }
        return {
          left: left + mainW,
          top: top + (i - 1) * sideH,
          width: sideW,
          height: sideH,
        };
      });
    }
    case "thirds": {
      const each = Math.floor(width / 3);
      return Array.from({ length: count }).map((_, i) => ({
        left: left + (i % 3) * each,
        top: top + Math.floor(i / 3) * height,
        width: each,
        height,
      }));
    }
    default:
      return Array.from({ length: count }).map(() => ({ left, top, width, height }));
  }
}

/**
 * 取屏幕可用区域作为默认布局边界。
 *
 * 注意：Chrome 扩展无法直接读取多显示器拓扑（除非用 system.display API），
 * 这里用首个窗口的位置近似当前用户所在显示器；如果没有任何窗口，回退到 `screen.availWidth/Height`。
 */
async function resolveScreenBounds(referenceWindowId?: number): Promise<WindowRect> {
  if (referenceWindowId !== undefined) {
    try {
      const ref = await safeCall("windows.get(reference)", () =>
        chrome.windows.get(referenceWindowId),
      );
      return {
        left: ref.left ?? 0,
        top: ref.top ?? 0,
        width: ref.width ?? screen.availWidth,
        height: ref.height ?? screen.availHeight,
      };
    } catch {
      // fall through
    }
  }
  return {
    left: 0,
    top: 0,
    width: screen.availWidth,
    height: screen.availHeight,
  };
}

/**
 * 把指定的若干窗口按布局排进同一屏幕区域。
 *
 * 适用场景：
 *   - 用户把 N 个浏览器窗口"snap 到网格"
 *   - 分屏批处理：先 createWindow 再 arrangeWindows 排版
 *
 * 实现：纯 `chrome.windows.update`，不创建/关闭任何窗口。
 *
 * @param windowIds  目标窗口 ID 数组（顺序决定 layout 中的位置）
 * @param layout     布局预设
 * @param bounds     可选：自定义屏幕区域；不传则用首个窗口当前所在屏幕
 */
export async function arrangeWindows(
  windowIds: number[],
  layout: SplitLayout,
  bounds?: WindowRect,
): Promise<void> {
  if (windowIds.length === 0) return;
  const screenBounds = bounds ?? (await resolveScreenBounds(windowIds[0]));
  const rects = computeLayoutRects(layout, windowIds.length, screenBounds);

  // 并发更新所有窗口，整体一次到位
  await Promise.all(
    windowIds.map((id, idx) => {
      const rect = rects[idx];
      if (!rect) return Promise.resolve();
      return safeCall(`windows.update(arrange[${idx}])`, () =>
        chrome.windows.update(id, {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          state: "normal",
          focused: idx === windowIds.length - 1,
        }),
      );
    }),
  );
}

/** 单窗口贴边/还原快捷动作。 */
export type WindowSnapAction =
  | "snap-left" // 左半屏
  | "snap-right" // 右半屏
  | "snap-top" // 上半屏
  | "snap-bottom" // 下半屏
  | "maximize" // 最大化
  | "center"; // 居中 80%

/**
 * 把单个窗口贴到屏幕的某一半（或最大化/居中）。
 *
 * 与 `arrangeWindows` 的区别：本函数仅操作一个窗口，不需要预先收集多个窗口 ID。
 * 适合 WindowCard 的"快速贴边"菜单。
 */
export async function snapWindow(windowId: number, action: WindowSnapAction): Promise<void> {
  if (action === "maximize") {
    await safeCall("windows.update(maximize)", () =>
      chrome.windows.update(windowId, { state: "maximized", focused: true }),
    );
    return;
  }

  const bounds = await resolveScreenBounds(windowId);
  const halfW = Math.floor(bounds.width / 2);
  const halfH = Math.floor(bounds.height / 2);

  let rect: WindowRect;
  switch (action) {
    case "snap-left":
      rect = { left: bounds.left, top: bounds.top, width: halfW, height: bounds.height };
      break;
    case "snap-right":
      rect = { left: bounds.left + halfW, top: bounds.top, width: halfW, height: bounds.height };
      break;
    case "snap-top":
      rect = { left: bounds.left, top: bounds.top, width: bounds.width, height: halfH };
      break;
    case "snap-bottom":
      rect = { left: bounds.left, top: bounds.top + halfH, width: bounds.width, height: halfH };
      break;
    case "center": {
      const w = Math.floor(bounds.width * 0.8);
      const h = Math.floor(bounds.height * 0.8);
      rect = {
        left: bounds.left + Math.floor((bounds.width - w) / 2),
        top: bounds.top + Math.floor((bounds.height - h) / 2),
        width: w,
        height: h,
      };
      break;
    }
    default:
      return;
  }

  await safeCall(`windows.update(${action})`, () =>
    chrome.windows.update(windowId, {
      ...rect,
      state: "normal",
      focused: true,
    }),
  );
}

/**
 * 把指定的若干 tabs（可来自不同窗口）拆分到独立窗口并按布局排版。
 *
 * 流程：
 *   1. 对每个 tabId 调 `windows.create({ tabId })` 拆出新窗口
 *   2. 调 `arrangeWindows` 把新窗口（含原 tab 所属窗口）一起排版
 *
 * 第一个 tab 的"原窗口"会保留作为锚点，避免一个窗口下的最后一个 tab 被拆走导致原窗口被销毁。
 *
 * @returns 排版后的窗口 ID 数组（与传入 tabId 顺序一致）
 */
export async function splitTabsToLayout(tabIds: number[], layout: SplitLayout): Promise<number[]> {
  if (tabIds.length === 0) return [];

  const tabs = await Promise.all(
    tabIds.map((id) => safeCall("tabs.get(split)", () => chrome.tabs.get(id))),
  );

  // 第一个 tab 留在原窗口；其余拆到新窗口
  const [firstTab, ...restTabs] = tabs;
  if (!firstTab) return [];
  const firstWindowId = firstTab.windowId;

  const newIds: number[] = [firstWindowId];
  for (const rt of restTabs) {
    const win = await safeCall("windows.create(split)", () =>
      chrome.windows.create({ tabId: rt.id, focused: false }),
    );
    if (win?.id !== undefined) newIds.push(win.id);
  }

  await arrangeWindows(newIds, layout);
  return newIds;
}

/**
 * 分屏：将指定标签页移到新窗口，并将原窗口和新窗口各调整到屏幕 50%（左右）。
 *
 * 保留作为薄封装，避免破坏既有调用方（TabContextMenu）。
 * 内部直接复用 `splitTabsToLayout`。
 *
 * @returns 新窗口的 ID
 */
export async function splitTabToSide(tabId: number): Promise<number> {
  const tab = await safeCall("tabs.get", () => chrome.tabs.get(tabId));
  const originWindow = await safeCall("windows.get", () => chrome.windows.get(tab.windowId));

  const bounds: WindowRect = {
    left: originWindow.left ?? 0,
    top: originWindow.top ?? 0,
    width: originWindow.width ?? screen.availWidth,
    height: originWindow.height ?? screen.availHeight,
  };

  const newWindow = await safeCall("windows.create", () =>
    chrome.windows.create({ tabId, focused: true }),
  );
  if (!newWindow?.id) throw new Error(`${CHROME_LOG_TAG} splitTabToSide: new window has no id`);

  await arrangeWindows([tab.windowId, newWindow.id], "side-by-side", bounds);
  return newWindow.id;
}

// ── Tab Move ──────────────────────────────────────────

/**
 * 批量移动标签页到指定窗口
 */
export async function moveTabs(
  tabIds: number[],
  windowId: number,
  index = -1,
): Promise<chrome.tabs.Tab[]> {
  if (tabIds.length === 0) return [];
  return safeCall("tabs.move", () => chrome.tabs.move(tabIds, { windowId, index }));
}
