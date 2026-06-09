/**
 * StatCards — 三个统计卡片（域名 / 操作 / 归档）
 */

import { Card, Flex, Typography, theme } from "antd";
import { useT } from "@/shared/i18n";
import { useEventLabel } from "../utils/event-labels";
import { InsightsBarList } from "./InsightsBarList";
import styles from "../insights.module.less";

interface DomainItem { host: string; count: number }
interface ActionItem { event: string; count: number }

interface Props {
  topDomains: DomainItem[];
  topActions: ActionItem[];
  archiveStats: { totalTabs: number; savedMemMB: number };
  onDomainClick?: (host: string) => void;
}

function EmptyText({ text }: { text: string }) {
  return (
    <Flex align="center" justify="center" className="insights-stat-empty">
      <Typography.Text type="secondary">{text}</Typography.Text>
    </Flex>
  );
}

export function StatCards({ topDomains, topActions, archiveStats, onDomainClick }: Props) {
  const { t } = useT();
  const { token } = theme.useToken();
  const getEventLabel = useEventLabel();

  return (
    <Flex vertical gap={8}>
      <Card title={t("Top 10 访问域名")} className={styles["insights-stat-card"]}>
        {topDomains.length === 0 ? (
          <EmptyText text={t("暂无数据")} />
        ) : (
          <InsightsBarList
            items={topDomains.map((d) => ({ label: d.host, value: d.count }))}
            color={token.colorPrimary}
            onClick={onDomainClick}
          />
        )}
      </Card>
      <Card title={t("使用频率前 5")} className={styles["insights-stat-card"]}>
        {topActions.length === 0 ? (
          <EmptyText text={t("暂无数据")} />
        ) : (
          <InsightsBarList
            items={topActions.map((a) => ({ label: a.event, value: a.count }))}
            color={token.colorPrimary}
            renderLabel={getEventLabel}
          />
        )}
      </Card>
      <Card title={t("累计归档")} className={styles["insights-stat-card"]}>
        {archiveStats.totalTabs === 0 ? (
          <EmptyText text={t("尚未归档")} />
        ) : (
          <Flex vertical align="center" gap={4} className="insights-archive-stat">
            <Typography.Text className="insights-archive-stat__value">
              {archiveStats.totalTabs}
            </Typography.Text>
            <Typography.Text type="secondary">
              {t("约节省 {mb} MB 内存", { mb: archiveStats.savedMemMB })}
            </Typography.Text>
          </Flex>
        )}
      </Card>
    </Flex>
  );
}
