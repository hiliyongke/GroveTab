import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";

import type { WindowDragData } from "./dragTypes";
import domainStyles from "../styles/items.module.less";
import styles from "../styles/views.module.less";

interface SortableWindowCardProps {
  windowId: number;
  children: ReactNode;
}

export function SortableWindowCard({ windowId, children }: SortableWindowCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `window-sort:${windowId}`,
    data: { kind: "window-card", windowId } satisfies WindowDragData,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : "auto",
  };

  return (
    <div
      ref={setNodeRef}
      className={`${domainStyles["app-domain-masonry-item"]} ${styles["app-window-sortable-card"]}${isDragging ? ` ${styles["is-dragging"]}` : ""}`}
      style={style}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}
