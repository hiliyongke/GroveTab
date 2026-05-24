import { useMemo } from "react";
import { Button } from "antd";

import { VIEW_CONFIGS, type ViewMode } from "@/shared/config/views";
import { useT } from "@/shared/i18n";
import { ICON_SIZE } from "@/shared/utils/icon-size";

interface ViewDockProps {
  viewMode: ViewMode;
  onViewChange: (view: ViewMode) => void;
  orientation: "horizontal" | "vertical";
  placement: "left" | "right" | "bottom";
}

/**
 * ViewDock —— 工作区视图切换导航
 *
 * 设计原则：
 *   - 保持固定结构中的单选导航语义，避免漂浮控件感
 *   - left/right/bottom 共用一套状态与交互样式，保证一致性
 *   - 使用更明确的 tab 语义，便于辅助技术理解当前视图
 */
export function ViewDock({ viewMode, onViewChange, orientation, placement }: ViewDockProps) {
  const { t } = useT();

  const items = useMemo(
    () =>
      VIEW_CONFIGS.map((view) => ({
        id: view.id,
        Icon: view.Icon,
        label: t(view.labelKey),
      })),
    [t],
  );

  return (
    <nav
      className={`app-view-dock app-view-dock--${placement} app-view-dock--${orientation}`}
      aria-label="View switcher"
    >
      <div className="app-view-dock__list" role="tablist" aria-orientation={orientation}>
        {items.map((item) => {
          const isActive = viewMode === item.id;
          return (
            <Button
              key={item.id}
              type="text"
              role="tab"
              className={`app-view-dock__item${isActive ? " is-active" : ""}`}
              aria-selected={isActive}
              onClick={() => onViewChange(item.id)}
              title={item.label}
            >
              <item.Icon size={ICON_SIZE.MEDIUM} />
              <span className="app-view-dock__label">{item.label}</span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
