/**
 * Dedup utilities — Detect duplicate tabs with configurable strictness
 *
 * 三档策略（F-13）：
 *   - 'strict'：URL 完全匹配
 *   - 'loose'（默认）：忽略 #hash + utm_* / fbclid / gclid
 *   - 'off'：禁用重复检测，返回空数组
 *
 * URL 归一化逻辑委托给 @/shared/utils/url 中的统一实现。
 */

import type { LiveTab } from "@/shared/types";
import type { DedupStrictness } from "@/shared/utils/url";
import { normalizeUrl } from "@/shared/utils/url";
export type { DedupStrictness } from "@/shared/utils/url";
export { normalizeUrl } from "@/shared/utils/url";

export interface DupGroup {
  canonicalUrl: string;
  tabs: LiveTab[];
}

/**
 * Find duplicate tab groups.
 * @param tabs 实时标签数组
 * @param strictness 三档严格度，默认 'loose'（向前兼容）
 */
export function findDuplicates(tabs: LiveTab[], strictness: DedupStrictness = "loose"): DupGroup[] {
  if (strictness === "off") return [];

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
