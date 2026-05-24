import { useCallback, useMemo, useState } from "react";

interface Identifiable {
  id: number;
}

/**
 * 管理卡片内列表的本地拖拽顺序。
 *
 * 使用 ID 记录顺序，源列表更新后自动过滤已删除项并追加新增项，避免 stale object。
 */
export function useCardReorder<T extends Identifiable>(items: readonly T[]) {
  const [orderOverride, setOrderOverride] = useState<number[] | null>(null);

  const orderedItems = useMemo(() => {
    if (!orderOverride) return [...items];

    const freshMap = new Map(items.map((item) => [item.id, item]));
    const result: T[] = [];

    for (const id of orderOverride) {
      const item = freshMap.get(id);
      if (item) {
        result.push(item);
        freshMap.delete(id);
      }
    }

    for (const item of items) {
      if (freshMap.has(item.id)) result.push(item);
    }

    return result;
  }, [items, orderOverride]);

  const handleReorder = useCallback((newOrder: readonly T[]) => {
    setOrderOverride(newOrder.map((item) => item.id));
  }, []);

  const resetOrder = useCallback(() => {
    setOrderOverride(null);
  }, []);

  return {
    orderedItems,
    handleReorder,
    resetOrder,
  };
}
