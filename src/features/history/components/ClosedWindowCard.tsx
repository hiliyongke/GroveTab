/**
 * ClosedWindowCard — 整窗快照卡片（显示在最近关闭列表顶部）
 */

import { memo } from "react";
import { Flex, Button, Typography } from "antd";
import { RotateCcw, Layers } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import type { ClosedWindowRecord } from "@/shared/types";
import styles from "../HistoryView.module.less";

interface Props {
  win: ClosedWindowRecord;
  relTime: (ts: number) => string;
  onRestore: (win: ClosedWindowRecord) => void;
}

export const ClosedWindowCard = memo(
  function ClosedWindowCard({ win, relTime, onRestore }: Props) {
    const { t } = useT();
    return (
      <Flex
        key={`win-${win.id}`}
        align="center"
        justify="space-between"
        className={styles["history-window-card"]}
      >
        <Flex align="center" gap={8} className={styles["history-window-card-head"]}>
          <Layers size={ICON_SIZE.SMALL} />
          <Typography.Text>
            {t("恢复整个窗口（{count} 个标签）", { count: win.tabCount })}
          </Typography.Text>
          <Typography.Text className={styles["history-item-dot"]}>·</Typography.Text>
          <Typography.Text className={styles["history-window-card-time"]}>
            {relTime(win.ts)}
          </Typography.Text>
        </Flex>
        <Button
          type="primary"
          icon={<RotateCcw size={ICON_SIZE.SMALL} />}
          onClick={() => onRestore(win)}
        >
          {t("恢复")}
        </Button>
      </Flex>
    );
  },
  (prev, next) =>
    prev.win.id === next.win.id &&
    prev.win.tabCount === next.win.tabCount &&
    prev.win.ts === next.win.ts &&
    prev.relTime === next.relTime,
);
