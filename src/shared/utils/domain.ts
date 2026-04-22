/**
 * Domain utilities — Extract registered domain using tldts
 */

import { parse } from 'tldts';

export interface DomainInfo {
  /** Full hostname (e.g. docs.google.com) */
  hostname: string;
  /** Registered domain (e.g. google.com) */
  registeredDomain: string;
  /** Subdomain (e.g. docs) */
  subdomain: string | null;
}

/**
 * Extract domain info from a URL
 */
export function getDomainInfo(url: string): DomainInfo {
  try {
    const parsed = parse(url);
    return {
      hostname: parsed.hostname ?? '',
      registeredDomain: parsed.domain ?? '',
      subdomain: parsed.subdomain ?? null,
    };
  } catch {
    return {
      hostname: '',
      registeredDomain: '',
      subdomain: null,
    };
  }
}

/**
 * Get the registered domain from a URL (e.g. "google.com" from "docs.google.com")
 */
export function getRegisteredDomain(url: string): string {
  return getDomainInfo(url).registeredDomain || getDomainInfo(url).hostname || 'other';
}

/**
 * Group tabs by registered domain
 */
export interface DomainGroup {
  /** Registered domain (group key) */
  domain: string;
  /** Tabs belonging to this domain */
  tabs: import('@/shared/types').LiveTab[];
  /** Whether the group is collapsed */
  collapsed: boolean;
}

import type { LiveTab } from '@/shared/types';

export function groupTabsByDomain(tabs: LiveTab[]): DomainGroup[] {
  const groupMap = new Map<string, LiveTab[]>();

  for (const tab of tabs) {
    const domain = getRegisteredDomain(tab.url);
    const existing = groupMap.get(domain) || [];
    existing.push(tab);
    groupMap.set(domain, existing);
  }

  // Convert to array and sort: most tabs first, then by most recent activation
  const groups: DomainGroup[] = Array.from(groupMap.entries()).map(([domain, groupTabs]) => ({
    domain,
    tabs: groupTabs.sort((a, b) => b.lastAccessed - a.lastAccessed),
    collapsed: false,
  }));

  groups.sort((a, b) => {
    // More tabs = higher priority
    if (b.tabs.length !== a.tabs.length) return b.tabs.length - a.tabs.length;
    // Then by most recent activation in the group
    const aLatest = a.tabs[0]?.lastAccessed ?? 0;
    const bLatest = b.tabs[0]?.lastAccessed ?? 0;
    return bLatest - aLatest;
  });

  return groups;
}

/**
 * Get the "best" favicon for a domain group (first tab's favicon)
 */
export function getGroupFavicon(tabs: LiveTab[]): string {
  return tabs[0]?.favIconUrl || '';
}
