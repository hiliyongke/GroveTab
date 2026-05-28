/**
 * TabGroupToolbar — 标签分组视图工具栏
 *
 * 常驻显示在标签分组视图上方：
 *   - 搜索过滤（按组名/标签标题/URL）
 *   - 排序切换（名称/数量/最近访问）
 *   - 全部折叠/展开开关
 */

import { Input, Flex, Segmented, Switch, Tooltip } from "antd";
import { Search, ArrowDownAZ, Hash, Clock } from "lucide-react";
import { useSettingsStore } from "@/store";
import { useT } from "@/shared/i18n";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import styles from "./styles/items.module.less";

export interface TabGroupToolbarProps {
  filterQuery: string;
  onFilterChange: (query: string) => void;
  collapseAll: boolean;
  onCollapseAllChange: (collapsed: boolean) => void;
}

export function TabGroupToolbar({
  filterQuery,
  onFilterChange,
  collapseAll,
  onCollapseAllChange,
}: TabGroupToolbarProps) {
  const { t } = useT();
  const sortBy = useSettingsStore((s) => s.settings.tabGroupSortBy ?? "tabCount");
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  return (
    <Flex align="center" gap={8} className={styles["app-domain-toolbar"]}>
      <Input
        prefix={<Search size={ICON_SIZE.SMALL} />}
        placeholder={t("tabGroup.searchPlaceholder")}
        value={filterQuery}
        onChange={(e) => onFilterChange(e.target.value)}
        allowClear
        className={styles["app-toolbar-search-input"]}
      />
      <Flex align="center" gap={4} className={styles["app-domain-toolbar-controls"]}>
        <Tooltip title={t("tabGroup.sortBy")}>
          <Segmented
            size="small"
            value={sortBy}
            onChange={(v) =>
              void updateSettings({ tabGroupSortBy: v as "tabCount" | "name" | "recentAccess" })
            }
            options={[
              {
                value: "name",
                icon: (
                  <span className={styles["app-segmented-icon"]}>
                    <ArrowDownAZ size={13} />
                  </span>
                ),
              },
              {
                value: "tabCount",
                icon: (
                  <span className={styles["app-segmented-icon"]}>
                    <Hash size={13} />
                  </span>
                ),
              },
              {
                value: "recentAccess",
                icon: (
                  <span className={styles["app-segmented-icon"]}>
                    <Clock size={13} />
                  </span>
                ),
              },
            ]}
          />
        </Tooltip>
        <Tooltip title={collapseAll ? t("tabGroup.expandAll") : t("tabGroup.collapseAll")}>
          <Switch size="small" checked={collapseAll} onChange={onCollapseAllChange} />
        </Tooltip>
      </Flex>
    </Flex>
  );
}
