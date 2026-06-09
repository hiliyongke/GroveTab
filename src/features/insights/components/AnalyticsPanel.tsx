/**
 * AnalyticsPanel — 数据分析子视图
 *
 * 所有卡片流式等宽排列（md=6，4 列均分），自动换行。
 */
import { Card, Col, Flex, Row, Skeleton, Typography, theme } from "antd";
import { useT } from "@/shared/i18n";
import { BarChart3 } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { FeatureEmptyState } from "@/shared/ui/FeatureEmptyState";
import { useEventLabel } from "../utils/event-labels";
import { InsightsBarList } from "./InsightsBarList";
import type { StorageQuotaInfo } from "@/shared/utils/opfs-storage";
import type { SmartSuggestion } from "../hooks/use-smart-suggestions";
import type {
  AnalyticsData,
  InsightsTimeRange,
} from "../hooks/use-analytics-data";
import { DailyOpensCard } from "./DailyOpensCard";
import { StorageQuotaCard } from "./StorageQuotaCard";
import { SuggestionList } from "./SuggestionList";
import styles from "../insights.module.less";

interface Props {
  loading: boolean;
  isAllEmpty: boolean;
  data: AnalyticsData;
  timeRange: InsightsTimeRange;
  onTimeRangeChange: (r: InsightsTimeRange) => void;
  quota: StorageQuotaInfo | null;
  quotaLoading: boolean;
  suggestions: SmartSuggestion[];
  onDomainClick: (host: string) => void;
}

function EmptyText({ text }: { text: string }) {
  return (
    <Flex align="center" justify="center" className="insights-stat-empty">
      <Typography.Text type="secondary">{text}</Typography.Text>
    </Flex>
  );
}

export function AnalyticsPanel(props: Props) {
  const { t } = useT();
  const { token } = theme.useToken();
  const getEventLabel = useEventLabel();
  const {
    loading,
    isAllEmpty,
    data,
    timeRange,
    onTimeRangeChange,
    quota,
    quotaLoading,
    suggestions,
    onDomainClick,
  } = props;

  if (loading) {
    return (
      <Flex vertical className="insights-loading">
        <Skeleton active paragraph={{ rows: 6 }} />
      </Flex>
    );
  }

  if (isAllEmpty) {
    return (
      <FeatureEmptyState
        title={t("暂无数据")}
        icon={<BarChart3 size={ICON_SIZE.LARGE} />}
        hints={[t("继续使用扩展以生成洞察数据"), t("所有数据均在本地计算，不会上传")]}
      />
    );
  }

  return (
    <Flex vertical gap={12} className="insights-analytics-panel">
      <Row gutter={[12, 12]}>
        {/* ① 每日打开次数 — 折线图 */}
        <Col xs={24} md={12} lg={6}>
          <DailyOpensCard
            data={data.dailyOpens}
            timeRange={timeRange}
            onTimeRangeChange={onTimeRangeChange}
            allZero={data.dailyAllZero}
          />
        </Col>

        {/* ② Top 10 访问域名 — 条形列表 */}
        <Col xs={24} md={12} lg={6}>
          <Card title={t("Top 10 访问域名")} className={styles["insights-stat-card"]}>
            {data.topDomains.length === 0 ? (
              <EmptyText text={t("暂无数据")} />
            ) : (
              <InsightsBarList
                items={data.topDomains.map((d) => ({ label: d.host, value: d.count }))}
                color={token.colorPrimary}
                onClick={onDomainClick}
              />
            )}
          </Card>
        </Col>

        {/* ③ 使用频率前 5 — 条形列表 */}
        <Col xs={24} md={12} lg={6}>
          <Card title={t("使用频率前 5")} className={styles["insights-stat-card"]}>
            {data.topActions.length === 0 ? (
              <EmptyText text={t("暂无数据")} />
            ) : (
              <InsightsBarList
                items={data.topActions.map((a) => ({ label: a.event, value: a.count }))}
                color={token.colorPrimary}
                renderLabel={getEventLabel}
              />
            )}
          </Card>
        </Col>

        {/* ④ 累计归档 — 数字 */}
        <Col xs={24} md={12} lg={6}>
          <Card title={t("累计归档")} className={styles["insights-stat-card"]}>
            {data.archiveStats.totalTabs === 0 ? (
              <EmptyText text={t("尚未归档")} />
            ) : (
              <Flex vertical align="center" gap={4} className="insights-archive-stat">
                <Typography.Text className="insights-archive-stat__value">
                  {data.archiveStats.totalTabs}
                </Typography.Text>
                <Typography.Text type="secondary">
                  {t("约节省 {mb} MB 内存", { mb: data.archiveStats.savedMemMB })}
                </Typography.Text>
              </Flex>
            )}
          </Card>
        </Col>
      </Row>

      <StorageQuotaCard info={quota} loading={quotaLoading} />
      <SuggestionList suggestions={suggestions} />
    </Flex>
  );
}
