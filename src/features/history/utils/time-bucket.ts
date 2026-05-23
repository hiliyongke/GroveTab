/**
 * time-bucket —— 将时间戳分组到「今天 / 昨天 / 本周 / 更早」
 *
 * "时间分组"对应的展示顺序与标签 key
 */

export type TimeBucketId = 'today' | 'yesterday' | 'thisWeek' | 'earlier';

/** 时间分组的定义：id 与 i18n key */
export const TIME_GROUPS: Array<{ id: TimeBucketId; labelKey: string }> = [
  { id: 'today', labelKey: 'history.groupToday' },
  { id: 'yesterday', labelKey: 'history.groupYesterday' },
  { id: 'thisWeek', labelKey: 'history.groupThisWeek' },
  { id: 'earlier', labelKey: 'history.groupEarlier' },
];

/**
 * 将时间戳映射到时间桶
 * @param ts - 毫秒时间戳
 * @returns {TimeBucketId} 返回时间桶标识符
 */
export function bucketize(ts: number): TimeBucketId {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 3600 * 1000;
  const thisWeekStart = todayStart - 6 * 24 * 3600 * 1000;
  if (ts >= todayStart) return 'today';
  if (ts >= yesterdayStart) return 'yesterday';
  if (ts >= thisWeekStart) return 'thisWeek';
  return 'earlier';
}
