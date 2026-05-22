/**
 * Stats Type Definitions
 * 统计数据相关类型 (F-11)
 */

/** 按 URL × day 聚合的激活次数 */
export interface StatsRecord {
  /** 日期字符串 YYYY-MM-DD */
  day: string;
  /** URL → 激活次数 */
  counts: Record<string, number>;
}

export interface StatsData {
  /** 最近 30 天的日统计 */
  daily: StatsRecord[];
  /** 最近一次持久化时间 */
  lastFlushAt: number;
}
