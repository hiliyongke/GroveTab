/**
 * TimelineToolbar — 时间轴视图快捷工具栏
 *
 * 常驻显示在 TimelineView 上方：
 *   - 分组粒度切换（按天/按小时）
 *   - 显示精确时间开关
 */

import { Flex, Segmented, Switch, Tooltip, Typography } from "antd";
import { Clock, Clock3 } from "lucide-react";
import { useSettingsStore } from "@/store";
import { useT } from "@/shared/i18n";
import { ViewToolbar } from "./ViewToolbar";
import styles from "../styles/items.module.less";
import toolbarStyles from "./TimelineToolbar.module.less";

type TimelineGranularity = "day" | "hour";

export function TimelineToolbar() {
  const { t } = useT();
  const rawGranularity = useSettingsStore((s) => s.settings.timelineGranularity ?? "day");
  const granularity: TimelineGranularity = rawGranularity === "day" ? "day" : "hour";
  const showExactTime = useSettingsStore((s) => s.settings.timelineShowExactTime ?? false);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  return (
    <ViewToolbar
      controls={
        <>
          <Tooltip title={t("分组粒度")}>
            <span>
              <Segmented
                size="small"
                value={granularity}
                onChange={(v) =>
                  void updateSettings({ timelineGranularity: v as TimelineGranularity })
                }
                options={[
                  {
                    value: "day",
                    icon: (
                      <span className={styles["app-segmented-icon"]}>
                        <Clock size={13} />
                      </span>
                    ),
                    label: t("按天"),
                  },
                  {
                    value: "hour",
                    icon: (
                      <span className={styles["app-segmented-icon"]}>
                        <Clock3 size={13} />
                      </span>
                    ),
                    label: t("按小时"),
                  },
                ]}
              />
            </span>
          </Tooltip>
          <Tooltip title={t("在每个标签行末尾显示具体时间")}>
            <Flex align="center" gap={4} className={toolbarStyles["exact-time-toggle"]}>
              <Typography.Text className={toolbarStyles["exact-time-label"]}>
                {t("显示精确时间")}
              </Typography.Text>
              <Switch
                size="small"
                checked={showExactTime}
                onChange={(checked) => void updateSettings({ timelineShowExactTime: checked })}
              />
            </Flex>
          </Tooltip>
        </>
      }
    />
  );
}
