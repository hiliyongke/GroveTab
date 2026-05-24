import { type ViewMode } from "@/shared/config/views";
import { ViewDock } from "./ViewDock";

/**
 * ViewBottomBar —— 视图切换底部导航（bottom 模式）
 *
 * 设计要点：
 *   - 保持在布局底部的稳定位置，而非独立漂浮控件
 *   - 使用轻量磨砂与分隔线，延续桌面软件常见的底栏语言
 *   - 标签数量有限（≤ 6），水平排列、横向居中、不滚动
 *   - 在小屏下文字会自动隐藏，仅显示图标（由 CSS 控制）
 */
export function ViewBottomBar({
  viewMode,
  onViewChange,
}: {
  viewMode: ViewMode;
  onViewChange: (v: ViewMode) => void;
}) {
  return (
    <ViewDock
      viewMode={viewMode}
      onViewChange={onViewChange}
      orientation="horizontal"
      placement="bottom"
    />
  );
}
