/**
 * useAnalyticsData — 从 metrics + stats 派生分析数据
 *
 * 派生：
 *   - dailyOpens  按 timeRange 桶（7/14/30 天）
 *   - topDomains  Top 10 域名
 *   - topActions  Top 5 事件
 *   - archiveStats 累计归档
 *
 * 性能：所有派生走 useMemo，metrics/stats 引用不变则不重算。
 */

import { useMemo } from "react";
import type { MetricEvent, StatsData } from "@/shared/types";
import { normalizeEvent } from "../utils/event-labels";
import { toLocalDayKey } from "../utils/format";
import { computeArchiveStats } from "../utils/memory-estimate";

export type InsightsTimeRange = 7 | 14 | 30;

export interface DomainCount { host: string; count: number }
export interface ActionCount { event: string; count: number }
export interface DayOpen { day: string; count: number }

export interface AnalyticsData {
  dailyOpens: DayOpen[];
  topDomains: DomainCount[];
  topActions: ActionCount[];
  archiveStats: { totalTabs: number; savedMemMB: number };
  /** dailyOpens 全部为 0（用于空态文案） */
  dailyAllZero: boolean;
}

export function useAnalyticsData(
  metrics: MetricEvent[],
  stats: StatsData | null,
  timeRange: InsightsTimeRange,
): AnalyticsData {
  const dailyOpens = useMemo<DayOpen[]>(() => {
    const now = new Date();
    const map = new Map<string, number>();
    for (let i = timeRange - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      map.set(toLocalDayKey(d), 0);
    }
    for (const ev of metrics) {
      if (normalizeEvent(ev.event) !== "newtab_open") continue;
      const key = toLocalDayKey(new Date(ev.ts));
      if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([day, count]) => ({ day, count }));
  }, [metrics, timeRange]);

  const topDomains = useMemo<DomainCount[]>(() => {
    const counts = new Map<string, number>();
    if (stats?.daily != null) {
      for (const record of stats.daily) {
        if (record?.counts == null) continue;
        for (const [url, c] of Object.entries(record.counts)) {
          try {
            const host = new URL(url).hostname;
            counts.set(host, (counts.get(host) ?? 0) + c);
          } catch {
            /* 忽略畸形 URL */
          }
        }
      }
    }
    for (const ev of metrics) {
      if (!ev.event.startsWith("tab_") && ev.event !== "search_web") continue;
      const payload = (ev.payload ?? {}) as { hostname?: unknown };
      const hostname = typeof payload.hostname === "string" ? payload.hostname : "";
      if (hostname.length > 0) {
        counts.set(hostname, (counts.get(hostname) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([host, count]) => ({ host, count }));
  }, [stats, metrics]);

  const topActions = useMemo<ActionCount[]>(() => {
    const counts = new Map<string, number>();
    for (const ev of metrics) {
      const key = normalizeEvent(ev.event);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([event, count]) => ({ event, count }));
  }, [metrics]);

  const archiveStats = useMemo(
    () => computeArchiveStats(metrics),
    [metrics],
  );

  const dailyAllZero = useMemo(
    () => dailyOpens.every((d) => d.count === 0),
    [dailyOpens],
  );

  return { dailyOpens, topDomains, topActions, archiveStats, dailyAllZero };
}
