import { Space } from "antd";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import type { LiveTab } from "@/shared/types";
import { TabItem } from "../TabItem";
import type { WindowDragData } from "./dragTypes";

interface DraggableTabProps {
  tab: LiveTab;
  visibleTabIds: number[];
  onJump: (tabId: number, windowId: number) => void;
  onClose: (tabId: number) => void;
}

export function DraggableTab({ tab, visibleTabIds, onJump, onClose }: DraggableTabProps) {
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
    <Space ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TabItem
        tab={tab}
        onJump={onJump}
        onClose={onClose}
        showHostname
        selectable
        visibleTabIds={visibleTabIds}
      />
    </Space>
  );
}
