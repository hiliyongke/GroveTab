/**
 * SearchPreferencesRepo —— 搜索偏好（运行时即时读写）
 *
 * 这些偏好不需要跨设备同步、不需要 chrome.storage 的事件传播，
 * 只是浏览器本地"上次用过哪个搜索引擎"这种轻量记忆。
 * 因此使用 `localStorage` 而非 chrome.storage.local，避免不必要的
 * 异步 I/O 与 quota 占用。
 *
 * ⚠️ 安全边界：localStorage 仅在 newtab 上下文（非 Service Worker）使用，
 *        若未来扩展至 SW 上下文，需切换为 chrome.storage.local。
 *        运行时检测：当 `typeof localStorage === "undefined"` 时自动降级返回默认值。
 *
 * 业务代码必须通过本 repo 的函数访问，不允许在 features/* 直接调用
 * `localStorage`（被 ESLint 规则 `tab/no-direct-web-storage-api` 拦截）。
 */

const LAST_ENGINE_KEY = "grove:search:lastEngine";

/**
 * 读取上次选择的搜索引擎 ID（不存在 / localStorage 不可用时返回 undefined）。
 */
export function getLastSearchEngine(): string | undefined {
  try {
    const value = localStorage.getItem(LAST_ENGINE_KEY);
    return value !== null && value !== "" ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 写入上次选择的搜索引擎 ID。失败时静默忽略（隐身模式 / quota）。
 */
export function setLastSearchEngine(engineId: string): void {
  try {
    localStorage.setItem(LAST_ENGINE_KEY, engineId);
  } catch {
    /* localStorage 不可用时不影响功能 */
  }
}
