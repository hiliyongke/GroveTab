/**
 * 日期工具函数
 *
 * 统一项目中多处重复的日期格式化逻辑：
 * - stats-slice.ts 中的 toDayStr()
 * - sw/index.ts 中的 todayStr()
 * - history-repo.ts 中的 snapshotDateKey()
 */

/**
 * 将 Date 格式化为 YYYY-MM-DD（按本地时区）
 *
 * @param d - 日期对象
 * @returns YYYY-MM-DD 格式字符串
 *
 * @example
 * toDayStr(new Date(2026, 4, 24)) // => "2026-05-24"
 */
export function toDayStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 获取今天的日期字符串（YYYY-MM-DD，本地时区）
 */
export function todayStr(): string {
  return toDayStr(new Date());
}

/**
 * 根据时间戳生成快照日期 key（YYYY-MM-DD）
 *
 * @param ts - 可选的时间戳（默认 Date.now()）
 * @returns YYYY-MM-DD 格式字符串
 */
export function snapshotDateKey(ts: number = Date.now()): string {
  return toDayStr(new Date(ts));
}
