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

/**
 * 为去重比较规范化 URL
 *
 * 根据严格度策略，移除 hash 和跟踪参数。
 *
 * @param url - 原始 URL
 * @param strictness - 严格度策略
 * @returns 规范化后的 URL 字符串
 */
export function normalizeUrl(url: string, strictness: DedupStrictness): string {
  if (strictness === 'strict') {
    return url;
  }
  try {
    const parsed = new URL(url);
    // 移除哈希
    parsed.hash = '';
    // 移除跟踪参数
    const params = new URLSearchParams();
    for (const [key, value] of parsed.searchParams.entries()) {
      if (!TRACKING_PARAMS.test(key)) {
        params.set(key, value);
      }
    }
    parsed.search = params.toString();
    // 排序参数以保持一致性
    parsed.searchParams.sort();
    return parsed.toString().replace(/\/+$/, ''); // 移除末尾斜杠
  } catch {
    return url;
  }
}

export interface DupGroup {
  canonicalUrl: string;
  tabs: LiveTab[];
}

/**
 * 查找重复标签页组
 *
 * 根据严格度策略，对标签页 URL 去重后找出重复组。
 *
 * @param tabs 实时标签数组
 * @param strictness 三档严格度，默认 'loose'（向前兼容）
 * @returns 重复标签组数组
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


