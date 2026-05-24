/**
 * Zustand Store — Stats Slice (F-11 使用频率视图)
 *
 * Slice 依赖关系：
 *   - 依赖 settings-slice：无直接依赖（stats 数据来源是 SW StatsCollector，不依赖设置）
 *   - 独立 slice，不依赖其他 slice
 *   - 被 FrequencyView 组件消费（读取 data, loaded, isFallback）
 *
 * 在新标签页侧消费 SW `StatsCollector` 写入的激活计数数据，
 * 按"最近 7 天合计激活次数"为 `FrequencyView` 排序。
 *
 * 读取流程：
 *   1. 新标签页启动时调用 loadStats()
 *   2. 监听 `chrome.storage.onChanged`（由 use-sw-broadcast 或 App.tsx 层统一监听），
 *      在 SW flush 后立刻刷新 UI
 *   3. 数据缺失或损坏时回退为空，FrequencyView 自行回退到 lastAccessed 近似
 */

import { create } from "zustand";
import type { StatsData } from "@/shared/types";
import { getStats } from "@/repositories";
import { toDayStr } from "@/shared/utils/date";

interface StatsState {
  data: StatsData | null;
  loaded: boolean;
  /** 数据损坏 / 缺失时为 true，UI 提示"数据重建中" */
  isFallback: boolean;
  loadStats: () => Promise<void>;
  /** 基于 daily 聚合计算某 URL 最近 N 天的合计激活次数 */
  getCountRecent: (url: string, days?: number) => number;
  /** 返回按 recent-N-days 合计倒序的 URL 列表 */
  getTopUrls: (days?: number, limit?: number) => Array<{ url: string; count: number }>;
}

const DEFAULT_DAYS = 7;

export const useStatsStore = create<StatsState>((set, get) => ({
  data: null,
  loaded: false,
  isFallback: false,

  loadStats: async () => {
    try {
      const data = await getStats();
      if (!isValidStatsData(data)) {
        set({ data: null, loaded: true, isFallback: true });
        return;
      }
      set({ data, loaded: true, isFallback: false });
    } catch (err) {
      console.warn("[stats] loadStats failed:", err);
      set({ data: null, loaded: true, isFallback: true });
    }
  },

  getCountRecent: (url, days = DEFAULT_DAYS) => {
    const { data } = get();
    if (!data) return 0;
    const cutoff = toDayStr(new Date(Date.now() - days * 86400_000));
    let total = 0;
    for (const record of data.daily) {
      if (record.day >= cutoff) {
        total += record.counts[url] ?? 0;
      }
    }
    return total;
  },

  getTopUrls: (days = DEFAULT_DAYS, limit = 30) => {
    const { data } = get();
    if (!data) return [];
    const cutoff = toDayStr(new Date(Date.now() - days * 86400_000));
    const totals = new Map<string, number>();
    for (const record of data.daily) {
      if (record.day < cutoff) continue;
      for (const [url, count] of Object.entries(record.counts)) {
        totals.set(url, (totals.get(url) ?? 0) + count);
      }
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([url, count]) => ({ url, count }));
  },
}));

function isValidStatsData(data: StatsData | undefined): data is StatsData {
  if (data === undefined) return false;
  if (!Array.isArray(data.daily)) return false;
  if (typeof data.lastFlushAt !== "number") return false;
  return true;
}
