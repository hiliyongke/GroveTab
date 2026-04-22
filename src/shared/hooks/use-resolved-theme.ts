/**
 * useResolvedTheme —— 将 settings.theme（light / dark / system）解析成实际的明暗模式
 *
 * 关键点：当用户选择 `system` 时，通过 `useSyncExternalStore` 订阅 `prefers-color-scheme`
 * 的变化事件——这正是该 Hook 的官方用途，避免在 `useEffect` 里同步 setState 触发的
 * 级联渲染告警（React 19 新规 `react-hooks/set-state-in-effect`）。
 *
 * 与 `AntdThemeProvider` 中的解析逻辑保持一致；该 Hook 用于那些需要在组件树中
 * 直接感知明暗的地方（例如背景渐变、灯泡图标等）。
 */

import { useSyncExternalStore } from 'react';
import { useSettingsStore } from '@/store';

/** 解析后的两态明暗模式 */
export type ResolvedTheme = 'light' | 'dark';

/** 订阅 prefers-color-scheme 的变化 */
function subscribeSystemTheme(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return () => undefined;
  }
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/** 同步读取当前系统是否偏好暗色 */
function getSystemDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** SSR 兜底：服务端一律按浅色 */
function getServerSnapshot(): boolean {
  return false;
}

/**
 * 根据 settings.theme 得到当前实际明暗
 *
 * - `light` / `dark` → 原样返回
 * - `system` → 通过 `useSyncExternalStore` 跟随 `prefers-color-scheme` 并实时更新
 */
export function useResolvedTheme(): ResolvedTheme {
  const themeSetting = useSettingsStore((s) => s.settings.theme);
  const systemDark = useSyncExternalStore(
    subscribeSystemTheme,
    getSystemDark,
    getServerSnapshot,
  );

  if (themeSetting === 'dark') return 'dark';
  if (themeSetting === 'light') return 'light';
  return systemDark ? 'dark' : 'light';
}
