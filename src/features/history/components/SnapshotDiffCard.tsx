/**
 * SnapshotDiffCard — 「昨天 → 今天」对比卡片
 *
 * 视觉策略（原组件 1:1 迁移，布局不改）：
 *   - 顶部一行总数：今天 N（昨天 M，±delta）
 *   - 两列芯片：左列「新开始访问」、右列「不再活跃」，最多各显示 5 个
 *   - 没有变化时显示一个友好的「同昨天一致」提示
 */

import type { ReactNode } from "react";
import { Flex, Typography, Tag, Space } from "antd";
import { Camera, TrendingUp, TrendingDown } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import type { SnapshotDiff } from "@/shared/types";
import styles from "../HistoryView.module.less";

interface Props {
  diff: SnapshotDiff;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const MAX_CHIPS = 5;

export function SnapshotDiffCard({ diff, t }: Props): ReactNode {
  const sign = diff.delta > 0 ? "+" : diff.delta < 0 ? "" : "±";
  const isFlat = diff.added.length === 0 && diff.removed.length === 0;
  const addedShown = diff.added.slice(0, MAX_CHIPS);
  const removedShown = diff.removed.slice(0, MAX_CHIPS);
  const addedExtra = diff.added.length - addedShown.length;
  const removedExtra = diff.removed.length - removedShown.length;

  return (
    <Flex vertical gap={10} className={styles["history-diff-card"]}>
      <Flex
        align="baseline"
        justify="space-between"
        gap={8}
        className={styles["history-diff-card-head"]}
      >
        <Flex align="center" gap={6} className={styles["history-diff-card-title"]}>
          <Camera size={ICON_SIZE.SMALL} />
          <Typography.Text>{t("昨天 → 今天")}</Typography.Text>
        </Flex>
        <Typography.Text className={styles["history-diff-card-subtitle"]}>
          {t("按站点汇总的使用变化")}
        </Typography.Text>
      </Flex>
      <Typography.Text className={styles["history-diff-card-total"]}>
        {t("总标签 {today}（昨天 {yesterday}，{sign}{delta}）", {
          today: diff.today.totalTabs,
          yesterday: diff.yesterday.totalTabs,
          sign,
          delta: Math.abs(diff.delta),
        })}
      </Typography.Text>
      {isFlat ? (
        <Typography.Text className={styles["history-diff-empty"]}>
          {t("两天访问的站点完全一致 ✨")}
        </Typography.Text>
      ) : (
        <div className={styles["history-diff-cols"]}>
          {addedShown.length > 0 && <AddedCol items={addedShown} extra={addedExtra} t={t} />}
          {removedShown.length > 0 && <RemovedCol items={removedShown} extra={removedExtra} t={t} />}
        </div>
      )}
    </Flex>
  );
}

function AddedCol({
  items,
  extra,
  t,
}: {
  items: Array<{ host: string; count: number }>;
  extra: number;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <Flex vertical gap={6} className={styles["history-diff-col"]}>
      <Flex
        align="center"
        gap={4}
        className={`${styles["history-diff-col-title"]} ${styles["history-diff-col-title--added"]}`}
      >
        <TrendingUp size={ICON_SIZE.TINY} />
        <Typography.Text>{t("新开始访问")}</Typography.Text>
      </Flex>
      <Space className={styles["history-diff-chips"]} size={[4, 4]} wrap>
        {items.map((item) => (
          <Tag
            key={`a-${item.host}`}
            className={`${styles["history-diff-chip"]} ${styles["history-diff-chip--added"]}`}
          >
            <span className={styles["history-diff-chip-host"]}>{item.host}</span>
            <span className={styles["history-diff-chip-count"]}>×{item.count}</span>
          </Tag>
        ))}
        {extra > 0 && <ExtraChip n={extra} t={t} />}
      </Space>
    </Flex>
  );
}

function RemovedCol({
  items,
  extra,
  t,
}: {
  items: Array<{ host: string; count: number }>;
  extra: number;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <Flex vertical gap={6} className={styles["history-diff-col"]}>
      <Flex
        align="center"
        gap={4}
        className={`${styles["history-diff-col-title"]} ${styles["history-diff-col-title--removed"]}`}
      >
        <TrendingDown size={ICON_SIZE.TINY} />
        <Typography.Text>{t("今天不再活跃")}</Typography.Text>
      </Flex>
      <Space className={styles["history-diff-chips"]} size={[4, 4]} wrap>
        {items.map((item) => (
          <Tag
            key={`r-${item.host}`}
            className={`${styles["history-diff-chip"]} ${styles["history-diff-chip--removed"]}`}
          >
            <span className={styles["history-diff-chip-host"]}>{item.host}</span>
            <span className={styles["history-diff-chip-count"]}>×{item.count}</span>
          </Tag>
        ))}
        {extra > 0 && <ExtraChip n={extra} t={t} />}
      </Space>
    </Flex>
  );
}

function ExtraChip({ n, t }: { n: number; t: (key: string, params?: Record<string, string | number>) => string }) {
  return (
    <Tag className={`${styles["history-diff-chip"]} ${styles["history-diff-chip--more"]}`}>
      {t("还有 {n} 个", { n })}
    </Tag>
  );
}
