/**
 * InsightsView —— 统一洞察面板 (v2.0 重构版)
 *
 * 模块结构：
 *   - utils/        纯函数（format/event-labels/memory-estimate）
 *   - hooks/        状态管理（useAnalyticsData/useInsightsSource/use-storage-quota/use-smart-suggestions）
 *   - components/   展示组件（Header/AnalyticsPanel/LineChart/BarList 等）
 *
 * 三个子 Tab：
 *   ① 数据分析：每日打开次数折线图 / Top 10 域名 / Top 5 操作 / 归档统计 / 存储占用 / 智能建议
 *   ② 使用频率：按最近 7 天激活次数排序的标签列表
 *   ③ 智能整理：重复标签检测 + 闲置标签休眠
 */

import { useCallback, useState } from "react";
import { Flex, Typography, Button } from "antd";
import { ErrorBoundary } from "@/shared/ui/ErrorBoundary";
import { useT } from "@/shared/i18n";
import { feedback } from "@/shared/ui/feedback";
import { clearMetrics, saveStats } from "@/repositories";
import { useStorageQuota } from "./hooks/use-storage-quota";
import { useSmartSuggestions } from "./hooks/use-smart-suggestions";
import { useAnalyticsData, type InsightsTimeRange } from "./hooks/use-analytics-data";
import { useInsightsSource } from "./hooks/use-insights-source";
import { FrequencyView } from "@/features/tabs/views/FrequencyView";
import { TidySuggestionBar } from "@/features/tabs/components/TidySuggestionBar";
import { navigateToTabsWithDomainFilter } from "@/shared/utils/insights-filter";
import { InsightsHeader, type InsightsSubView } from "./components/InsightsHeader";
import { AnalyticsPanel } from "./components/AnalyticsPanel";
import { InsightsFooter } from "./components/InsightsFooter";
import styles from "./insights.module.less";

export type { InsightsTimeRange };

interface Props {
  onOpenArchive?: () => void;
  onOpenSettings?: () => void;
}

export default function InsightsView({ onOpenArchive, onOpenSettings }: Props) {
  const { t } = useT();
  const { metrics, stats, loading, reload } = useInsightsSource();
  const { info: quotaInfo, loading: quotaLoading } = useStorageQuota(true);

  const [timeRange, setTimeRange] = useState<InsightsTimeRange>(7);
  const [subView, setSubView] = useState<InsightsSubView>("analytics");

  const data = useAnalyticsData(metrics, stats, timeRange);

  const handleDomainClick = useCallback((host: string) => {
    navigateToTabsWithDomainFilter(host);
  }, []);

  const suggestions = useSmartSuggestions({
    quota: quotaInfo,
    archiveTabCount: data.archiveStats.totalTabs,
    topDomainCount: data.topDomains.length,
    dailyOpens: data.dailyOpens.map((d) => d.count),
    onOpenArchive,
    onOpenSettings,
  });

  const isAllEmpty =
    !loading && metrics.length === 0 && (stats?.daily?.length ?? 0) === 0;

  /** 导出洞察数据为 JSON */
  const handleExport = useCallback(() => {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        metrics,
        stats,
        topDomains: data.topDomains,
        topActions: data.topActions,
        archiveStats: data.archiveStats,
        dailyOpens: data.dailyOpens,
        storageQuota: quotaInfo,
      };
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `insights-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      feedback.success(t("导出成功"));
    } catch (err) {
      console.warn("[insights] export failed", err);
      feedback.error(t("导出失败"));
    }
  }, [metrics, stats, data, quotaInfo, t]);

  /** 清除本地统计 */
  const handleClearAll = useCallback(async () => {
    try {
      await clearMetrics();
      await saveStats({ daily: [], lastFlushAt: Date.now() });
      reload();
      feedback.success(t("已清除所有本地统计"));
    } catch (err) {
      console.warn("[insights] clear failed", err);
      feedback.error(t("清除失败，请重试"));
    }
  }, [reload, t]);

  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <Flex vertical align="center" gap={8} className="insights-error">
          <Typography.Text type="danger">{t("洞察数据加载失败")}</Typography.Text>
          <Typography.Text type="secondary">{error.message}</Typography.Text>
          <Button onClick={reset}>
            {t("重试")}
          </Button>
        </Flex>
      )}
    >
      <div className="insights-viewport">
        <Flex vertical className={styles["insights-panel"]}>
          <InsightsHeader value={subView} onChange={setSubView} />

          {subView === "analytics" && (
            <AnalyticsPanel
              loading={loading}
              isAllEmpty={isAllEmpty}
              data={data}
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
              quota={quotaInfo}
              quotaLoading={quotaLoading}
              suggestions={suggestions}
              onDomainClick={handleDomainClick}
            />
          )}

          {subView === "frequency" && <FrequencyView />}

          {subView === "tidy" && (
            <Flex vertical gap={12}>
              <TidySuggestionBar expandSignal={1} />
            </Flex>
          )}

          {subView === "analytics" && (
            <InsightsFooter
              onExport={handleExport}
              onClear={() => void handleClearAll()}
              disabled={loading || isAllEmpty}
            />
          )}
        </Flex>
      </div>
    </ErrorBoundary>
  );
}
