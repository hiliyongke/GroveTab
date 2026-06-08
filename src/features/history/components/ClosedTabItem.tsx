/**
 * ClosedTabItem — 最近关闭的单个标签行
 *
 * 行为：
 *   - 点击标题区域 → 恢复并打开
 *   - 右侧按钮：恢复 / 删除
 *   - 已固定标签带 📌 tag
 */

import { memo } from "react";
import { Flex, Button, Tooltip, Typography, Tag } from "antd";
import { RotateCcw, X } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import { GlobeIcon } from "../utils/event-format";
import type { ClosedTabRecord } from "@/shared/types";
import styles from "../HistoryView.module.less";

interface Props {
  rec: ClosedTabRecord;
  /** 相对时间描述函数（由上层注入，避免每行建 hook） */
  relTime: (ts: number) => string;
  onRestore: (rec: ClosedTabRecord) => void;
  onDelete: (rec: ClosedTabRecord) => void;
}

export const ClosedTabItem = memo(
  function ClosedTabItem({ rec, relTime, onRestore, onDelete }: Props) {
    const { t } = useT();
    return (
      <Flex key={rec.id} align="center" gap={10} className={styles["history-item"]}>
        <span className={styles["history-item-favicon-wrap"]}>
          {rec.favIconUrl !== "" ? (
            <img
              src={rec.favIconUrl}
              alt=""
              className={styles["history-item-favicon"]}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                const fallback = (e.target as HTMLImageElement)
                  .nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = "inline-flex";
              }}
            />
          ) : null}
          <span
            className={styles["history-item-favicon-fallback"]}
            style={rec.favIconUrl !== "" ? { display: "none" } : undefined}
          >
            {GlobeIcon}
          </span>
        </span>
        <Flex
          vertical
          gap={2}
          className={styles["history-item-main"]}
          onClick={() => onRestore(rec)}
        >
          <Flex align="center" gap={6} className={styles["history-item-title"]}>
            <Typography.Text ellipsis>{rec.title || rec.url}</Typography.Text>
          </Flex>
          <Flex align="center" gap={4} className={styles["history-item-subtitle"]}>
            <Typography.Text>{rec.hostname || rec.url}</Typography.Text>
            <Typography.Text className={styles["history-item-dot"]}>·</Typography.Text>
            <Typography.Text>{relTime(rec.ts)}</Typography.Text>
            {rec.pinned && (
              <Tag color="gold" className={styles["history-item-tag"]}>
                📌
              </Tag>
            )}
          </Flex>
        </Flex>
        <Flex gap={2} className={styles["history-item-actions"]}>
          <Tooltip title={t("恢复")}>
            <Button
              type="text"
              size="small"
              icon={<RotateCcw size={ICON_SIZE.SMALL} />}
              onClick={() => onRestore(rec)}
            />
          </Tooltip>
          <Tooltip title={t("删除")}>
            <Button
              type="text"
              size="small"
              icon={<X size={ICON_SIZE.SMALL} />}
              onClick={() => onDelete(rec)}
            />
          </Tooltip>
        </Flex>
      </Flex>
    );
  },
  (prev, next) =>
    prev.rec.id === next.rec.id &&
    prev.rec.title === next.rec.title &&
    prev.rec.url === next.rec.url &&
    prev.rec.pinned === next.rec.pinned &&
    prev.rec.ts === next.rec.ts &&
    prev.relTime === next.relTime,
);
