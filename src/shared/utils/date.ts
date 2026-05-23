/**
 * 日期格式化工具 —— 统一的日期键生成
 *
 * 消除 stats-slice / history-repo / sw/index.ts 中的重复实现。
 *
 * 两种模式：
 *   - UTC 模式：用于跨设备/跨时区一致性要求高的场景（统计数据、SW 周期任务）
 *   - 本地时区模式：用于面向用户的日期显示（历史快照、日视图分组）
 */

/**
 * 格式化为 YYYY-MM-DD（UTC）
 *
 * 用于统计数据、SW 周期任务等需要跨时区一致的场景。
 * @param date 可选，默认当前时间
 * @returns YYYY-MM-DD 格式日期字符串
 */
export function toDayStrUTC(date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * 格式化为 YYYY-MM-DD（本地时区）
 *
 * 用于面向用户的日期显示和分组。
 * @param date 可选，默认当前时间
 * @returns YYYY-MM-DD 格式日期字符串
 */
export function toDayStrLocal(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * 把时间戳格式化为 YYYY-MM-DD（本地时区）
 *
 * 兼容 history-repo.snapshotDateKey 的调用签名。
 * @param ts 可选时间戳，默认当前时间
 * @returns YYYY-MM-DD 格式日期字符串
 */
export function formatDateKey(ts: number = Date.now()): string {
  return toDayStrLocal(new Date(ts));
}

/**
 * 格式化为短日期时间（本地时区 + 本地化月份）
 *
 * 替代 date-fns 的 format(ts, 'MMM d, HH:mm', { locale }) 模式。
 * 支持中英文两种 locale：
 *   - zh-CN: "1月5日 14:30"
 *   - en:    "Jan 5, 14:30"
 *
 * @param ts 时间戳（毫秒）
 * @param locale 语言标识
 * @returns 本地化的短日期时间字符串
 */
export function formatShortDateTime(ts: number, locale: 'zh-CN' | 'en' = 'en'): string {
  const date = new Date(ts);
  const month = date.getMonth();
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  if (locale === 'zh-CN') {
    return `${month + 1}月${day}日 ${hours}:${minutes}`;
  }

  const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${MONTH_ABBR[month]} ${day}, ${hours}:${minutes}`;
}
