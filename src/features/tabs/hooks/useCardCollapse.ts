import { useCallback, useRef, useState } from "react";

interface UseCardCollapseOptions {
  /**
   * 初始折叠状态（仅首次挂载时使用）
   * 后续由调用方通过 setCollapsed 驱动
   */
  initialCollapsed?: boolean;
  /**
   * 折叠状态变化回调
   * 调用方通常在这里调用 Chrome API 并广播
   */
  onChange?: (collapsed: boolean) => void;
}

/**
 * 管理卡片折叠状态。
 *
 * 设计：
 *   - 内部管理 collapsed state，onClick 切换时乐观更新
 *   - 外部通过 setCollapsed 强制同步（如浏览器原生折叠状态变化）
 *   - 不使用 forceCollapsed 受控模式（由调用方在渲染层处理）
 *
 * TabGroupCard 的用法：
 *   1. 用户点击头部 → toggleCollapse() → 乐观更新 + onChange → Chrome API
 *   2. 浏览器外部折叠 → useEffect 检测到 group.collapsed 变化 → setCollapsed()
 *   3. 全局"全部折叠" → forceCollapsed prop 在渲染层生效，不走 hook
 */
export function useCardCollapse({
  initialCollapsed = false,
  onChange,
}: UseCardCollapseOptions = {}) {
  const [collapsed, setCollapsedState] = useState(initialCollapsed);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const toggleCollapse = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      onChangeRef.current?.(next);
      return next;
    });
  }, []);

  const setCollapsed = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    setCollapsedState((prev) => {
      const value = typeof next === "function" ? (next as (p: boolean) => boolean)(prev) : next;
      onChangeRef.current?.(value);
      return value;
    });
  }, []);

  /** 同步外部状态到内部 state，不触发 onChange（避免重复调用 Chrome API） */
  const syncState = useCallback((value: boolean) => {
    setCollapsedState(value);
  }, []);

  return {
    collapsed,
    setCollapsed,
    toggleCollapse,
    syncState,
  };
}
