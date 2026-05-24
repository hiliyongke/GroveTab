import { Button, Alert, Empty, Tag } from "antd";
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
    <div className={styles["bm-tools__panel"]}>
      <div className={styles["bm-tools__panel-header"]}>
        <div>
          <div className={styles["bm-tools__panel-title"]}>{t("bookmark.tools.dedupe")}</div>
          <div className={styles["bm-tools__panel-subtitle"]}>
            {t("bookmark.tools.dedupeHint", { mode: dedupStrictness })}
          </div>
        </div>
        <div className={styles["bm-tools__panel-actions"]}>
          <Button
            type="primary"
            loading={dupLoading}
            icon={<RefreshCw size={ICON_SIZE.SMALL} />}
            onClick={() => {
              void scanDuplicates();
            }}
          >
            {t("bookmark.tools.scan")}
          </Button>
          {dups !== null && dups.length > 0 && (
            <Button
              danger
              icon={<Check size={ICON_SIZE.SMALL} />}
              onClick={() => {
                void applyDedupe();
              }}
            >
              {t("bookmark.tools.mergeAll", {
                count: dups.reduce((s, g) => s + g.items.length - 1, 0),
              })}
            </Button>
          )}
        </div>
      </div>

      {dups === null && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("bookmark.tools.idle")}
          className={styles["bm-tools__empty"]}
        />
      )}

      {dups !== null && dups.length === 0 && (
        <Alert type="success" showIcon message={t("bookmark.tools.dedupeClean")} />
      )}

      {dups !== null && dups.length > 0 && (
        <div className={styles["bm-tools__list"]}>
          {dups.map((g) => (
            <div key={g.key} className={styles["bm-tools__group"]}>
              <div className={styles["bm-tools__group-header"]}>
                <SiteIcon url={g.items[0]?.url ?? g.key} />
                <div className={styles["bm-tools__group-title"]} title={g.key}>
                  {g.key}
                </div>
                <Tag color="orange">
                  {t("bookmark.tools.dedupeItems", { count: g.items.length })}
                </Tag>
              </div>
              <div className={styles["bm-tools__group-body"]}>
                {g.items.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`${styles["bm-tools__row"]}${idx === 0 ? " is-keep" : ""}`}
                  >
                    <div className={styles["bm-tools__row-main"]}>
                      <div className={styles["bm-tools__row-title"]}>{item.title || item.url}</div>
                      <div className={styles["bm-tools__row-sub"]}>{item.url}</div>
                    </div>
                    {idx === 0 ? (
                      <Tag color="green">{t("bookmark.tools.keep")}</Tag>
                    ) : (
                      <Tag color="red">{t("bookmark.tools.willRemove")}</Tag>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
