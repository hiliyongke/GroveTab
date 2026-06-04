/**
 * TabGroupToolbar — 标签分组视图工具栏
 *
 * 常驻显示在标签分组视图上方：
 *   - 搜索过滤（按组名/标签标题/URL）
 *   - 排序切换（名称/数量/最近访问）
 */

import { Segmented, Tooltip } from "antd";
import { ArrowDownAZ, Hash, Clock } from "lucide-react";
import { useSettingsStore } from "@/store";
import { useT } from "@/shared/i18n";
import { ViewToolbar } from "./ViewToolbar";
import styles from "../styles/items.module.less";

export interface TabGroupToolbarProps {
  filterQuery: string;
  onFilterChange: (query: string) => void;
}

export function TabGroupToolbar({
  filterQuery,
  onFilterChange,
}: TabGroupToolbarProps) {
  const { t } = useT();
  const sortBy = useSettingsStore((s) => s.settings.tabGroupSortBy ?? "tabCount");
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  return (
    <ViewToolbar
      searchQuery={filterQuery}
      onSearchChange={onFilterChange}
      searchPlaceholder={t("tabGroup.searchPlaceholder")}
      controls={
        <>
          <Tooltip title={t("tabGroup.sortBy")}>
            <span>
              <Segmented
                size="small"
                value={sortBy}
                onChange={(v) =>
                  void updateSettings({
                    tabGroupSortBy: v as "tabCount" | "name" | "recentAccess",
                  })
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
            </span>
          </Tooltip>
        </>
      }
    />
  );
}
