/**
 * useSpeedDialSortable — 常用站点拖拽排序逻辑
 *
 * 封装 @dnd-kit 的 DndContext 配置和拖拽结束处理。
 * 返回 sensors 和 handleDragEnd，直接传给 DndContext 即可。
 */

import { useCallback } from 'react';
import {
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import type { SpeedDialSite } from '@/shared/types';

interface UseSpeedDialSortableProps {
  sites: readonly SpeedDialSite[];
  reorderSites: (orderedIds: string[]) => Promise<void>;
}

interface UseSpeedDialSortableReturn {
  sensors: ReturnType<typeof useSensors>;
  handleDragEnd: (event: DragEndEvent) => void;
}

export function useSpeedDialSortable({
  sites,
  reorderSites,
}: UseSpeedDialSortableProps): UseSpeedDialSortableReturn {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }, // 拖动 5px 才激活，避免误触
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event || {};
      if (!over || !active || active.id === over.id) return;

      const oldIndex = sites.findIndex((s) => s.id === active.id);
      const newIndex = sites.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const newSites = arrayMove([...sites], oldIndex, newIndex);
      void reorderSites(newSites.map((s) => s.id));
    },
    [sites, reorderSites]
  );

  return { sensors, handleDragEnd };
}
