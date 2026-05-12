/**
 * Lazy-loaded deps wrapper
 *
 * 统一收敛「只在特定功能真正渲染时才加载」的重型三方依赖，
 * 避免对首屏 JS 预算造成污染。
 */

// ---------- lunar-typescript ----------
// 按需加载：仅日历功能且 locale=zh 时使用
let _lunarPromise: Promise<typeof import('lunar-typescript')> | null = null;
export function loadLunar() {
  if (!_lunarPromise) {
    _lunarPromise = import('lunar-typescript');
  }
  return _lunarPromise;
}
