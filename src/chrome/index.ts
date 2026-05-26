/**
 * Chrome API barrel export
 */

// tabs.ts 导出了标签页相关函数和类型（包括从 windows.ts 重新导出的窗口操作函数）
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
  safeCall,
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
  // 从 windows 重新导出的函数
  getAllWindows,
  createWindow,
  createWindowWithTab,
  closeWindow,
} from "./tabs";

// 类型也从 tabs 导出
export type { WindowRect, SplitLayout, WindowSnapAction } from "./tabs";

// windows.ts 独有导出（tabs.ts 未重新导出的常量和函数）
export { WINDOW_ID_NONE, WINDOW_ID_CURRENT, getCurrentWindowId } from "./windows";

// 其他模块
export * from "./tabGroups";
export * from "./history";
export * from "./utils";
