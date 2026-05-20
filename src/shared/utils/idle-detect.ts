/**
 * idle-detect —— 闲置标签页检测
 *
 * 基于 `lastAccessed` 时间戳计算"闲置指数"。
 *
 * 闲置等级（相对于 threshold）：
 *   - idle：超过 threshold 未访问
 *   - stale：超过 threshold × 7 未访问（或硬上限 7 天，取最小）
 *
 * threshold 默认 24 小时；可通过 `settings.idleThresholdMinutes` 覆盖。
 */

import type { LiveTab } from '@/shared/types';

/** 闲置等级 */
type IdleLevel = 'idle' | 'stale';

/** 闲置标签信息 */
export interface IdleTabInfo {
  tab: LiveTab;
  level: IdleLevel;
  /** 最后访问距今的小时数 */
  hoursSinceAccess: number;
}

const DEFAULT_IDLE_MINUTES = 1440; // 24h
const STALE_CAP_MS = 7 * 24 * 60 * 60 * 1000; // 7 天硬上限

/**
 * 检测闲置标签页
 *
 * @param tabs 所有标签页
 * @param thresholdMinutes 自定义 idle 阈值（分钟）；默认 24h
 * @returns 按闲置等级分组的标签列表，stale 优先（更紧迫）
 */
export function detectIdleTabs(tabs: LiveTab[], thresholdMinutes?: number): IdleTabInfo[] {
  const minutes = thresholdMinutes !== undefined && thresholdMinutes > 0 ? thresholdMinutes : DEFAULT_IDLE_MINUTES;
  const idleMs = minutes * 60 * 1000;
  const staleMs = Math.max(idleMs * 7, STALE_CAP_MS);

  const now = Date.now();
  const result: IdleTabInfo[] = [];

  for (const tab of tabs) {
    // 固定标签不标记闲置
    if (tab.pinned) continue;
    // 已休眠的不重复标记
    if (tab.discarded === true) continue;

    const elapsed = now - tab.lastAccessed;

    if (elapsed >= staleMs) {
      result.push({
        tab,
        level: 'stale',
        hoursSinceAccess: Math.round(elapsed / (60 * 60 * 1000)),
      });
    } else if (elapsed >= idleMs) {
      result.push({
        tab,
        level: 'idle',
        hoursSinceAccess: Math.round(elapsed / (60 * 60 * 1000)),
      });
    }
  }

  // stale 优先排序
  return result.sort((a, b) => {
    if (a.level !== b.level) return a.level === 'stale' ? -1 : 1;
    return b.hoursSinceAccess - a.hoursSinceAccess;
  });
}

/**
 * 格式化闲置时间为友好字符串
 */
export function formatIdleTime(hours: number): string {
  if (hours < 48) return `${hours} 小时`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} 天`;
  const weeks = Math.round(days / 7);
  return `${weeks} 周`;
}
