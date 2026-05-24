import { useState, useEffect, useRef, useCallback } from "react";

/**
 * 通用防抖 Hook —— 延迟 milliseconds后返回最新值。
 *
 * 设计要点：
 *   - 卸载时自动清理 timer，避免内存泄漏
 *   - 用 Ref 保存 timer ID，避免 useEffect 依赖变更导致额外渲染
 *   - 返回值类型与输入值类型保持一致
 *
 * @param value - 需要防抖的值
 * @param delay  - 防抖延迟（毫秒），默认 300ms
 * @returns 防抖后的值（类型与 value 一致）
 *
 * @example
 * ```tsx
 * const [keyword, setKeyword] = useState('');
 * const debounced = useDebounce(keyword, 300);
 * // debounced 在 keyword 停止变化 300ms 后才更新
 * ```
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 清理函数：组件卸载时清除未触发的 timer
  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return clearTimer;
  }, [value, delay, clearTimer]);

  // 同步更新：若 delay 为 0 则立即返回（跳过防抖）
  useEffect(() => {
    if (delay <= 0) {
      setDebouncedValue(value);
    }
  }, [value, delay]);

  return debouncedValue;
}
