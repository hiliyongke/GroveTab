/**
 * Hook for building and managing the MiniSearch index for tab search.
 * Handles dynamic import, content fingerprint optimization, and cleanup.
 */

import { useState, useEffect, useMemo } from 'react';
import type { LiveTab, SearchScopeField } from '@/shared/types';
import type { SearchIndexLike } from '../utils/search-helpers';

interface UseSearchIndexOptions {
  /** Current open tabs */
  tabs: LiveTab[];
  /** Which fields to include in the search index */
  searchScope: SearchScopeField[];
  /** Whether the search box is open (index is only built when open) */
  open: boolean;
}

interface UseSearchIndexReturn {
  /** The built search index, or null if not yet ready */
  searchIndex: SearchIndexLike | null;
  /** Whether the index has been built and is ready for queries */
  indexReady: boolean;
}

/**
 * Builds and manages a MiniSearch index for tab search.
 *
 * Performance note: The tabs array reference changes on every store update,
 * even when search-relevant content hasn't changed. This hook uses a content
 * fingerprint (id/title/hostname/url) to avoid unnecessary index rebuilds.
 * @param root0
 * @param root0.tabs
 * @param root0.searchScope
 * @param root0.open
 * @returns {void} 无返回值
 */
export function useSearchIndex({ tabs, searchScope, open }: UseSearchIndexOptions): UseSearchIndexReturn {
  /**
   * Content fingerprint for tabs — only includes fields that affect search results.
   * This prevents index rebuilds when only non-search fields change (e.g. lastAccessed, audible).
   */
  const tabsIndexSignature = useMemo(
    () => `${tabs.length}|${tabs.map((t) => `${t.id}:${t.title}:${t.hostname}:${t.url}`).join('\u0001')}`,
    [tabs],
  );

  const [searchIndex, setSearchIndex] = useState<SearchIndexLike | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const { default: MS } = await import('minisearch');
      if (cancelled) return;
      const fields = searchScope.length > 0 ? [...searchScope] : ['title'];
      const ms = new MS({
        fields,
        storeFields: ['id'],
        searchOptions: { fuzzy: 0.2, prefix: true },
      });
      if (tabs.length > 0) {
        ms.addAll(
          tabs.map((tab) => ({
            id: tab.id,
            title: tab.title,
            hostname: tab.hostname,
            url: tab.url,
          })),
        );
      }
      if (!cancelled) {
        setSearchIndex(ms);
      }
    })();
    return () => {
      cancelled = true;
    };
    // tabs dependency is expressed indirectly via tabsIndexSignature; omitting tabs is intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, searchScope, tabsIndexSignature]);

  return {
    searchIndex,
    indexReady: searchIndex !== null,
  };
}
