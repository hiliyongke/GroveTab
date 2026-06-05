/**
 * Chrome Windows API 封装。非扩展上下文降级返回安全默认值。
 */

import { safeCall } from "./safe-call";

/** chrome.windows.WINDOW_ID_NONE 常量 */
export const WINDOW_ID_NONE: number =
  typeof chrome !== "undefined" && chrome.windows !== undefined
    ? chrome.windows.WINDOW_ID_NONE
    : -1;

/** chrome.windows.WINDOW_ID_CURRENT 常量 */
export const WINDOW_ID_CURRENT: number =
  typeof chrome !== "undefined" && chrome.windows !== undefined
    ? chrome.windows.WINDOW_ID_CURRENT
    : -1;

/** 获取当前窗口 ID */
export async function getCurrentWindowId(): Promise<number> {
  if (typeof chrome === "undefined" || !chrome.windows) {
    return WINDOW_ID_CURRENT;
  }
  try {
    const win = await safeCall("windows.getCurrent", () =>
      chrome.windows.getCurrent(),
    );
    return win.id ?? WINDOW_ID_CURRENT;
  } catch {
    return WINDOW_ID_CURRENT;
  }
}

type QueryOptions = Omit<chrome.windows.QueryOptions, never>;

/** 获取所有窗口 */
export async function getAllWindows(
  getInfo?: QueryOptions | boolean,
): Promise<chrome.windows.Window[]> {
  if (typeof chrome === "undefined" || !chrome.windows) {
    return [];
  }
  const options: QueryOptions | undefined =
    typeof getInfo === "boolean" ? { populate: getInfo } : getInfo;
  try {
    return await safeCall("windows.getAll", () => chrome.windows.getAll(options));
  } catch {
    return [];
  }
}
