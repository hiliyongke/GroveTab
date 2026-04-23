/**
 * Dedup utilities — Detect duplicate tabs with loose URL matching
 */

import type { LiveTab } from '@/shared/types';

/** Tracking parameters to strip for loose dedup */
const TRACKING_PARAMS = /^(utm_\w+|fbclid|gclid|mc_eid|mc_cid|ref|source)$/i;

/** Normalize a URL for dedup comparison */
function normalizeUrl(url: string): string {
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

/** Find duplicate tab groups (loose mode) */
export function findDuplicates(tabs: LiveTab[]): DupGroup[] {
  const urlMap = new Map<string, LiveTab[]>();

  for (const tab of tabs) {
    const key = normalizeUrl(tab.url);
    const existing = urlMap.get(key) || [];
    existing.push(tab);
    urlMap.set(key, existing);
  }

  return Array.from(urlMap.entries())
    .filter(([, groupTabs]) => groupTabs.length > 1)
    .map(([canonicalUrl, groupTabs]) => ({ canonicalUrl, tabs: groupTabs }));
}
