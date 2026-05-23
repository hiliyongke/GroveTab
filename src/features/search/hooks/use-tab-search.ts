/**
 * Hook for computing filtered and sorted tab search results.
 * Handles MiniSearch querying, pinyin matching, tag-scoped matching, fallback filtering, and sorting.
 */

import { useMemo } from 'react';
import type { LiveTab, SearchScopeField, SearchSortMode } from '@/shared/types';
import { useT } from '@/shared/i18n';
import {
  normalizeMetadataKey,
  normalizeSearchText,
  type PinyinMatchFn,
  type SearchIndexLike,
  type UniversalSearchItem,
} from '../utils/search-helpers';

interface UseTabSearchOptions {
  /** Current open tabs */
  tabs: LiveTab[];
  /** Raw search query string */
  query: string;
  /** Built MiniSearch index (or null if not ready) */
  searchIndex: SearchIndexLike | null;
  /** Pinyin match function (or null if pinyin is disabled/not loaded) */
  pinyinMatchFn: PinyinMatchFn | null;
  /** Which fields to search in */
  searchScope: SearchScopeField[];
  /** Sort mode for results */
  searchSortBy: SearchSortMode;
  /** Tag data indexed by normalized URL */
  tagsByUrl: Record<string, string[]>;
  /** Whether pinyin search is enabled */
  enablePinyin: boolean;
}

/**
 * Computes filtered and sorted tab search results based on query and search configuration.
 *
 * Search strategy (in order of priority):
 * 1. Tag-scoped query (e.g. "tag:work") — matches tags only
 * 2. MiniSearch fuzzy/prefix query — uses the pre-built index
 * 3. Pinyin matching — supplements MiniSearch results when enabled
 * 4. Tag matching — supplements with tag-based matches
 * 5. Fallback filtering — plain substring match when MiniSearch returns no results
 * @param root0
 * @param root0.tabs
 * @param root0.query
 * @param root0.searchIndex
 * @param root0.pinyinMatchFn
 * @param root0.searchScope
 * @param root0.searchSortBy
 * @param root0.tagsByUrl
 * @param root0.enablePinyin
 * @returns {void} 无返回值
 */
export function useTabSearch({
  tabs,
  query,
  searchIndex,
  pinyinMatchFn,
  searchScope,
  searchSortBy,
  tagsByUrl,
  enablePinyin,
}: UseTabSearchOptions): UniversalSearchItem[] {
  const { t } = useT();

  return useMemo<UniversalSearchItem[]>(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery === '') return [];

    const lowerQuery = normalizedQuery.toLowerCase();
    const scopeSet = new Set<SearchScopeField>(searchScope);
    const matchTitle = scopeSet.has('title');
    const matchHostname = scopeSet.has('hostname');
    const matchUrl = scopeSet.has('url');

    // Parse tag-scoped query: "tag:xxx" or "tag：xxx"
    const tagScopedMatch = /^tag[:：]\s*(.*)$/i.exec(normalizedQuery);
    const isTagScopedQuery = tagScopedMatch !== null;
    const tagScopedQuery = isTagScopedQuery ? (tagScopedMatch[1] ?? '').trim() : '';
    const searchText = isTagScopedQuery ? tagScopedQuery : normalizedQuery;
    const lowerSearchText = normalizeSearchText(searchText);

    const getTabTags = (tab: LiveTab) => tagsByUrl[normalizeMetadataKey(tab.url)] ?? [];
    const getMatchedTags = (tab: LiveTab) => {
      if (lowerSearchText === '') return [];
      return getTabTags(tab).filter((tag) => normalizeSearchText(tag).includes(lowerSearchText));
    };
    const hasTagMatch = (tab: LiveTab) => getMatchedTags(tab).length > 0;

    const sortTabs = (items: LiveTab[]) => {
      if (searchSortBy === 'recentAccess') {
        items.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
      }
      return items;
    };

    const toItem = (tab: LiveTab): UniversalSearchItem => {
      const matchedTags = getMatchedTags(tab);
      return {
        id: `tab-${tab.id}`,
        type: 'tab',
        title: tab.title,
        subtitle: tab.hostname,
        tab,
        badge: tab.isCurrentWindow ? undefined : t('tabs.otherWindow'),
        matchedTags,
      };
    };

    // Tag-scoped query: only match tags
    if (isTagScopedQuery) {
      if (lowerSearchText === '') return [];
      return sortTabs(tabs.filter(hasTagMatch)).map(toItem);
    }

    // MiniSearch query
    try {
      const miniResults: Array<{ id: number }> = searchIndex?.search(normalizedQuery) ?? [];
      if (miniResults.length > 0) {
        const byId = new Map(tabs.map((tab) => [tab.id, tab] as const));
        let matchedTabs = miniResults
          .map((item) => byId.get(item.id))
          .filter((item): item is LiveTab => item !== undefined);

        const existingIds = new Set(matchedTabs.map((item) => item.id));

        // Supplement with pinyin matches
        if (enablePinyin && pinyinMatchFn !== null) {
          const extras = tabs.filter((tab) => {
            if (existingIds.has(tab.id)) return false;
            const matchesTitle = matchTitle && pinyinMatchFn(tab.title, normalizedQuery);
            const matchesHostname = matchHostname && pinyinMatchFn(tab.hostname, normalizedQuery);
            return matchesTitle || matchesHostname;
          });
          extras.forEach((item) => existingIds.add(item.id));
          matchedTabs = [...matchedTabs, ...extras];
        }

        // Supplement with tag matches
        const tagMatchedTabs = tabs.filter((tab) => !existingIds.has(tab.id) && hasTagMatch(tab));
        matchedTabs = [...matchedTabs, ...tagMatchedTabs];

        return sortTabs(matchedTabs).map(toItem);
      }
    } catch {
      /* MiniSearch error → fall through to fallback */
    }

    // Fallback: plain substring match
    const fallbackTabs = tabs.filter((tab) => {
      if (hasTagMatch(tab)) return true;
      if (matchTitle) {
        const titleMatched = tab.title.toLowerCase().includes(lowerQuery);
        if (titleMatched) return true;
        if (enablePinyin && pinyinMatchFn?.(tab.title, normalizedQuery)) return true;
      }
      if (matchHostname) {
        const hostnameMatched = tab.hostname.toLowerCase().includes(lowerQuery);
        if (hostnameMatched) return true;
        if (enablePinyin && pinyinMatchFn?.(tab.hostname, normalizedQuery)) return true;
      }
      if (matchUrl && tab.url.toLowerCase().includes(lowerQuery)) return true;
      return false;
    });

    return sortTabs(fallbackTabs).map(toItem);
  }, [enablePinyin, pinyinMatchFn, query, searchIndex, searchScope, searchSortBy, t, tabs, tagsByUrl]);
}
