/**
 * WindowToolbar — 窗口视图快捷工具栏
 *
 * 常驻显示在 WindowView 上方：
 *   - 折叠策略切换（仅当前展开/全部展开/全部折叠）
 */

import { Flex, Segmented, Tooltip } from "antd";
import { Eye, EyeOff, Maximize2 } from "lucide-react";
import { useSettingsStore } from "@/store";
import { useT } from "@/shared/i18n";
import styles from "./styles/items.module.less";

type WindowCardDefaultCollapsed = "current-only" | "all-expanded" | "all-collapsed";

export function WindowToolbar() {
  const { t } = useT();
  const defaultCollapsed = useSettingsStore(
    (s) => s.settings.windowCardDefaultCollapsed ?? "current-only",
  );
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const normalize = (v: unknown): WindowCardDefaultCollapsed =>
    v === "all-expanded" || v === "all-collapsed" || v === "current-only"
      ? v
      : "current-only";

  return (
    <Flex align="center" gap={8} className={styles["app-domain-toolbar"]}>
      <Flex align="center" gap={4} className={styles["app-domain-toolbar-controls"]}>
        <Tooltip title={t("toolbar.collapseStrategy.title")}>
          <Segmented
            size="small"
            value={normalize(defaultCollapsed)}
            onChange={(v) =>
              void updateSettings({ windowCardDefaultCollapsed: v as WindowCardDefaultCollapsed })
            }
            options={[
              {
                value: "current-only",
                icon: (
                  <span className={styles["app-segmented-icon"]}>
                    <Maximize2 size={13} />
                  </span>
                ),
                label: t("toolbar.collapseStrategy.currentOnly"),
              },
              {
                value: "all-expanded",
                icon: (
                  <span className={styles["app-segmented-icon"]}>
                    <Eye size={13} />
                  </span>
                ),
                label: t("toolbar.collapseStrategy.allExpanded"),
              },
              {
                value: "all-collapsed",
                icon: (
                  <span className={styles["app-segmented-icon"]}>
                    <EyeOff size={13} />
                  </span>
                ),
                label: t("toolbar.collapseStrategy.allCollapsed"),
              },
            ]}
          />
        </Tooltip>
      </Flex>
    </Flex>
  );
}
