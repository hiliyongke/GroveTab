import { useMemo } from "react";
import { Button } from "antd";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import { VIEW_CONFIGS, type ViewMode } from "@/shared/config/views";

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
  const { t } = useT();

  /** 视图侧边栏导航项，缓存以避免每次渲染重建 JSX */
  const viewSidebarItems = useMemo(
    () =>
      VIEW_CONFIGS.map((v) => ({
        id: v.id,
        Icon: v.Icon,
        label: t(v.labelKey),
      })),
    [t],
  );

  return (
    <nav className={`app-view-sidebar app-view-sidebar--${position}`}>
      <div className="app-view-sidebar__list">
        {viewSidebarItems.map((v) => {
          const isActive = viewMode === v.id;
          return (
            <Button
              key={v.id}
              type="text"
              className={`app-view-sidebar__item${isActive ? " is-active" : ""}`}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onViewChange(v.id)}
              title={v.label}
            >
              <v.Icon size={ICON_SIZE.MEDIUM} />
              <span className="app-view-sidebar__label">{v.label}</span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
