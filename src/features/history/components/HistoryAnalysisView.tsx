/**
 * HistoryAnalysisView — 历史分析视图，渲染轻量 SVG 条形图和热力网格。
 */

import { Button, Empty, Flex, Select, Spin, Tooltip, Typography } from "antd";
import { BarChart2, Clock, Download, Globe } from "lucide-react";
import type { HistoryAnalysis } from "@/repositories";
import type { CSSProperties, ReactNode } from "react";

interface HistoryAnalysisViewProps {
  analysis: HistoryAnalysis | null;
  loading: boolean;
  rangeMs: number;
  onRangeChange: (v: number) => void;
  onExport: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  styles: Record<string, string>;
}

const RANGE_OPTIONS = [
  { value: 1 * 24 * 3600 * 1000, label: "今天" },
  { value: 7 * 24 * 3600 * 1000, label: "近 7 天" },
  { value: 14 * 24 * 3600 * 1000, label: "近 14 天" },
  { value: 30 * 24 * 3600 * 1000, label: "近 30 天" },
];

export function HistoryAnalysisView({
  analysis,
  loading,
  rangeMs,
  onRangeChange,
  onExport,
  t,
  styles,
}: HistoryAnalysisViewProps): ReactNode {
  if (loading) {
    return (
      <Flex align="center" justify="center" className={styles["history-loading-center"]}>
        <Spin size="default" />
      </Flex>
    );
  }

  if (analysis === null || analysis.totalEvents === 0) {
    return (
      <Flex vertical gap={12} className={styles["history-analysis-panel"]}>
        <Flex align="center" justify="space-between" className={styles["history-analysis-header"]}>
          <Select
            size="small"
            value={rangeMs}
            onChange={onRangeChange}
            options={RANGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            className={styles["history-date-picker"]}
          />
          <Button size="small" icon={<Download size={12} />} onClick={onExport}>
            {t("导出")}
          </Button>
        </Flex>
        <Empty description={t("暂无数据")} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Flex>
    );
  }

  const maxDayCount = Math.max(...analysis.byDay.map((d) => d.count), 1);
  const maxHourCount = Math.max(...analysis.byHour.map((h) => h.count), 1);
  const topHosts = analysis.byHost.slice(0, 10);
  const maxHostCount = topHosts[0]?.visitCount ?? 1;

  return (
    <Flex vertical gap={16} className={styles["history-analysis-panel"]}>
      {/* 顶部：范围选择 + 导出 */}
      <Flex align="center" justify="space-between" className={styles["history-analysis-header"]}>
        <Flex align="center" gap={8}>
          <Select
            size="small"
            value={rangeMs}
            onChange={onRangeChange}
            options={RANGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            className={styles["history-date-picker"]}
          />
          <Typography.Text className={styles["history-stat-text"]}>
            {t("共 {n} 条记录", { n: analysis.totalEvents })}
          </Typography.Text>
        </Flex>
        <Button size="small" icon={<Download size={12} />} onClick={onExport}>
          {t("导出 JSON")}
        </Button>
      </Flex>

      {/* 每日趋势柱状图 */}
      <Flex vertical gap={6} className={styles["history-analysis-section"]}>
        <Typography.Text className={styles["history-analysis-section-title"]}>
          <BarChart2 size={12} />
          {t("每日活动趋势（近 14 天）")}
        </Typography.Text>
        <div className={styles["history-day-chart"]}>
          {analysis.byDay.map((day) => {
            const heightPct = maxDayCount > 0 ? (day.count / maxDayCount) * 100 : 0;
            const shortLabel = day.label.slice(5); // MM-DD
            return (
              <Tooltip
                key={day.label}
                title={`${day.label}：${day.count} 条，${day.uniqueHosts} 个站点`}
              >
                <div className={styles["history-day-bar-wrap"]}>
                  <div
                    className={styles["history-day-bar"]}
                    style={{ height: `${Math.max(heightPct, 2)}%` } as CSSProperties}
                  />
                  <span className={styles["history-day-label"]}>{shortLabel}</span>
                </div>
              </Tooltip>
            );
          })}
        </div>
      </Flex>

      {/* 小时热力分布 */}
      <Flex vertical gap={6} className={styles["history-analysis-section"]}>
        <Typography.Text className={styles["history-analysis-section-title"]}>
          <Clock size={12} />
          {t("活跃时段分布（24 小时）")}
        </Typography.Text>
        <div className={styles["history-hour-grid"]}>
          {analysis.byHour.map((hour) => {
            const intensity = maxHourCount > 0 ? hour.count / maxHourCount : 0;
            const bg = `color-mix(in srgb, var(--ant-color-primary) ${Math.round(intensity * 80 + 8)}%, transparent)`;
            return (
              <Tooltip key={hour.label} title={`${hour.label}：${hour.count} 条`}>
                <div
                  className={styles["history-hour-cell"]}
                  style={{ background: bg } as CSSProperties}
                >
                  {hour.label.slice(0, 2)}
                </div>
              </Tooltip>
            );
          })}
        </div>
      </Flex>

      {/* 站点访问排行 */}
      <Flex vertical gap={6} className={styles["history-analysis-section"]}>
        <Typography.Text className={styles["history-analysis-section-title"]}>
          <Globe size={12} />
          {t("站点访问排行")}
        </Typography.Text>
        <div className={styles["history-host-list"]}>
          {topHosts.map((item, idx) => (
            <div key={item.host} className={styles["history-host-item"]}>
              <span
                className={`${styles["history-host-rank"]}${idx < 3 ? ` ${styles["history-host-rank--top"]}` : ""}`}
              >
                {idx + 1}
              </span>
              <span className={styles["history-host-name"]}>{item.host}</span>
              <div className={styles["history-host-bar-wrap"]}>
                <div
                  className={styles["history-host-bar"]}
                  style={{ width: `${(item.visitCount / maxHostCount) * 100}%` } as CSSProperties}
                />
              </div>
              <span className={styles["history-host-count"]}>{item.visitCount}</span>
            </div>
          ))}
        </div>
      </Flex>
    </Flex>
  );
}
