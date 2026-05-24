import { useCallback, useState } from "react";

interface UseCardCollapseOptions {
  initialCollapsed?: boolean;
  onChange?: (collapsed: boolean) => void;
}

/** 管理卡片折叠状态，支持受业务方监听变化。 */
export function useCardCollapse({
  initialCollapsed = false,
  onChange,
}: UseCardCollapseOptions = {}) {
  const [collapsed, setCollapsedState] = useState(initialCollapsed);

  const setCollapsed = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setCollapsedState((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        onChange?.(value);
        return value;
      });
    },
    [onChange],
  );

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, [setCollapsed]);

  return {
    collapsed,
    setCollapsed,
    toggleCollapse,
  };
}
