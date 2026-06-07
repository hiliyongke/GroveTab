/**
 * useHistorySource — 历史数据源加载
 *
 * 集中管理 closedTabs / closedWindows / events / snapshots 四个集合的拉取和缓存。
 *
 * 关键：使用 Promise.allSettled 而非 Promise.all，避免单个仓库失败让整个面板空白。
 */

import { useCallback, useEffect, useState } from "react";
import {
  getClosedTabs,
  getClosedWindows,
  getHistoryEvents,
  getDailySnapshots,
  reconcileFromChromeHistory,
} from "@/repositories";
import type {
  ClosedTabRecord,
  ClosedWindowRecord,
  DailySnapshot,
  HistoryEvent,
} from "@/shared/types";

export interface UseHistorySourceResult {
  closedTabs: ClosedTabRecord[];
  closedWindows: ClosedWindowRecord[];
  events: HistoryEvent[];
  snapshots: DailySnapshot[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useHistorySource(): UseHistorySourceResult {
  const [closedTabs, setClosedTabs] = useState<ClosedTabRecord[]>([]);
  const [closedWindows, setClosedWindows] = useState<ClosedWindowRecord[]>([]);
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [tabs, windows, evts, snaps] = await Promise.allSettled([
        getClosedTabs(),
        getClosedWindows(),
        getHistoryEvents(),
        getDailySnapshots(),
      ]);
      if (tabs.status === "fulfilled") setClosedTabs(tabs.value);
      else console.warn("[HistoryView] Failed to load closed tabs:", tabs.reason);
      if (windows.status === "fulfilled") setClosedWindows(windows.value);
      else console.warn("[HistoryView] Failed to load closed windows:", windows.reason);
      if (evts.status === "fulfilled") setEvents(evts.value);
      else console.warn("[HistoryView] Failed to load events:", evts.reason);
      if (snaps.status === "fulfilled") setSnapshots(snaps.value);
      else console.warn("[HistoryView] Failed to load snapshots:", snaps.reason);
      // 静默对账 chrome.history（不阻塞主流程）
      void reconcileFromChromeHistory(24 * 3600 * 1000);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { closedTabs, closedWindows, events, snapshots, loading, refresh };
}
