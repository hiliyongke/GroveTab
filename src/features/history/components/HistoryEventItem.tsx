/**
 * HistoryEventItem — 操作时间线中的单条事件
 *
 * 行为：
 *   - 点击主标题 → 打开该 URL
 *   - 右侧：撤销（如 undoable） / 删除
 *   - 已撤销事件用灰色 + tag 标记
 */

import { memo } from "react";
import { Flex, Button, Tooltip, Typography, Tag } from "antd";
import { Undo2, X } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import { createTab } from "@/chrome";
import { eventIcon, getEventDescription } from "../utils/event-format";
import type { HistoryEvent } from "@/shared/types";
import styles from "../HistoryView.module.less";

interface Props {
  e: HistoryEvent;
  relTime: (ts: number) => string;
  onUndo: (e: HistoryEvent) => void;
  onDelete: (id: string) => void;
}

export const HistoryEventItem = memo(
  function HistoryEventItem({ e, relTime, onUndo, onDelete }: Props) {
    const { t } = useT();
    const isUndone = e.extra?.undone === true;

    return (
      <Flex
        key={e.id}
        align="center"
        gap={10}
        className={`${styles["history-event"]}${isUndone ? ` ${styles["is-undone"]}` : ""}`}
      >
        <Typography.Text className={styles["history-event-icon"]}>
          {eventIcon(e.type)}
        </Typography.Text>
        <Flex
          vertical
          gap={2}
          className={styles["history-event-main"]}
          onClick={() => {
            if (e.url !== undefined && e.url !== "") {
              void createTab({ url: e.url, active: true });
            }
          }}
        >
          <Flex align="center" gap={6} className={styles["history-event-line"]}>
            <Typography.Text className={styles["history-event-action"]}>
              {getEventDescription(e, t)}
            </Typography.Text>
            {e.title !== undefined && e.title !== "" && (
              <Typography.Text className={styles["history-event-target"]} ellipsis={{ tooltip: e.url }}>
                {e.title}
              </Typography.Text>
            )}
            {isUndone && (
              <Tag color="default" className={styles["history-item-tag"]}>
                {t("已撤销")}
              </Tag>
            )}
          </Flex>
          <Flex align="center" gap={4} className={styles["history-event-meta"]}>
            {e.hostname !== undefined && e.hostname !== "" && (
              <>
                <Typography.Text>{e.hostname}</Typography.Text>
                <Typography.Text className={styles["history-item-dot"]}>·</Typography.Text>
              </>
            )}
            <Typography.Text>{relTime(e.ts)}</Typography.Text>
          </Flex>
        </Flex>
        {e.undoable === true && !isUndone && (
          <Tooltip title={t("撤销")}>
            <Button
              type="text"
              size="small"
              icon={<Undo2 size={ICON_SIZE.SMALL} />}
              onClick={() => onUndo(e)}
            />
          </Tooltip>
        )}
        <Tooltip title={t("删除")}>
          <Button
            type="text"
            size="small"
            icon={<X size={ICON_SIZE.SMALL} />}
            onClick={() => onDelete(e.id)}
          />
        </Tooltip>
      </Flex>
    );
  },
  (prev, next) =>
    prev.e.id === next.e.id &&
    prev.e.type === next.e.type &&
    prev.e.title === next.e.title &&
    prev.e.ts === next.e.ts &&
    prev.e.extra?.undone === next.e.extra?.undone &&
    prev.relTime === next.relTime,
);
