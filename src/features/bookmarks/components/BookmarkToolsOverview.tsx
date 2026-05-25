import { Button, Alert } from "antd";
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
    <div className={`${styles["bm-tools__stat-card"]}${accent ? ` is-${accent}` : ""}`}>
      <div className={styles["bm-tools__stat-icon"]}>{icon}</div>
      <div className={styles["bm-tools__stat-body"]}>
        <div className={styles["bm-tools__stat-value"]}>{value}</div>
        <div className={styles["bm-tools__stat-label"]}>{label}</div>
      </div>
    </div>
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
      <div className={styles["bm-tools__overview-loading"]}>
        <div className={styles["bm-tools__overview-stats"]}>
          <StatCard icon={<div>📊</div>} label="..." value="..." />
          <StatCard icon={<div>🔖</div>} label="..." value="..." />
          <StatCard icon={<div>📁</div>} label="..." value="..." />
          <StatCard icon={<div>#️⃣</div>} label="..." value="..." />
        </div>
      </div>
    );
  }

  return (
    <div className={styles["bm-tools__overview"]}>
      <div className={styles["bm-tools__overview-stats"]}>
        <StatCard
          icon={<div className={styles["bm-tools__stat-icon"]}>📊</div>}
          label={t('文件夹')}
          value={overview.folders}
          accent="primary"
        />
        <StatCard
          icon={<div className={styles["bm-tools__stat-icon"]}>🔖</div>}
          label={t('书签总数')}
          value={overview.total}
          accent="success"
        />
        <StatCard
          icon={<div className={styles["bm-tools__stat-icon"]}>📁</div>}
          label={t('空文件夹数')}
          value={overview.emptyFolders}
          accent={overview.emptyFolders > 0 ? "warning" : "info"}
        />
        <StatCard
          icon={<div className={styles["bm-tools__stat-icon"]}>#️⃣</div>}
          label={t('重复书签数')}
          value={overview.duplicates}
          accent={overview.duplicates > 0 ? "warning" : "info"}
        />
      </div>

      {overview.emptyFolders > 0 && (
        <Alert
          type="warning"
          showIcon
          message={t('发现 {count} 个空文件夹，可一键清理', { count: overview.emptyFolders })}
          className={styles["bm-tools__overview-alert"]}
        />
      )}

      {overview.duplicates > 0 && (
        <Alert
          type="warning"
          showIcon
          message={t('发现 {count} 个重复书签，可合并清理', { count: overview.duplicates })}
          className={styles["bm-tools__overview-alert"]}
        />
      )}

      <div className={styles["bm-tools__overview-actions"]} style={{ marginTop: 16 }}>
        <Button onClick={onRefresh} icon={<RefreshCw size={ICON_SIZE.SMALL} />}>
          {t('刷新总览')}
        </Button>
      </div>
    </div>
  );
}
