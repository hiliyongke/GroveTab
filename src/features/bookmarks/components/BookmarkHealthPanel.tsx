import { Button, Alert, Empty, Tag, Progress, Segmented, Tooltip, Flex, Typography } from "antd";
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
    <Flex vertical gap={20} className={styles["bm-tools__panel"]}>
      <Flex align="flex-start" gap={12} className={styles["bm-tools__panel-header"]}>
        <Flex vertical className={styles["bm-tools__panel-copy"]}>
          <Typography.Text className={styles["bm-tools__panel-title"]}>
            {t("失效检测")}
          </Typography.Text>
          <Typography.Text className={styles["bm-tools__panel-subtitle"]}>
            {t("逐条检测书签是否可访问；需要网页访问权限，首次会弹出授权。")}
          </Typography.Text>
        </Flex>
        <Flex align="center" gap={8} className={styles["bm-tools__panel-actions"]}>
          <Button
            type="primary"
            loading={healthLoading}
            icon={<RefreshCw size={ICON_SIZE.SMALL} />}
            onClick={() => {
              void checkHealth();
            }}
          >
            {t("开始扫描")}
          </Button>
          {deadList.length > 0 && (
            <Button
              danger
              icon={<Check size={ICON_SIZE.SMALL} />}
              onClick={() => {
                void applyRemoveDead();
              }}
            >
              {t("删除全部失效（{count} 个）", { count: deadList.length })}
            </Button>
          )}
        </Flex>
      </Flex>

      {healthPermission === false && (
        <Alert type="error" showIcon message={t("需要授权访问任意网址才能检测书签有效性")} />
      )}

      {healthLoading && healthProgress !== null && (
        <Flex vertical gap={4} className={styles["bm-tools__progress"]}>
          <Progress
            percent={
              healthProgress.total > 0
                ? Math.round((healthProgress.done / healthProgress.total) * 100)
                : 0
            }
            status="active"
          />
          <Typography.Text className={styles["bm-tools__progress-text"]}>
            {t("正在检测 {done}/{total}", {
              done: healthProgress.done,
              total: healthProgress.total,
            })}
          </Typography.Text>
        </Flex>
      )}

      {healthStats !== null && (
        <Flex wrap gap={8} className={styles["bm-tools__health-summary"]}>
          <Tag color="success">
            {t("可达")} {healthStats.ok}
          </Tag>
          <Tag color="error">
            {t("失效")} {healthStats.dead}
          </Tag>
          <Tag color="warning">
            {t("超时")} {healthStats.timeout}
          </Tag>
          <Tag>
            {t("跳过")} {healthStats.skipped}
          </Tag>
        </Flex>
      )}

      {healthResults !== null && (
        <Segmented
          size="small"
          value={healthFilter}
          onChange={(v) => setHealthFilter(v as typeof healthFilter)}
          options={[
            {
              value: "dead",
              label: `${t("失效")} (${healthStats?.dead ?? 0})`,
            },
            {
              value: "timeout",
              label: `${t("超时")} (${healthStats?.timeout ?? 0})`,
            },
            { value: "ok", label: `${t("可达")} (${healthStats?.ok ?? 0})` },
            {
              value: "all",
              label: `${t("全部")} (${healthStats?.total ?? 0})`,
            },
          ]}
        />
      )}

      {healthResults === null && !healthLoading && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('点击"开始扫描"查看结果')}
          className={styles["bm-tools__empty"]}
        />
      )}

      {healthResults !== null && filteredHealth.length === 0 && (
        <Alert type="success" showIcon message={t("当前筛选下没有书签")} />
      )}

      {healthResults !== null && filteredHealth.length > 0 && (
        <Flex vertical gap={12} className={styles["bm-tools__list"]}>
          {filteredHealth.map((r) => (
            <Flex
              key={r.bookmark.id}
              align="center"
              gap={12}
              className={`${styles["bm-tools__row"]} ${styles[`is-status-${r.status}`]}`}
            >
              <SiteIcon url={r.bookmark.url ?? ""} />
              <Flex vertical className={styles["bm-tools__row-main"]}>
                <Typography.Text className={styles["bm-tools__row-title"]}>
                  {r.bookmark.title || r.bookmark.url}
                </Typography.Text>
                <Typography.Text className={styles["bm-tools__row-sub"]}>
                  {r.bookmark.url}
                </Typography.Text>
              </Flex>
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
                <Tooltip title={t("新标签页打开")}>
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
            </Flex>
          ))}
        </Flex>
      )}
    </Flex>
  );
}
