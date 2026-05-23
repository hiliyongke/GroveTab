/**
 * useReducedMotionPreference — 检测用户是否偏好减少动画
 *
 * 使用 matchMedia 检测 prefers-reduced-motion 媒体查询，
 * 在无法检测时安全返回 false（默认允许动画）。
 * 实时监听系统偏好变化，确保响应式更新。
 *
 * @returns 如果用户偏好减少动画则返回 true，否则返回 false
 */
import { useState, useEffect } from 'react';

/**
 * 返回用户是否偏好减少动画
 *
 * @returns 如果用户偏好减少动画则返回 true，否则返回 false
 */
export function useReducedMotionPreference(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return reduced;
}
