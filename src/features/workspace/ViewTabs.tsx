/**
 * ViewTabs — 统一视图切换组件
 *
 * antd Tabs，left / top / right 三位置：
 *   - top：横排图标+文案
 *   - left/right：竖排图标+文案，底部折叠按钮
 */

import { useState, useMemo, useCallback, memo } from "react";
import { Tabs, Tooltip, Button } from "antd";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { VIEW_CONFIGS, type ViewMode, type ViewConfig } from "@/shared/config/views";
import { useT } from "@/shared/i18n";
import { useSettingsStore } from "@/store";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { IconRenderer } from "@/shared/ui/IconRenderer";
import styles from "./ViewTabs.module.less";

export type ViewTabPosition = "left" | "top" | "right";

interface ViewTabsProps {
  activeView: ViewMode;
  onChange: (view: ViewMode) => void;
}

function useViewTabItems(): Array<ViewConfig & { label: string }> {
  const { t } = useT();
  return useMemo(
    () =>
      VIEW_CONFIGS.filter((v) => v.primary !== false).map((v) => ({
        ...v,
        label: t(v.labelKey),
      })),
    [t],
  );
}

export const ViewTabs = memo(function ViewTabs({ activeView, onChange }: ViewTabsProps) {
  const items = useViewTabItems();
  const position = useSettingsStore(
    (s) => (s.settings.viewTabPosition ?? "top") as ViewTabPosition,
  );
  const isVertical = position !== "top";
  const [collapsed, setCollapsed] = useState(false);
  const toggleCollapsed = useCallback(() => setCollapsed((p) => !p), []);

  if (!isVertical) {
    return (
      <Tabs
        tabPosition="top"
        activeKey={activeView}
        onChange={(key) => onChange(key as ViewMode)}
        size="small"
        items={items.map((item) => ({
          key: item.id,
          label: (
            <span className={styles["view-tab-label"]}>
              <IconRenderer name={item.iconName} size={15} />
              <span className={styles["view-tab-label__text"]}>{item.label}</span>
            </span>
          ),
        }))}
      />
    );
  }

  // vertical: Tabs 自适应最宽标签宽度；按钮固定底部
  return (
    <div className={styles["view-tabs-vertical"]}>
      <Tabs
        tabPosition={position}
        activeKey={activeView}
        onChange={(key) => onChange(key as ViewMode)}
        size="small"
        className={styles["view-tabs-vertical__tabs"]}
        tabBarStyle={collapsed ? { width: 52, minWidth: 52 } : undefined}
        items={items.map((item) => ({
          key: item.id,
          label: collapsed ? (
            <Tooltip title={item.label} placement={position === "left" ? "right" : "left"}>
              <span className={styles["view-tab-label--collapsed"]}>
                <IconRenderer name={item.iconName} size={18} />
              </span>
            </Tooltip>
          ) : (
            <span className={styles["view-tab-label--vertical"]}>
              <IconRenderer name={item.iconName} size={16} />
              <span className={styles["view-tab-label__text"]}>{item.label}</span>
            </span>
          ),
        }))}
      />
      <Button
        type="text"
        size="small"
        onClick={toggleCollapsed}
        aria-label={collapsed ? "展开文案" : "收起文案"}
        className={styles["view-tabs-collapse-btn"]}
        icon={
          position === "left"
            ? (collapsed ? <PanelLeftOpen size={ICON_SIZE.SMALL} /> : <PanelLeftClose size={ICON_SIZE.SMALL} />)
            : (collapsed ? <PanelRightOpen size={ICON_SIZE.SMALL} /> : <PanelRightClose size={ICON_SIZE.SMALL} />)
        }
      />
    </div>
  );
});
