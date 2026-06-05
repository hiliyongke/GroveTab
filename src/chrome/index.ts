/**
 * Chrome API 统一导出入口。
 */

export {
  queryTabs,
  queryAllTabs,
  activateTab,
  closeTab,
  closeTabs,
  createTab,
  discardTab,
  getCurrentWindow,
  getFaviconUrl,
  storageGet,
  storageSet,
  storageRemove,
  storageGetAllKeys,
  storageGetBytesInUse,
  storageOnChanged,
  computeLayoutRects,
  arrangeWindows,
  snapWindow,
  splitTabsToLayout,
  splitTabToSide,
  moveTabs,
  getAllWindows,
  createWindow,
  createWindowWithTab,
  closeWindow,
} from "./tabs";

export type { WindowRect, SplitLayout, WindowSnapAction } from "./tabs";

export { WINDOW_ID_NONE, WINDOW_ID_CURRENT, getCurrentWindowId } from "./windows";

export * from "./tabGroups";
export * from "./history";
export * from "./utils";

export { safeCall, DEFAULT_TIMEOUT, normalizeError, withTimeout } from "./safe-call";
