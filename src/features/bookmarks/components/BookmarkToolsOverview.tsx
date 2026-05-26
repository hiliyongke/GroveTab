import { Button, Alert, Card, Flex, Typography } from "antd";
import { RefreshCw } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import type { BookmarkOverview } from "@/features/bookmarks/bookmark-tools";
import { useT } from "@/shared/i18n";
import styles from "../bookmark-tools.module.less";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  accent?: "primary" | "success" | "warning" | "info";
}

function StatCard({ icon, label, value, accent }: StatCardProps) {
  return (
    <Card
      className={`${styles["bm-tools__stat-card"]}${accent ? ` ${styles[`is-${accent}`]}` : ""}`}
    >
      <Flex align="center" gap={16}>
        <Flex align="center" justify="center" className={styles["bm-tools__stat-icon"]}>
          {icon}
        </Flex>
        <Flex vertical className={styles["bm-tools__stat-body"]}>
          <Typography.Text className={styles["bm-tools__stat-value"]}>{value}</Typography.Text>
          <Typography.Text className={styles["bm-tools__stat-label"]}>{label}</Typography.Text>
        </Flex>
      </Flex>
    </Card>
  );
}

interface BookmarkToolsOverviewProps {
  overview: BookmarkOverview | null;
  overviewLoading: boolean;
  onRefresh: () => void;
}

export function BookmarkToolsOverview({
  overview,
  overviewLoading,
  onRefresh,
}: BookmarkToolsOverviewProps) {
  const { t } = useT();

  if (overviewLoading || overview === null) {
    return (
      <Flex vertical className={styles["bm-tools__overview-loading"]}>
        <Flex wrap gap={12} className={styles["bm-tools__overview-stats"]}>
          <StatCard icon="📊" label="..." value="..." />
          <StatCard icon="🔖" label="..." value="..." />
          <StatCard icon="📁" label="..." value="..." />
          <StatCard icon="#️⃣" label="..." value="..." />
        </Flex>
      </Flex>
    );
  }

  return (
    <Flex vertical className={styles["bm-tools__overview"]}>
      <Flex wrap gap={12} className={styles["bm-tools__overview-stats"]}>
        <StatCard icon="📊" label={t("文件夹")} value={overview.folders} accent="primary" />
        <StatCard icon="🔖" label={t("书签总数")} value={overview.total} accent="success" />
        <StatCard
          icon="📁"
          label={t("空文件夹数")}
          value={overview.emptyFolders}
          accent={overview.emptyFolders > 0 ? "warning" : "info"}
        />
        <StatCard
          icon="#️⃣"
          label={t("重复书签数")}
          value={overview.duplicates}
          accent={overview.duplicates > 0 ? "warning" : "info"}
        />
      </Flex>

      {overview.emptyFolders > 0 && (
        <Alert
          type="warning"
          showIcon
          message={t("发现 {count} 个空文件夹，可一键清理", { count: overview.emptyFolders })}
          className={styles["bm-tools__overview-alert"]}
        />
      )}

      {overview.duplicates > 0 && (
        <Alert
          type="warning"
          showIcon
          message={t("发现 {count} 个重复书签，可合并清理", { count: overview.duplicates })}
          className={styles["bm-tools__overview-alert"]}
        />
      )}

      <Flex className={styles["bm-tools__overview-actions"]}>
        <Button onClick={onRefresh} icon={<RefreshCw size={ICON_SIZE.SMALL} />}>
          {t("刷新总览")}
        </Button>
      </Flex>
    </Flex>
  );
}
