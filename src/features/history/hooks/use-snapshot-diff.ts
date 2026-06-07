/**
 * useSnapshotDiff — 派生"昨天 → 今天"快照对比
 *
 * 行为：
 *   - snapshots 为空或只有 1 天 → null
 *   - 找到今天（或最近一天）与倒数第二天计算 diff
 *   - 兼容跨几天未启动的情况
 */

import { useMemo } from "react";
import { diffSnapshots, snapshotDateKey } from "@/repositories";
import type { DailySnapshot, SnapshotDiff } from "@/shared/types";

export function useSnapshotDiff(snapshots: DailySnapshot[]): SnapshotDiff | null {
  return useMemo<SnapshotDiff | null>(() => {
    if (snapshots.length < 2) return null;
    const todayKey = snapshotDateKey();
    const today = snapshots.find((s) => s.dateKey === todayKey) ?? snapshots[snapshots.length - 1];
    if (today === undefined) return null;
    const others = snapshots.filter((s) => s.dateKey !== today.dateKey);
    if (others.length === 0) return null;
    // 取与 today 最接近的一天作为对照组
    const yesterday = others.reduce((prev: DailySnapshot, cur: DailySnapshot) =>
      cur.dateKey > prev.dateKey ? cur : prev,
    );
    return diffSnapshots(yesterday, today);
  }, [snapshots]);
}
