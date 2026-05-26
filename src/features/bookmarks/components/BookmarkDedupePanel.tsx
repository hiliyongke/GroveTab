import { Button, Alert, Empty, Tag, Flex, Typography } from "antd";
import { Check, RefreshCw } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import { SiteIcon } from "@/shared/ui/SiteIcon";
import type { DuplicateBookmarkGroup } from "../bookmark-tools";
import styles from "../bookmark-tools.module.less";

interface BookmarkDedupePanelProps {
  dups: DuplicateBookmarkGroup[] | null;
  dupLoading: boolean;
  scanDuplicates: () => Promise<void>;
  applyDedupe: () => Promise<void>;
  dedupStrictness: string;
}

export function BookmarkDedupePanel({
  dups,
  dupLoading,
  scanDuplicates,
  applyDedupe,
  dedupStrictness,
}: BookmarkDedupePanelProps) {
  const { t } = useT();

  return (
    <Flex vertical gap={20} className={styles["bm-tools__panel"]}>
      <Flex align="flex-start" gap={12} className={styles["bm-tools__panel-header"]}>
        <Flex vertical className={styles["bm-tools__panel-copy"]}>
          <Typography.Text className={styles["bm-tools__panel-title"]}>{t("去重")}</Typography.Text>
          <Typography.Text className={styles["bm-tools__panel-subtitle"]}>
            {t("依据当前去重严格度：{mode}。默认保留每组第一个书签，删除其余重复项。", {
              mode: dedupStrictness,
            })}
          </Typography.Text>
        </Flex>
        <Flex align="center" gap={8} className={styles["bm-tools__panel-actions"]}>
          <Button
            type="primary"
            loading={dupLoading}
            icon={<RefreshCw size={ICON_SIZE.SMALL} />}
            onClick={() => {
              void scanDuplicates();
            }}
          >
            {t("开始扫描")}
          </Button>
          {dups !== null && dups.length > 0 && (
            <Button
              danger
              icon={<Check size={ICON_SIZE.SMALL} />}
              onClick={() => {
                void applyDedupe();
              }}
            >
              {t("合并全部（删除 {count} 项）", {
                count: dups.reduce((s, g) => s + g.items.length - 1, 0),
              })}
            </Button>
          )}
        </Flex>
      </Flex>

      {dups === null && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('点击"开始扫描"查看结果')}
          className={styles["bm-tools__empty"]}
        />
      )}

      {dups !== null && dups.length === 0 && (
        <Alert type="success" showIcon message={t("未发现重复书签，一切整齐。")} />
      )}

      {dups !== null && dups.length > 0 && (
        <Flex vertical gap={12} className={styles["bm-tools__list"]}>
          {dups.map((g) => (
            <Flex key={g.key} vertical className={styles["bm-tools__group"]}>
              <Flex align="center" gap={10} className={styles["bm-tools__group-header"]}>
                <SiteIcon url={g.items[0]?.url ?? g.key} />
                <Typography.Text className={styles["bm-tools__group-title"]} title={g.key}>
                  {g.key}
                </Typography.Text>
                <Tag color="orange">{t("共 {count} 项重复", { count: g.items.length })}</Tag>
              </Flex>
              <Flex vertical className={styles["bm-tools__group-body"]}>
                {g.items.map((item, idx) => (
                  <Flex
                    key={item.id}
                    align="center"
                    gap={12}
                    className={`${styles["bm-tools__row"]}${idx === 0 ? ` ${styles["is-keep"]}` : ""}`}
                  >
                    <Flex vertical className={styles["bm-tools__row-main"]}>
                      <Typography.Text className={styles["bm-tools__row-title"]}>
                        {item.title || item.url}
                      </Typography.Text>
                      <Typography.Text className={styles["bm-tools__row-sub"]}>
                        {item.url}
                      </Typography.Text>
                    </Flex>
                    {idx === 0 ? (
                      <Tag color="green">{t("保留")}</Tag>
                    ) : (
                      <Tag color="red">{t("将被删除")}</Tag>
                    )}
                  </Flex>
                ))}
              </Flex>
            </Flex>
          ))}
        </Flex>
      )}
    </Flex>
  );
}
