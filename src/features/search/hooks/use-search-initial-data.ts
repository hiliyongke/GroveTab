/**
 * Hook for loading initial search data when the search box opens.
 * Handles recent searches, closed tabs, trending cache, history permission, and history suggestions.
 */

import { useState, useEffect } from 'react';
import type { TrendingCache, ClosedTabRecord, SearchHistoryEntry } from '@/shared/types';
import type { HistorySearchEntry } from '@/chrome';
import { hasHistoryPermission, searchHistoryEntries, storageGet } from '@/chrome';
import { getRecentSearches, getSearchHistory, getClosedTabs } from '@/repositories';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';
import { fetchMultipleBoards } from '@/services/trending-service';
import type { HotKeywordSource } from '@/shared/config/search-engines';
import { SEARCH_CONSTANTS } from '@/shared/config/constants';

/** Debounce delay (ms) for history search queries */
const SEARCH_DEBOUNCE_MS = SEARCH_CONSTANTS.DEBOUNCE_MS;

/** Platforms to fetch trending data from when cache is empty */
const SEARCH_TRENDING_PLATFORMS = ['weibo', 'baidu', 'toutiao'];

interface UseSearchInitialDataOptions {
  /** Whether the search box is open */
  open: boolean;
  /** Whether history suggestions are enabled in settings */
  useHistorySuggestions: boolean;
  /** Effective hot keyword source (after resolving old/new settings compatibility) */
  effectiveHotSource: HotKeywordSource;
  /** Normalized (trimmed) query string, used for debouncing and history search */
  normalizedQuery: string;
}

interface UseSearchInitialDataReturn {
  /** Recent search keywords */
  recentSearches: string[];
  /** Setter for recent searches (used after web search to update the list) */
  setRecentSearches: React.Dispatch<React.SetStateAction<string[]>>;
  /** Recently closed tab records */
  closedTabRecords: ClosedTabRecord[];
  /** Setter for closed tab records (used after restoring a closed tab) */
  setClosedTabRecords: React.Dispatch<React.SetStateAction<ClosedTabRecord[]>>;
  /** Browser history entries matching current query */
  historyEntries: HistorySearchEntry[];
  /** Setter for history entries (used after enabling history permission) */
  setHistoryEntries: React.Dispatch<React.SetStateAction<HistorySearchEntry[]>>;
  /** Whether history entries are currently being fetched */
  historyLoading: boolean;
  /** History permission state: null = not checked, true = granted, false = denied */
  historyPermission: boolean | null;
  /** Setter for history permission (used after requesting permission) */
  setHistoryPermission: React.Dispatch<React.SetStateAction<boolean | null>>;
  /** Full search history for hot keyword aggregation */
  historyForHot: SearchHistoryEntry[];
  /** Trending cache data */
  trendingCache: TrendingCache | undefined;
  /** Debounced query string for history search */
  debouncedQuery: string;
}

/**
 * Loads and manages initial search data when the search box opens.
 *
 * On open, this hook parallelizes loading of:
 * - Recent search keywords (from local storage)
 * - Full search history (for hot keyword aggregation)
 * - Recently closed tabs
 * - Trending cache (when hotSuggestionSource is 'trending')
 * - History permission check (when history suggestions are enabled)
 *
 * It also manages query debouncing and fetching of browser history suggestions.
 * @param root0
 * @param root0.open
 * @param root0.useHistorySuggestions
 * @param root0.effectiveHotSource
 * @param root0.normalizedQuery
 * @returns {void} 无返回值
 */
export function useSearchInitialData({
  open,
  useHistorySuggestions,
  effectiveHotSource,
  normalizedQuery,
}: UseSearchInitialDataOptions): UseSearchInitialDataReturn {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [historyForHot, setHistoryForHot] = useState<SearchHistoryEntry[]>([]);
  const [trendingCache, setTrendingCache] = useState<TrendingCache | undefined>(undefined);
  const [historyPermission, setHistoryPermission] = useState<boolean | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistorySearchEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [closedTabRecords, setClosedTabRecords] = useState<ClosedTabRecord[]>([]);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  /**
   * Load recent searches, search history (for hot keywords), and closed tabs when the search box opens.
   */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void getRecentSearches().then((items) => {
      if (!cancelled) {
        setRecentSearches(items);
      }
    });
    // Load full search history for hot keyword aggregation
    void getSearchHistory().then((entries) => {
      if (!cancelled) {
        setHistoryForHot(entries);
      }
    });
    // Load recently closed tabs
    void getClosedTabs().then((tabs) => {
      if (!cancelled) {
        setClosedTabRecords(tabs);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  /**
   * Load trending cache: prefer background-refreshed cache; fetch on demand if empty.
   */
  useEffect(() => {
    if (!open || effectiveHotSource !== 'trending') return;
    let cancelled = false;
    void (async () => {
      const cached = await storageGet<TrendingCache>(STORAGE_KEYS.trendingCache);
      if (!cancelled && cached !== undefined) {
        setTrendingCache(cached);
      }
      if (cached !== undefined && Object.keys(cached.boards).length > 0) return;
      const boards = await fetchMultipleBoards(SEARCH_TRENDING_PLATFORMS, 3);
      if (!cancelled && Object.keys(boards).length > 0) {
        setTrendingCache({ boards, lastRefreshAt: Date.now() });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveHotSource, open]);

  /**
   * Check history permission when the search box opens and history suggestions are enabled.
   */
  useEffect(() => {
    if (!open || !useHistorySuggestions) return;
    let cancelled = false;
    void hasHistoryPermission().then((granted) => {
      if (!cancelled) {
        setHistoryPermission(granted);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, useHistorySuggestions]);

  /**
   * Debounce the normalized query to avoid triggering history search on every keystroke.
   */
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setDebouncedQuery(normalizedQuery);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [open, normalizedQuery]);

  /**
   * Fetch history suggestions based on the debounced query.
   * Clears old results immediately when query changes to avoid stale display.
   */
  useEffect(() => {
    if (!open || !useHistorySuggestions || historyPermission !== true) return;
    let cancelled = false;
    setHistoryLoading(true);
    void searchHistoryEntries(debouncedQuery, debouncedQuery === '' ? 5 : 6)
      .then((entries) => {
        if (!cancelled) {
          setHistoryEntries(entries);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHistoryEntries([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, historyPermission, open, useHistorySuggestions]);

  return {
    recentSearches,
    setRecentSearches,
    closedTabRecords,
    setClosedTabRecords,
    historyEntries,
    setHistoryEntries,
    historyLoading,
    historyPermission,
    setHistoryPermission,
    historyForHot,
    trendingCache,
    debouncedQuery,
  };
}
