/**
 * DailyOpensCard — 每日打开次数卡片
 *
 * 包含时间范围切换（7d / 14d / 30d）+ 折线图 + 空态
 */

import { useMemo } from "react";
import { Card, Segmented, Flex, Typography, theme } from "antd";
import { useT } from "@/shared/i18n";
import { FeatureEmptyState } from "@/shared/ui/FeatureEmptyState";
import { BarChart3 } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import type { InsightsTimeRange } from "../hooks/use-analytics-data";
import { InsightsLineChart } from "./InsightsLineChart";
import styles from "../insights.module.less";

interface Props {
  data: Array<{ day: string; count: number }>;
  timeRange: InsightsTimeRange;
  onTimeRangeChange: (r: InsightsTimeRange) => void;
  allZero: boolean;
}

export function DailyOpensCard({ data, timeRange, onTimeRangeChange, allZero }: Props) {
  const { t } = useT();
  const { token } = theme.useToken();

  const labels = useMemo(() => data.map((d) => d.day.slice(5)), [data]);
  const counts = useMemo(() => data.map((d) => d.count), [data]);

  return (
    <Card
      className={styles["insights-stat-card"]}
      title={
        <Flex justify="space-between" align="center">
          <Typography.Text>{t("每日打开次数")}</Typography.Text>
          <Segmented
            value={timeRange}
            onChange={(v) => onTimeRangeChange(v as InsightsTimeRange)}
            options={[
              { label: "7d", value: 7 },
              { label: "14d", value: 14 },
              { label: "30d", value: 30 },
            ]}
          />
        </Flex>
      }
    >
      {allZero ? (
        <FeatureEmptyState
          title={t("近 {n} 天暂无打开记录", { n: timeRange })}
          icon={<BarChart3 size={ICON_SIZE.LARGE} />}
          hints={[t("继续使用扩展以生成洞察数据")]}
        />
      ) : (
        <InsightsLineChart
          data={counts}
          labels={labels}
          color={token.colorPrimary}
        />
      )}
    </Card>
  );
}
