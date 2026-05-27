/**
 * 标签页使用时长追踪类型定义
 *
 * 按 URL × day 聚合每日使用时长（毫秒）。
 * 数据在 Service Worker 中通过 chrome.tabs.onActivated 事件采集，
 * 定期 flush 到 chrome.storage.local。
 */

/** 单日某 URL 的使用时长记录 */
export interface DailyFocusTime {
  /** 日期，格式 YYYY-MM-DD */
  day: string;
  /** URL → 使用时长（毫秒） */
  byUrl: Record<string, number>;
}

/** 当前激活标签的聚焦会话（存于 chrome.storage.session，SW 挂起后保留） */
export interface ActiveFocusSession {
  tabId: number;
  url: string;
  activatedAt: number;
}

/** 使用时长数据整体结构 */
export interface FocusTimeData {
  daily: DailyFocusTime[];
  lastFlushAt: number;
}
