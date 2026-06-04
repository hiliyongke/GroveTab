/**
 * ViewTabs — 统一视图切换组件
 *
 * antd Tabs，left / top / right 三位置：
 *   - top：横排图标+文案
 *   - left/right：竖排图标+文案，底部折叠按钮
 */

import { useState, useMemo, useCallback, memo } from "react";
import { Tabs, Tooltip } from "antd";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { VIEW_CONFIGS, type ViewMode, type ViewConfig } from "@/shared/config/views";
import { useT } from "@/shared/i18n";
import { useSettingsStore } from "@/store";
import { ICON_SIZE } from "@/shared/utils/icon-size";

export type ViewTabPosition = "left" | "top" | "right";

interface ViewTabsProps {
  activeView: ViewMode;
  onChange: (view: ViewMode) => void;
}

function useViewTabItems(): Array<ViewConfig & { label: string }> {
  const { t } = useT();
  return useMemo(
    () =>
      VIEW_CONFIGS.filter((v) => v.id !== "archive").map((v) => ({
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
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <item.Icon size={15} />
              <span style={{ fontSize: 13 }}>{item.label}</span>
            </span>
          ),
        }))}
      />
    );
  }

  // vertical: Tabs 自适应最宽标签宽度；按钮固定底部
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Tabs
        tabPosition={position}
        activeKey={activeView}
        onChange={(key) => onChange(key as ViewMode)}
        size="small"
        style={{ flex: 1, minHeight: 0, alignItems: "center" }}
        tabBarStyle={collapsed ? { width: 52, minWidth: 52 } : undefined}
        items={items.map((item) => ({
          key: item.id,
          label: collapsed ? (
            <Tooltip title={item.label} placement={position === "left" ? "right" : "left"}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "100%", height: 24 }}>
                <item.Icon size={18} />
              </span>
            </Tooltip>
          ) : (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, width: "100%" }}>
              <item.Icon size={16} />
              <span style={{ fontSize: 13, flex: 1 }}>{item.label}</span>
            </span>
          ),
        }))}
      />
      {/* eslint-disable-next-line no-restricted-syntax */}
      <button
        type="button"
        onClick={toggleCollapsed}
        title={collapsed ? "展开文案" : "收起文案"}
        aria-label={collapsed ? "展开文案" : "收起文案"}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: 36,
          padding: 0,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: "var(--ant-color-text-tertiary)",
        }}
      >
        {position === "left"
          ? (collapsed ? <PanelLeftOpen size={ICON_SIZE.SMALL} /> : <PanelLeftClose size={ICON_SIZE.SMALL} />)
          : (collapsed ? <PanelRightOpen size={ICON_SIZE.SMALL} /> : <PanelRightClose size={ICON_SIZE.SMALL} />)}
      </button>
    </div>
  );
});
