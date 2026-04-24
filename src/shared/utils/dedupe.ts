/**
 * Dedup utilities — Detect duplicate tabs with configurable strictness
 *
 * 三档策略（F-13）：
 *   - 'strict'：URL 完全匹配
 *   - 'loose'（默认）：忽略 #hash + utm_* / fbclid / gclid
 *   - 'off'：禁用重复检测，返回空数组
 */

import type { LiveTab } from '@/shared/types';

export type DedupStrictness = 'strict' | 'loose' | 'off';

/** Tracking parameters to strip for loose dedup */
const TRACKING_PARAMS = /^(utm_\w+|fbclid|gclid|mc_eid|mc_cid|ref|source)$/i;

/** Normalize a URL for dedup comparison based on strictness */
export function normalizeUrl(url: string, strictness: DedupStrictness): string {
  if (strictness === 'strict') {
    return url;
  }
  try {
    const parsed = new URL(url);
    // Remove hash
    parsed.hash = '';
    // Remove tracking params
    const params = new URLSearchParams();
    for (const [key, value] of parsed.searchParams.entries()) {
      if (!TRACKING_PARAMS.test(key)) {
        params.set(key, value);
      }
    }
    parsed.search = params.toString();
    // Sort params for consistent comparison
    parsed.searchParams.sort();
    return parsed.toString().replace(/\/+$/, ''); // Remove trailing slashes
  } catch {
    return url;
  }
}

export interface DupGroup {
  canonicalUrl: string;
  tabs: LiveTab[];
}

/**
 * Find duplicate tab groups.
 * @param tabs 实时标签数组
 * @param strictness 三档严格度，默认 'loose'（向前兼容）
 */
export function findDuplicates(tabs: LiveTab[], strictness: DedupStrictness = 'loose'): DupGroup[] {
  if (strictness === 'off') return [];

  const urlMap = new Map<string, LiveTab[]>();

  for (const tab of tabs) {
    const key = normalizeUrl(tab.url, strictness);
    const existing = urlMap.get(key) ?? [];
    existing.push(tab);
    urlMap.set(key, existing);
  }

  return Array.from(urlMap.entries())
    .filter(([, groupTabs]) => groupTabs.length > 1)
    .map(([canonicalUrl, groupTabs]) => ({ canonicalUrl, tabs: groupTabs }));
}

/**
 * 根据严格度统计"可合并的重复数" = 所有重复组内 (tabs.length - 1) 的总和。
 * 用于 Dashboard 的"重复 N"徽标。
 */
export function countDuplicates(tabs: LiveTab[], strictness: DedupStrictness = 'loose'): number {
  const groups = findDuplicates(tabs, strictness);
  return groups.reduce((sum, g) => sum + g.tabs.length - 1, 0);
}
