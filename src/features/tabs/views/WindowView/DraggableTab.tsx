import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Tag } from "antd";

import type { LiveTab } from "@/shared/types";
import { TabItem } from "@/features/tabs/components/TabItem";
import type { WindowDragData } from "./dragTypes";
import styles from "@/features/tabs/styles/views.module.less";

interface DraggableTabProps {
  tab: LiveTab;
  visibleTabIds: number[];
  onJump: (tabId: number, windowId: number) => void;
  onClose: (tabId: number) => void;
  showIdleTime?: boolean;
}

/** 计算闲置时长标签 */
function getIdleTag(tab: LiveTab): React.ReactNode {
  const now = Date.now();
  const idleMs = now - tab.lastAccessed;
  const idleHours = idleMs / 3600000;

  if (idleHours < 1) return null; // <1h 不显示

  let label: string;
  let color: string;

  if (idleHours < 24) {
    const hours = Math.floor(idleHours);
    label = `${hours}h`;
    color = "default"; // 灰色
  } else if (idleHours < 72) {
    const days = Math.floor(idleHours / 24);
    label = `${days}d`;
    color = "warning"; // 黄色
  } else {
    const days = Math.floor(idleHours / 24);
    label = `${days}d`;
    color = "error"; // 红色
  }

  return (
    <Tag color={color} className={styles["app-window-tab-idle"]}>
      {label}
    </Tag>
  );
}

export function DraggableTab({
  tab,
  visibleTabIds,
  onJump,
  onClose,
  showIdleTime = false,
}: DraggableTabProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `window-tab:${tab.id}`,
    data: { kind: "tab", tab } satisfies WindowDragData,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.45 : 1,
    cursor: isDragging ? "grabbing" : "grab",
  };

  return (
    <div
      ref={setNodeRef}
      className={styles["app-window-draggable-tab"]}
      style={style}
      {...attributes}
      {...listeners}
    >
      <TabItem
        tab={tab}
        onJump={onJump}
        onClose={onClose}
        showHostname
        selectable
        visibleTabIds={visibleTabIds}
        trailing={showIdleTime ? getIdleTag(tab) : undefined}
      />
    </div>
  );
}
