/**
 * Chrome API 封装层：标签页、窗口、存储操作。
 *
 * 所有调用经 safeCall 包装，统一超时保护、错误归一化、日志前缀。
 */

import { safeCall, CHROME_LOG_TAG } from "./safe-call";

export { safeCall, DEFAULT_TIMEOUT, normalizeError, withTimeout } from "./safe-call";

// ── Tabs ──

/** 查询标签页，默认查全部。 */
export async function queryTabs(queryInfo: chrome.tabs.QueryInfo = {}): Promise<chrome.tabs.Tab[]> {
  return safeCall("tabs.query", () => chrome.tabs.query(queryInfo));
}

export async function queryAllTabs(): Promise<chrome.tabs.Tab[]> {
  return queryTabs({});
}

/** 激活标签页并聚焦所在窗口。 */
export async function activateTab(tabId: number, windowId?: number): Promise<void> {
  await safeCall("tabs.update(active)", () => chrome.tabs.update(tabId, { active: true }));
  if (windowId) {
    await safeCall("windows.update(focused)", () =>
      chrome.windows.update(windowId, { focused: true }),
    );
  }
}

/** 关闭单个标签页。 */
export async function closeTab(tabId: number): Promise<void> {
  await safeCall("tabs.remove", () => chrome.tabs.remove(tabId));
}

/** 批量关闭标签页（原子操作）。 */
export async function closeTabs(tabIds: number[]): Promise<void> {
  if (tabIds.length === 0) return;
  await safeCall("tabs.remove(batch)", () => chrome.tabs.remove(tabIds));
}

/** 新建标签页。 */
export async function createTab(
  createProperties: chrome.tabs.CreateProperties,
): Promise<chrome.tabs.Tab> {
  return safeCall("tabs.create", () => chrome.tabs.create(createProperties));
}

/** 休眠标签页，释放内存但保留位置。幂等操作。 */
export async function discardTab(tabId: number): Promise<void> {
  await safeCall("tabs.discard", () => chrome.tabs.discard(tabId));
}

/** 获取当前窗口。 */
export async function getCurrentWindow(): Promise<chrome.windows.Window> {
  return safeCall("windows.getCurrent", () => chrome.windows.getCurrent());
}

// ── Windows ──

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

// ── Storage ──

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

/** 列出 chrome.storage.local 所有键。 */
export async function storageGetAllKeys(): Promise<string[]> {
  const all = await safeCall("storage.local.get(null)", () => chrome.storage.local.get(null));
  return Object.keys(all);
}

/** 获取 chrome.storage.local 已用字节数。 */
export async function storageGetBytesInUse(keys: string | string[] | null = null): Promise<number> {
  return safeCall("storage.local.getBytesInUse", () => chrome.storage.local.getBytesInUse(keys));
}

/** 注册 chrome.storage.onChanged 监听，返回取消监听的函数。 */
export function storageOnChanged(
  listener: (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void,
): () => void {
  if (typeof chrome === "undefined" || chrome.storage?.onChanged === undefined) {
    return () => {};
  }
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

// ── Favicon ──

/**
 * 构造扩展同源的 `_favicon/` URL，避免 CORS 错误。
 * 非扩展上下文返回空串，调用方用 `tab.favIconUrl` 兜底。
 */
export function getFaviconUrl(url: string, size = 32): string {
  try {
    new URL(url);
  } catch {
    return "";
  }
  const runtimeId = typeof chrome !== "undefined" && chrome?.runtime?.id ? chrome.runtime.id : "";
  if (!runtimeId) return "";
  return `chrome-extension://${runtimeId}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=${size}`;
}

// ── Split Screen / Window Arrangement ──

/** 窗口目标几何位置（像素）。 */
export interface WindowRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 内置布局预设。 */
export type SplitLayout =
  | "side-by-side"
  | "stacked"
  | "grid-2x2"
  | "main-side"
  | "thirds"
  | "balanced-grid";

interface ChromeDisplayInfo {
  id: string;
  isPrimary?: boolean;
  bounds: WindowRect;
  workArea?: WindowRect;
}

interface ChromeSystemDisplayApi {
  getInfo?: () => Promise<ChromeDisplayInfo[]>;
}

interface ChromeWithSystemDisplay {
  system?: {
    display?: ChromeSystemDisplayApi;
  };
}

function normalizeRect(rect: WindowRect): WindowRect {
  return {
    left: Math.round(rect.left),
    top: Math.round(rect.top),
    width: Math.max(120, Math.round(rect.width)),
    height: Math.max(120, Math.round(rect.height)),
  };
}

function createGridRects(count: number, bounds: WindowRect): WindowRect[] {
  if (count <= 0) return [];
  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  const cellW = Math.floor(bounds.width / columns);
  const cellH = Math.floor(bounds.height / rows);

  return Array.from({ length: count }).map((_, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const isLastColumn = col === columns - 1;
    const isLastRow = row === rows - 1;
    return normalizeRect({
      left: bounds.left + col * cellW,
      top: bounds.top + row * cellH,
      width: isLastColumn ? bounds.width - cellW * col : cellW,
      height: isLastRow ? bounds.height - cellH * row : cellH,
    });
  });
}

/** 按布局计算 N 个窗口的几何位置（纯函数，不依赖 Chrome API）。 */
export function computeLayoutRects(
  layout: SplitLayout,
  count: number,
  bounds: WindowRect,
): WindowRect[] {
  if (count <= 0) return [];
  const { left, top, width, height } = bounds;

  switch (layout) {
    case "side-by-side": {
      const each = Math.floor(width / count);
      return Array.from({ length: count }).map((_, i) =>
        normalizeRect({
          left: left + i * each,
          top,
          width: i === count - 1 ? width - each * i : each,
          height,
        }),
      );
    }
    case "stacked": {
      const each = Math.floor(height / count);
      return Array.from({ length: count }).map((_, i) =>
        normalizeRect({
          left,
          top: top + i * each,
          width,
          height: i === count - 1 ? height - each * i : each,
        }),
      );
    }
    case "grid-2x2":
      return createGridRects(Math.min(count, 4), bounds);
    case "balanced-grid":
      return createGridRects(count, bounds);
    case "main-side": {
      const mainW = Math.floor((width * 2) / 3);
      const sideW = width - mainW;
      // 第一个占主区，其余在侧栏纵向均分
      const sideCount = Math.max(count - 1, 1);
      const sideH = Math.floor(height / sideCount);
      return Array.from({ length: count }).map((_, i) => {
        if (i === 0) {
          return normalizeRect({ left, top, width: mainW, height });
        }
        return normalizeRect({
          left: left + mainW,
          top: top + (i - 1) * sideH,
          width: sideW,
          height: i === count - 1 ? height - sideH * (i - 1) : sideH,
        });
      });
    }
    case "thirds": {
      const visibleCount = Math.min(count, 3);
      const each = Math.floor(width / visibleCount);
      return Array.from({ length: visibleCount }).map((_, i) =>
        normalizeRect({
          left: left + i * each,
          top,
          width: i === visibleCount - 1 ? width - each * i : each,
          height,
        }),
      );
    }
    default:
      return Array.from({ length: count }).map(() => normalizeRect({ left, top, width, height }));
  }
}

function getFallbackScreenBounds(): WindowRect {
  const screenLike = globalThis.screen;
  return {
    left: 0,
    top: 0,
    width: screenLike?.availWidth ?? 1440,
    height: screenLike?.availHeight ?? 900,
  };
}

async function ensureOptionalPermission(
  permission: chrome.runtime.ManifestPermissions,
): Promise<boolean> {
  if (chrome.permissions === undefined) return false;
  try {
    const granted = await safeCall("permissions.contains", () =>
      chrome.permissions.contains({ permissions: [permission] }),
    );
    if (granted) return true;
    return await safeCall("permissions.request", () =>
      chrome.permissions.request({ permissions: [permission] }),
    );
  } catch {
    return false;
  }
}

async function queryDisplayWorkAreas(): Promise<ChromeDisplayInfo[]> {
  const displayApi = (chrome as unknown as ChromeWithSystemDisplay).system?.display;
  if (displayApi?.getInfo === undefined) return [];
  const granted = await ensureOptionalPermission("system.display");
  if (!granted) return [];
  try {
    return await safeCall(
      "system.display.getInfo",
      () => displayApi.getInfo?.() ?? Promise.resolve([]),
    );
  } catch {
    return [];
  }
}

function pickDisplayBounds(
  displays: ChromeDisplayInfo[],
  referenceWindow?: chrome.windows.Window,
): WindowRect | null {
  if (displays.length === 0) return null;
  const refLeft = referenceWindow?.left;
  const refTop = referenceWindow?.top;
  const refWidth = referenceWindow?.width;
  const refHeight = referenceWindow?.height;

  if (
    typeof refLeft === "number" &&
    typeof refTop === "number" &&
    typeof refWidth === "number" &&
    typeof refHeight === "number"
  ) {
    const centerX = refLeft + refWidth / 2;
    const centerY = refTop + refHeight / 2;
    const matched = displays.find((display) => {
      const bounds = display.bounds;
      return (
        centerX >= bounds.left &&
        centerX <= bounds.left + bounds.width &&
        centerY >= bounds.top &&
        centerY <= bounds.top + bounds.height
      );
    });
    if (matched) return normalizeRect(matched.workArea ?? matched.bounds);
  }

  const primary = displays.find((display) => display.isPrimary);
  const fallback = primary ?? displays[0];
  return fallback ? normalizeRect(fallback.workArea ?? fallback.bounds) : null;
}

/** 取屏幕可用区域：优先 system.display.getInfo()，回退到窗口几何 → screen.avail*。 */
async function resolveScreenBounds(referenceWindowId?: number): Promise<WindowRect> {
  let referenceWindow: chrome.windows.Window | undefined;
  if (referenceWindowId !== undefined) {
    try {
      referenceWindow = await safeCall("windows.get(reference)", () =>
        chrome.windows.get(referenceWindowId),
      );
    } catch {
      // fall through
    }
  }

  const displayBounds = pickDisplayBounds(await queryDisplayWorkAreas(), referenceWindow);
  if (displayBounds) return displayBounds;

  if (referenceWindow !== undefined) {
    return normalizeRect({
      left: referenceWindow.left ?? 0,
      top: referenceWindow.top ?? 0,
      width: referenceWindow.width ?? getFallbackScreenBounds().width,
      height: referenceWindow.height ?? getFallbackScreenBounds().height,
    });
  }

  return normalizeRect(getFallbackScreenBounds());
}

/** 把若干窗口按布局排进同一屏幕区域（纯 chrome.windows.update）。 */
export async function arrangeWindows(
  windowIds: number[],
  layout: SplitLayout,
  bounds?: WindowRect,
): Promise<void> {
  if (windowIds.length === 0) return;
  const screenBounds = bounds ?? (await resolveScreenBounds(windowIds[0]));
  const rects = computeLayoutRects(layout, windowIds.length, screenBounds);

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

/** 单窗口快捷动作。 */
export type WindowSnapAction =
  | "snap-left"
  | "snap-right"
  | "snap-top"
  | "snap-bottom"
  | "maximize"
  | "restore"
  | "center";

/** 把单个窗口贴边、最大化、居中或还原。 */
export async function snapWindow(windowId: number, action: WindowSnapAction): Promise<void> {
  if (action === "maximize") {
    await safeCall("windows.update(maximize)", () =>
      chrome.windows.update(windowId, { state: "maximized", focused: true }),
    );
    return;
  }

  if (action === "restore") {
    await safeCall("windows.update(restore)", () =>
      chrome.windows.update(windowId, { state: "normal", focused: true }),
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
      ...normalizeRect(rect),
      state: "normal",
      focused: true,
    }),
  );
}

/** 把标签页拆分到独立窗口并按布局排版。返回新窗口 ID 数组。 */
export async function splitTabsToLayout(tabIds: number[], layout: SplitLayout): Promise<number[]> {
  if (tabIds.length === 0) return [];

  const tabs = await Promise.all(
    tabIds.map((id) => safeCall("tabs.get(split)", () => chrome.tabs.get(id))),
  );

  const [firstTab] = tabs;
  if (!firstTab) return [];
  const bounds = await resolveScreenBounds(firstTab.windowId);

  const newIds: number[] = [];
  for (const tab of tabs) {
    const win = await safeCall("windows.create(split)", () =>
      chrome.windows.create({ tabId: tab.id, focused: false }),
    );
    if (win?.id !== undefined) newIds.push(win.id);
  }

  await arrangeWindows(newIds, layout, bounds);
  return newIds;
}

/** 将标签页分屏到新窗口（左右各 50%）。返回新窗口 ID。 */
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

// ── Tab Move ──

/** 批量移动标签页到指定窗口。 */
export async function moveTabs(
  tabIds: number[],
  windowId: number,
  index = -1,
): Promise<chrome.tabs.Tab[]> {
  if (tabIds.length === 0) return [];
  return safeCall("tabs.move", () => chrome.tabs.move(tabIds, { windowId, index }));
}
