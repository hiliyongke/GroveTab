/**
 * TabsToolbar — 标签页视图统一工具栏
 *
 * 常驻显示在所有标签页布局（masonry/compact/grid）上方：
 *   - 搜索过滤（按标题/URL/域名）
 *   - 布局模式切换（masonry/compact/grid）
 *   - 卡片密度切换（S/M/L）
 */

import { Input, Flex, Segmented, Tooltip } from "antd";
import { Search, LayoutGrid, List, Grip } from "lucide-react";
import { useSettingsStore } from "@/store";
import { useT } from "@/shared/i18n";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import styles from "./styles/items.module.less";

export interface TabsToolbarProps {
  filterQuery: string;
  onFilterChange: (query: string) => void;
}

export function TabsToolbar({ filterQuery, onFilterChange }: TabsToolbarProps) {
  const { t } = useT();
  const tabsLayout = useSettingsStore((s) => s.settings.tabsLayout ?? "masonry");
  const layoutDensity = useSettingsStore((s) => s.settings.layoutDensity ?? "default");
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  return (
    <Flex align="center" gap={8} className={styles["app-domain-toolbar"]}>
      <Input
        prefix={<Search size={ICON_SIZE.SMALL} />}
        placeholder={t("search.domainFilter")}
        value={filterQuery}
        onChange={(e) => onFilterChange(e.target.value)}
        allowClear
        style={{ maxWidth: 400, flex: "1 1 auto" }}
      />
      <Flex align="center" gap={4} className={styles["app-domain-toolbar-controls"]}>
        <Tooltip title={t("headerLayout.title")}>
          <Segmented
            size="small"
            value={tabsLayout}
            onChange={(v) => void updateSettings({ tabsLayout: v as "masonry" | "compact" | "grid" })}
            options={[
              { value: "masonry", icon: <span className={styles["app-segmented-icon"]}><LayoutGrid size={13} /></span> },
              { value: "compact", icon: <span className={styles["app-segmented-icon"]}><List size={13} /></span> },
              { value: "grid", icon: <span className={styles["app-segmented-icon"]}><Grip size={13} /></span> },
            ]}
          />
        </Tooltip>
        <Tooltip title={t("headerDensity.title")}>
          <Segmented
            size="small"
            value={layoutDensity}
            onChange={(v) => void updateSettings({ layoutDensity: v as "compact" | "default" | "comfortable" })}
            options={[
              { value: "compact", label: "S" },
              { value: "default", label: "M" },
              { value: "comfortable", label: "L" },
            ]}
          />
        </Tooltip>
      </Flex>
    </Flex>
  );
}
