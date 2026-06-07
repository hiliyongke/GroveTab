/**
 * useHistoryAnalysis — 加载分析视图数据
 *
 * 行为：
 *   - 仅在 activeTab === "analysis" 时由调用方触发加载
 *   - 切换时间范围自动重载
 */

import { useEffect, useState } from "react";
import { analyzeHistory } from "@/repositories";
import type { HistoryAnalysis } from "@/repositories";

export interface UseHistoryAnalysisResult {
  analysis: HistoryAnalysis | null;
  loading: boolean;
  rangeMs: number;
  setRangeMs: (ms: number) => void;
  reload: () => void;
}

export function useHistoryAnalysis(
  defaultRangeMs: number,
  active: boolean,
): UseHistoryAnalysisResult {
  const [analysis, setAnalysis] = useState<HistoryAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [rangeMs, setRangeMs] = useState(defaultRangeMs);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setLoading(true);
    void analyzeHistory(rangeMs)
      .then((result) => {
        if (!cancelled) setAnalysis(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, rangeMs, nonce]);

  return {
    analysis,
    loading,
    rangeMs,
    setRangeMs,
    reload: () => setNonce((n) => n + 1),
  };
}
