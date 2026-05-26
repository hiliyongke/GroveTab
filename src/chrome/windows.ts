/**
 * Chrome Windows API 封装层
 *
 * 将 chrome.windows 的直接调用收敛到此模块，
 * 以满足 tab/no-direct-chrome-api 规则。
 */

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
export function getCurrentWindowId(): Promise<number> {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.windows) {
      resolve(WINDOW_ID_CURRENT);
      return;
    }
    chrome.windows.getCurrent((win) => {
      resolve(win.id ?? WINDOW_ID_CURRENT);
    });
  });
}

type QueryOptions = Omit<chrome.windows.QueryOptions, never>;

/** 获取所有窗口 */
export function getAllWindows(getInfo?: QueryOptions | boolean): Promise<chrome.windows.Window[]> {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.windows) {
      resolve([]);
      return;
    }
    const options: QueryOptions | undefined =
      typeof getInfo === "boolean" ? { populate: getInfo } : getInfo;
    void chrome.windows.getAll(options, (windows) => {
      resolve(windows);
    });
  });
}
