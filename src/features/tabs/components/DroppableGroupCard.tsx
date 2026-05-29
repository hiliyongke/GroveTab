/**
 * DroppableGroupCard — 可接收拖放的卡片包装器
 *
 * 基于 @dnd-kit/core 的 useDroppable，包装分组卡片使其可以接收拖放的标签
 */

import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";
import styles from "../styles/items.module.less";

/** 放置数据类型 - 域名分组 */
export interface DomainDropData {
  kind: "domain";
  domain: string;
}

/** 放置数据类型 - 标签分组 */
export interface TabGroupDropData {
  kind: "tab-group";
  groupId: number;
  windowId: number;
}

interface DroppableGroupCardProps {
  id: string;
  data: DomainDropData | TabGroupDropData;
  children: ReactNode;
  className?: string;
}

export function DroppableGroupCard({ id, data, children, className }: DroppableGroupCardProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
    data,
  });

  return (
    <div
      ref={setNodeRef}
      className={`${className ?? ""}${isOver ? ` ${styles["is-drag-over"]}` : ""}`}
      data-droppable-id={id}
    >
      {children}
    </div>
  );
}
