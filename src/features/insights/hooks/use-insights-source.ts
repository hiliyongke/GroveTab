/**
 * useInsightsSource — 加载 metrics + stats 原始数据
 *
 * 集中处理：
 *   - 并行拉取 getMetrics() / getStats()
 *   - StatsData 结构校验
 *   - 取消支持（防过期 effect）
 */

import { useEffect, useState } from "react";
import { getMetrics, getStats } from "@/repositories";
import type { MetricEvent, StatsData } from "@/shared/types";

export interface UseInsightsSourceResult {
  metrics: MetricEvent[];
  stats: StatsData | null;
  loading: boolean;
  /** 强制重新拉取（用户在"清除"按钮之后无需调用） */
  reload: () => void;
}

function isValidStatsData(data: StatsData | undefined | null): data is StatsData {
  if (data == null) return false;
  if (!Array.isArray(data.daily)) return false;
  if (typeof data.lastFlushAt !== "number") return false;
  return true;
}

export function useInsightsSource(): UseInsightsSourceResult {
  const [metrics, setMetrics] = useState<MetricEvent[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [m, s] = await Promise.all([getMetrics(), getStats()]);
        if (cancelled) return;
        setMetrics(Array.isArray(m) ? m : []);
        setStats(isValidStatsData(s) ? s : null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return { metrics, stats, loading, reload: () => setNonce((n) => n + 1) };
}
