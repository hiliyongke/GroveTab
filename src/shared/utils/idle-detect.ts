/**
 * idle-detect —— 闲置标签页检测
 *
 * 基于 `lastAccessed` 时间戳计算"闲置指数"，帮助用户识别长期未用的标签页。
 *
 * 闲置等级：
 *   - idle：超过 1 天未访问（建议休眠）
 *   - stale：超过 7 天未访问（建议关闭或归档）
 *
 * 所有阈值均为可配置参数，未来可开放给用户自定义。
 */

import type { LiveTab } from '@/shared/types';

/** 闲置等级 */
export type IdleLevel = 'idle' | 'stale';

/** 闲置标签信息 */
export interface IdleTabInfo {
  tab: LiveTab;
  level: IdleLevel;
  /** 最后访问距今的小时数 */
  hoursSinceAccess: number;
}

/** 闲置阈值（毫秒） */
const IDLE_THRESHOLD = 24 * 60 * 60 * 1000; // 1 天
const STALE_THRESHOLD = 7 * 24 * 60 * 60 * 1000; // 7 天

/**
 * 检测闲置标签页
 *
 * @param tabs 所有标签页
 * @returns 按闲置等级分组的标签列表，stale 优先（更紧迫）
 */
export function detectIdleTabs(tabs: LiveTab[]): IdleTabInfo[] {
  const now = Date.now();
  const result: IdleTabInfo[] = [];

  for (const tab of tabs) {
    // 固定标签不标记闲置
    if (tab.pinned) continue;
    // 已休眠的不重复标记
    if (tab.discarded) continue;

    const elapsed = now - tab.lastAccessed;

    if (elapsed >= STALE_THRESHOLD) {
      result.push({
        tab,
        level: 'stale',
        hoursSinceAccess: Math.round(elapsed / (60 * 60 * 1000)),
      });
    } else if (elapsed >= IDLE_THRESHOLD) {
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
