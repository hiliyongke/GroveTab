/**
 * useCancellable — 可取消异步任务 hook
 *
 * 替代手写 `let cancelled = false` 模式（项目中有 11 处重复）。
 *
 * @example
 * const makeCancellable = useCancellable();
 * useEffect(() => {
 *   const { isCancelled } = makeCancellable();
 *   doAsync().then((data) => {
 *     if (isCancelled()) return;
 *     setData(data);
 *   });
 * }, [deps]);
 */
import { useRef, useCallback } from "react";

export function useCancellable() {
  const cancelledRef = useRef(false);

  const makeCancellable = useCallback(() => {
    cancelledRef.current = false;
    const isCancelled = () => cancelledRef.current;
    return { isCancelled } as const;
  }, []);

  return makeCancellable;
}
