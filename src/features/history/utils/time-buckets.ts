/**
 * time-buckets.ts — 时间桶分类
 *
 * 把任意时间戳映射到「今天 / 昨天 / 本周 / 更早」四个桶，
 * 用于历史视图的分组渲染。
 *
 * 注意：所有阈值（24h、6 天）都是基于"用户打开面板"的当下时间，
 * 因此无需持久化或重算。
 */

export type TimeBucket = "today" | "yesterday" | "thisWeek" | "earlier";

const DAY_MS = 24 * 3600 * 1000;

/** 把毫秒时间戳归到四个时间桶之一 */
export function bucketize(ts: number): TimeBucket {
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const yesterdayStart = todayStart - DAY_MS;
  const thisWeekStart = todayStart - 6 * DAY_MS;
  if (ts >= todayStart) return "today";
  if (ts >= yesterdayStart) return "yesterday";
  if (ts >= thisWeekStart) return "thisWeek";
  return "earlier";
}

/** 顺序遍历的时间桶 ID */
export const TIME_BUCKET_ORDER: readonly TimeBucket[] = [
  "today",
  "yesterday",
  "thisWeek",
  "earlier",
] as const;
