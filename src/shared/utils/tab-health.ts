/**
 * 标签健康评分系统（P2-05）
 *
 * 综合三维度评估标签页健康度：
 *   1. 活跃度（activation frequency）— 近 7 天激活次数
 *   2. 新鲜度（recency）— 最近访问距今时间
 *   3. 精简度（uniqueness）— 无重复扣分
 *
 * 分数范围 0-100，越高越健康。
 */

import type { LiveTab, StatsData } from "@/shared/types";
import { findDuplicates } from "@/shared/utils/dedupe";

export interface TabHealthScore {
  /** 综合健康分 0-100 */
  total: number;
  /** 活跃度分 0-100 */
  activity: number;
  /** 新鲜度分 0-100 */
  recency: number;
  /** 精简度分 0-100 */
  uniqueness: number;
  /** 健康等级 */
  level: "excellent" | "good" | "fair" | "poor";
}

/** 获取某 URL 近 N 天的激活总次数 */
function getActivationCount(
  url: string,
  stats: StatsData | null,
  days = 7,
): number {
  if (!stats?.daily) return 0;
  const cutoff = new Date(Date.now() - days * 86400_000);
  const cutoffKey = toDayKey(cutoff);
  let total = 0;
  for (const record of stats.daily) {
    if (record.day >= cutoffKey) {
      total += record.counts[url] ?? 0;
    }
  }
  return total;
}

function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 计算单个标签页的健康评分。
 *
 * @param tab 标签页数据
 * @param allTabs 所有标签页（用于检测重复）
 * @param stats 统计数据（可选，用于活跃度评分）
 * @param dedupStrictness 去重严格度
 */
export function calcTabHealth(
  tab: LiveTab,
  allTabs: LiveTab[],
  stats: StatsData | null,
  dedupStrictness: "strict" | "loose" | "off" = "loose",
): TabHealthScore {
  // 1. 活跃度评分（0-40 占比）
  const activationCount = getActivationCount(tab.url, stats);
  // 归一化：0-5+ 次 → 0-40 分
  const activity = Math.min(40, activationCount * 8);

  // 2. 新鲜度评分（0-40 占比）
  const hoursSinceAccess = tab.lastAccessed > 0
    ? (Date.now() - tab.lastAccessed) / 3600_000
    : 999;
  // 1h → 40, 1d → 30, 3d → 20, 7d → 10, 14d+ → 0
  const recency = hoursSinceAccess < 1 ? 40
    : hoursSinceAccess < 24 ? 40 - (hoursSinceAccess / 24) * 10
    : hoursSinceAccess < 72 ? 30 - ((hoursSinceAccess - 24) / 48) * 10
    : hoursSinceAccess < 168 ? 20 - ((hoursSinceAccess - 72) / 96) * 10
    : Math.max(0, 10 - ((hoursSinceAccess - 168) / 168) * 10);

  // 3. 精简度评分（0-20 占比）
  let uniqueness = 20;
  if (dedupStrictness !== "off") {
    const dupGroups = findDuplicates(allTabs, dedupStrictness);
    for (const group of dupGroups) {
      if (group.tabs.some((t) => t.id === tab.id)) {
        // 多个重复 → 扣分
        uniqueness = Math.max(0, 20 - (group.tabs.length - 1) * 5);
        break;
      }
    }
  }

  const total = Math.round(activity + recency + uniqueness);

  // 固定标签更健康
  const finalTotal = tab.pinned ? Math.min(100, total + 5) : total;

  let level: TabHealthScore["level"] = "poor";
  if (finalTotal >= 80) level = "excellent";
  else if (finalTotal >= 60) level = "good";
  else if (finalTotal >= 40) level = "fair";

  return {
    total: Math.round(finalTotal),
    activity: Math.round(activity),
    recency: Math.round(recency),
    uniqueness: Math.round(uniqueness),
    level,
  };
}
