/**
 * formatRelativeTime — 统一的相对时间格式化工具
 *
 * 原有 3 个不同实现（TrashView / WindowSnapshotPanel / HistoryView），现统一为单一函数。
 */
type TFunction = (key: string, params?: Record<string, string | number>) => string;

export function formatRelativeTime(
  ts: number,
  t: TFunction,
): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t("time.justNow", { defaultValue: "刚刚" });
  if (minutes < 60) return t("time.minutesAgo", { n: minutes, defaultValue: "{n} 分钟前" });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("time.hoursAgo", { n: hours, defaultValue: "{n} 小时前" });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("time.daysAgo", { n: days, defaultValue: "{n} 天前" });
  const date = new Date(ts);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
