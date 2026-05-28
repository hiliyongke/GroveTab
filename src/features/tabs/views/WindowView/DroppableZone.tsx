import { useDroppable } from "@dnd-kit/core";
import type { CSSProperties, ReactNode } from "react";

import type { WindowDropData } from "./dragTypes";
import styles from "@/features/tabs/styles/views.module.less";

interface DroppableZoneProps {
  id: string;
  data: WindowDropData;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function DroppableZone({ id, data, className, style, children }: DroppableZoneProps) {
  const { isOver, setNodeRef } = useDroppable({ id, data });

  return (
    <div
      ref={setNodeRef}
      className={`${className ?? ""}${isOver ? ` ${styles["is-drag-over"]}` : ""}`}
      style={style}
    >
      {children}
    </div>
  );
}
