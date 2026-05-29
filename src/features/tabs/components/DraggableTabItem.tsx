/**
 * DraggableTabItem — 可拖拽的标签项
 *
 * 基于 @dnd-kit/core 的 useDraggable，包装 TabItem 提供拖拽能力
 * 与 WindowView 的 DraggableTab 对齐，但适配 DomainGroupView/TabGroupView 的使用方式
 */

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { LiveTab } from "@shared/types";
import { TabItem } from "./TabItem";
import styles from "../styles/items.module.less";

interface DraggableTabItemProps {
  tab: LiveTab;
  visibleTabIds: number[];
  onJump: (tabId: number, windowId: number) => void;
  onClose: (tabId: number) => void;
  showHostname?: boolean;
  hideFavicon?: boolean;
  showUrlHint?: boolean;
  selectable?: boolean;
}

/** 拖拽数据类型 */
export interface TabDragData {
  kind: "tab";
  tab: LiveTab;
}

export function DraggableTabItem({
  tab,
  visibleTabIds,
  onJump,
  onClose,
  showHostname = false,
  hideFavicon = false,
  showUrlHint = false,
  selectable = false,
}: DraggableTabItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `tab:${tab.id}`,
    data: { kind: "tab", tab } satisfies TabDragData,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? "grabbing" : "grab",
  };

  return (
    <div
      ref={setNodeRef}
      className={styles["app-draggable-tab-wrapper"]}
      style={style}
      {...attributes}
      {...listeners}
    >
      <TabItem
        tab={tab}
        onJump={onJump}
        onClose={onClose}
        showHostname={showHostname}
        hideFavicon={hideFavicon}
        showUrlHint={showUrlHint}
        selectable={selectable}
        visibleTabIds={visibleTabIds}
      />
    </div>
  );
}
