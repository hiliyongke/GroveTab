/**
 * use-history-data —— 历史面板数据加载 hook
 *
 * 负责：
 *   - 管理 closedTabs / closedWindows / events / snapshots / snapshotDiff / loading 状态
 *   - 提供 refresh 回调（面板打开时自动调用，操作后手动调用）
 *   - 面板打开时自动加载数据
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getClosedTabs,
  getClosedWindows,
  getHistoryEvents,
  getDailySnapshots,
  diffSnapshots,
  snapshotDateKey,
} from '@/repositories';
import type {
  ClosedTabRecord,
  ClosedWindowRecord,
  DailySnapshot,
  HistoryEvent,
  SnapshotDiff,
} from '@/shared/types';

export interface UseHistoryDataReturn {
  closedTabs: ClosedTabRecord[];
  closedWindows: ClosedWindowRecord[];
  events: HistoryEvent[];
  snapshots: DailySnapshot[];
  snapshotDiff: SnapshotDiff | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * 历史面板数据加载 hook
 * @param open - 面板是否打开
 * @returns {UseHistoryDataReturn} 返回历史面板所需的数据和刷新回调
 */
export function useHistoryData(open: boolean): UseHistoryDataReturn {
  const [closedTabs, setClosedTabs] = useState<ClosedTabRecord[]>([]);
  const [closedWindows, setClosedWindows] = useState<ClosedWindowRecord[]>([]);
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [loading, setLoading] = useState(false);

  /**
   * 「昨天 → 今天」 diff：运行时计算，不落盘。
   * 不仅看「昨天 + 今天」，也允许「今天 vs 最近一次有记录的那天」：连着几天没启动也能提供变化感。
   */
  const snapshotDiff = useMemo<SnapshotDiff | null>(() => {
    if (snapshots.length < 2) return null;
    const todayKey = snapshotDateKey();
    const today = snapshots.find((s) => s.dateKey === todayKey) ?? snapshots[snapshots.length - 1];
    if (today === undefined) return null;
    const others = snapshots.filter((s) => s.dateKey !== today.dateKey);
    if (others.length === 0) return null;
    // 取与 today 最接近的一天作为对照组
    const yesterday = others.reduce((prev: DailySnapshot, cur: DailySnapshot) => (cur.dateKey > prev.dateKey ? cur : prev));
    return diffSnapshots(yesterday, today);
  }, [snapshots]);

  /** 拉取数据 —— 打开面板时执行；后续也会被「恢复/删除/清空」操作主动 refresh */
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [tabs, windows, evts, snaps] = await Promise.all([
        getClosedTabs(),
        getClosedWindows(),
        getHistoryEvents(),
        getDailySnapshots(),
      ]);
      setClosedTabs(tabs);
      setClosedWindows(windows);
      setEvents(evts);
      setSnapshots(snaps);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  return {
    closedTabs,
    closedWindows,
    events,
    snapshots,
    snapshotDiff,
    loading,
    refresh,
  };
}
