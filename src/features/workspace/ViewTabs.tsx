/**
 * ViewTabs — 统一视图切换组件
 *
 * antd Tabs，left / right 垂直侧栏：
 *   - 竖排图标+文案，底部折叠按钮
 */

import { useMemo, useCallback, memo } from "react";
import { Tabs, Tooltip, Button } from "antd";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { VIEW_CONFIGS, type ViewMode, type ViewConfig } from "@/shared/config/views";
import { useT } from "@/shared/i18n";
import { useSettingsStore } from "@/store";
import { useFeatureFlagStore } from "@/shared/store/feature-flag-slice";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { IconRenderer } from "@/shared/ui/IconRenderer";
import styles from "./ViewTabs.module.less";

export type ViewTabPosition = "left" | "right";

interface ViewTabsProps {
  activeView: ViewMode;
  onChange: (view: ViewMode) => void;
}

function useViewTabItems(): Array<ViewConfig & { label: string }> {
  const { t } = useT();
  const archiveTrashMerged = useFeatureFlagStore((s) => s.isEnabled("archive_trash_merged"));
  const historyTabVisible = useSettingsStore((s) => s.settings.historyTabVisible === true);
  const rawOrder = useSettingsStore((s) => s.settings.tabBarOrder);
  const rawHidden = useSettingsStore((s) => s.settings.hiddenTabBarViews);
  // useMemo 稳定化 [] 默认值，避免每次 store 更新生成新引用
  const tabBarOrder = useMemo(() => rawOrder ?? [], [rawOrder]);
  const hiddenTabBarViews = useMemo(() => rawHidden ?? [], [rawHidden]);
  return useMemo(
    () => {
      const filtered = VIEW_CONFIGS.filter((v) => {
        // 用户自定义隐藏（P2-03）
        if (hiddenTabBarViews.includes(v.id)) return false;
        if (v.primary === false) {
          if (v.id === "history" && historyTabVisible) return true;
          return false;
        }
        if (archiveTrashMerged && (v.id === "archive" || v.id === "trash")) return false;
        return true;
      }).map((v) => ({ ...v, label: t(v.labelKey) }));

      // P2-03: 用户自定义排序
      if (tabBarOrder.length > 0) {
        const orderMap = new Map(tabBarOrder.map((id, i) => [id, i]));
        filtered.sort((a, b) => (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99));
      }

      return filtered;
    },
    [t, archiveTrashMerged, historyTabVisible, tabBarOrder, hiddenTabBarViews],
  );
}

export const ViewTabs = memo(function ViewTabs({ activeView, onChange }: ViewTabsProps) {
  const { t } = useT();
  const items = useViewTabItems();
  const position = useSettingsStore(
    (s) => (s.settings.viewTabPosition ?? "right") as ViewTabPosition,
  );
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const collapsed = useSettingsStore((s) => s.settings.viewTabCollapsed ?? false);
  const toggleCollapsed = useCallback(
    () => void updateSettings({ viewTabCollapsed: !collapsed }),
    [collapsed, updateSettings],
  );

  // 垂直侧栏 Tabs 自适应最宽标签宽度；按钮固定底部
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
        aria-label={collapsed ? t("展开文案") : t("收起文案")}
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
