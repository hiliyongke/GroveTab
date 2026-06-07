/**
 * useDragSortable — 统一拖拽排序 Hook（P2-06）
 *
 * 封装 @dnd-kit 常用模式，供 Kanban/Window/TabGroup/SpeedDial 等视图复用。
 * 统一配置：
 *   - collisionDetection: closestCenter
 *   - activationConstraints: distance 5px（防止误触）
 *   - 传感器: pointer + keyboard
 */

import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { ReactNode } from "react";

export interface DragSortableConfig {
  /** 可排序项的唯一 ID 列表 */
  items: Array<{ id: string | number }>;
  /** 拖拽结束回调 */
  onDragEnd: (event: DragEndEvent) => void;
  /** 传感器策略（默认 PointerSensor + KeyboardSensor） */
  activationDistance?: number;
}

/**
 * 创建统一的 @dnd-kit DndContext + SortableContext 包装器。
 *
 * @example
 * <DragSortableContainer items={tabs} onDragEnd={(e) => { ... }}>
 *   {tabs.map(tab => <SortableItem key={tab.id} id={tab.id}>{...}</SortableItem>)}
 * </DragSortableContainer>
 */
export function DragSortableContainer({
  items,
  onDragEnd,
  activationDistance = 5,
  children,
}: DragSortableConfig & { children: ReactNode }) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: activationDistance },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={items.map((it) => it.id)}
        strategy={verticalListSortingStrategy}
      >
        {children}
      </SortableContext>
    </DndContext>
  );
}
