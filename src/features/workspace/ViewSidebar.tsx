import { type ViewMode } from "@/shared/config/views";
import { ViewDock } from "./ViewDock";

/** 视图侧边栏（left/right 模式），垂直排列视图图标 + 标签 */
export function ViewSidebar({
  viewMode,
  onViewChange,
  position,
}: {
  viewMode: ViewMode;
  onViewChange: (v: ViewMode) => void;
  position: "left" | "right";
}) {
  return (
    <ViewDock
      viewMode={viewMode}
      onViewChange={onViewChange}
      orientation="vertical"
      placement={position}
    />
  );
}
