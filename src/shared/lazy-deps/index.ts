/**
 * Lazy-loaded deps wrapper · v1.3
 *
 * 统一收敛「只在特定 Widget 真正渲染时才加载」的重型三方依赖，
 * 避免对首屏 JS 预算（≤ 280KB raw / 90KB gz）造成污染。
 *
 * 每个 loader 都是幂等的：首次调用后结果会被缓存，后续调用直接复用同一个 Promise，
 * 因此 React 组件里重复 useEffect 也不会重复下载 chunk。
 */

// ---------- react-grid-layout ----------
// 按需加载：仅 DashboardWidgets 进入编辑布局 / 渲染时使用
let _rglPromise: Promise<typeof import('react-grid-layout')> | null = null;
export function loadReactGridLayout() {
  if (!_rglPromise) {
    _rglPromise = import('react-grid-layout');
  }
  return _rglPromise;
}

// CSS 只加载一次
let _rglCssLoaded = false;
export async function ensureReactGridLayoutCss() {
  if (_rglCssLoaded) return;
  _rglCssLoaded = true;
  // Vite 会把这些 CSS 一并打入 vendor-grid chunk，浏览器只在首次用到时才请求
  await Promise.all([
    import('react-grid-layout/css/styles.css'),
    import('react-resizable/css/styles.css'),
  ]);
}

// ---------- lunar-typescript ----------
// 按需加载：仅 CalendarWidget 且 locale=zh 时使用
let _lunarPromise: Promise<typeof import('lunar-typescript')> | null = null;
export function loadLunar() {
  if (!_lunarPromise) {
    _lunarPromise = import('lunar-typescript');
  }
  return _lunarPromise;
}
