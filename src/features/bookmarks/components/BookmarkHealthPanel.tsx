import { Button, Alert, Empty, Tag, Progress, Segmented, Tooltip } from "antd";
import { Check, RefreshCw, ExternalLink } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { createTab } from "@/chrome";
import { useT } from "@/shared/i18n";
import { SiteIcon } from "@/shared/ui/SiteIcon";
import type { BookmarkHealth } from "../bookmark-tools";
import styles from "../bookmark-tools.module.less";

interface BookmarkHealthPanelProps {
  healthResults: BookmarkHealth[] | null;
  healthLoading: boolean;
  healthProgress: { done: number; total: number } | null;
  healthPermission: boolean | null;
  healthFilter: "all" | "dead" | "timeout" | "ok";
  setHealthFilter: (v: "all" | "dead" | "timeout" | "ok") => void;
  filteredHealth: BookmarkHealth[];
  deadList: BookmarkHealth[];
  healthStats: { ok: number; dead: number; timeout: number; skipped: number; total: number } | null;
  checkHealth: () => Promise<void>;
  applyRemoveDead: () => Promise<void>;
}

export function BookmarkHealthPanel({
  healthResults,
  healthLoading,
  healthProgress,
  healthPermission,
  healthFilter,
  setHealthFilter,
  filteredHealth,
  deadList,
  healthStats,
  checkHealth,
  applyRemoveDead,
}: BookmarkHealthPanelProps) {
  const { t } = useT();

  return (
    <div className={styles["bm-tools__panel"]}>
      <div className={styles["bm-tools__panel-header"]}>
        <div>
          <div className={styles["bm-tools__panel-title"]}>{t("bookmark.tools.health")}</div>
          <div className={styles["bm-tools__panel-subtitle"]}>{t("bookmark.tools.healthHint")}</div>
        </div>
        <div className={styles["bm-tools__panel-actions"]}>
          <Button
            type="primary"
            loading={healthLoading}
            icon={<RefreshCw size={ICON_SIZE.SMALL} />}
            onClick={() => {
              void checkHealth();
            }}
          >
            {t("bookmark.tools.scan")}
          </Button>
          {deadList.length > 0 && (
            <Button
              danger
              icon={<Check size={ICON_SIZE.SMALL} />}
              onClick={() => {
                void applyRemoveDead();
              }}
            >
              {t("bookmark.tools.removeDeadAll", { count: deadList.length })}
            </Button>
          )}
        </div>
      </div>

      {healthPermission === false && (
        <Alert type="error" showIcon message={t("bookmark.tools.healthNeedPermission")} />
      )}

      {healthLoading && healthProgress !== null && (
        <div className={styles["bm-tools__progress"]}>
          <Progress
            percent={
              healthProgress.total > 0
                ? Math.round((healthProgress.done / healthProgress.total) * 100)
                : 0
            }
            status="active"
          />
          <div className={styles["bm-tools__progress-text"]}>
            {t("bookmark.tools.healthProgress", {
              done: healthProgress.done,
              total: healthProgress.total,
            })}
          </div>
        </div>
      )}

      {healthStats !== null && (
        <div className={styles["bm-tools__health-summary"]}>
          <span className="bm-tools__chip is-success">
            <span className={styles["bm-tools__chip-dot"]} /> {t("bookmark.tools.statusOk")}{" "}
            {healthStats.ok}
          </span>
          <span className="bm-tools__chip is-danger">
            <span className={styles["bm-tools__chip-dot"]} /> {t("bookmark.tools.statusDead")}{" "}
            {healthStats.dead}
          </span>
          <span className="bm-tools__chip is-warning">
            <span className={styles["bm-tools__chip-dot"]} /> {t("bookmark.tools.statusTimeout")}{" "}
            {healthStats.timeout}
          </span>
          <span className="bm-tools__chip is-muted">
            <span className={styles["bm-tools__chip-dot"]} /> {t("bookmark.tools.statusSkipped")}{" "}
            {healthStats.skipped}
          </span>
        </div>
      )}

      {healthResults !== null && (
        <Segmented
          size="small"
          value={healthFilter}
          onChange={(v) => setHealthFilter(v as typeof healthFilter)}
          options={[
            {
              value: "dead",
              label: `${t("bookmark.tools.statusDead")} (${healthStats?.dead ?? 0})`,
            },
            {
              value: "timeout",
              label: `${t("bookmark.tools.statusTimeout")} (${healthStats?.timeout ?? 0})`,
            },
            { value: "ok", label: `${t("bookmark.tools.statusOk")} (${healthStats?.ok ?? 0})` },
            {
              value: "all",
              label: `${t("bookmark.tools.statusAll")} (${healthStats?.total ?? 0})`,
            },
          ]}
        />
      )}

      {healthResults === null && !healthLoading && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("bookmark.tools.idle")}
          className={styles["bm-tools__empty"]}
        />
      )}

      {healthResults !== null && filteredHealth.length === 0 && (
        <Alert type="success" showIcon message={t("bookmark.tools.healthFilterEmpty")} />
      )}

      {healthResults !== null && filteredHealth.length > 0 && (
        <div className={styles["bm-tools__list"]}>
          {filteredHealth.map((r) => (
            <div key={r.bookmark.id} className={`bm-tools__row is-status-${r.status}`}>
              <SiteIcon url={r.bookmark.url ?? ""} />
              <div className={styles["bm-tools__row-main"]}>
                <div className={styles["bm-tools__row-title"]}>
                  {r.bookmark.title || r.bookmark.url}
                </div>
                <div className={styles["bm-tools__row-sub"]}>{r.bookmark.url}</div>
              </div>
              <Tag
                color={
                  r.status === "ok"
                    ? "green"
                    : r.status === "timeout"
                      ? "orange"
                      : r.status === "dead"
                        ? "red"
                        : "default"
                }
              >
                {t(
                  `bookmark.tools.status${r.status.charAt(0).toUpperCase() + r.status.slice(1)}` as never,
                )}
              </Tag>
              {r.bookmark.url !== undefined && (
                <Tooltip title={t("bookmark.tools.openInNewTab")}>
                  <Button
                    type="text"
                    size="small"
                    icon={<ExternalLink size={ICON_SIZE.SMALL} />}
                    onClick={() => {
                      void createTab({ url: r.bookmark.url, active: false });
                    }}
                  />
                </Tooltip>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
