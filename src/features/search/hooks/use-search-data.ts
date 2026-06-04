import { useState, useEffect } from "react";
import {
  hasHistoryPermission,
  requestHistoryPermission,
  searchHistoryEntries,
  storageGet,
  type HistorySearchEntry,
} from "@/chrome";
import { getRecentSearches, getSearchHistory, getClosedTabs } from "@/repositories";
import { getArchivedSessions } from "@/services/archive";
import type { ClosedTabRecord, TrendingCache, ArchivedSession } from "@/shared/types";
import { STORAGE_KEYS } from "@/shared/config/storage-keys";
import { fetchMultipleBoards } from "@/services/trending-service";
import type { HotKeywordSource } from "@/shared/config/search-engines";

export const SEARCH_TRENDING_PLATFORMS = ["weibo", "baidu", "toutiao"];
const SEARCH_DEBOUNCE_MS = 180;

export interface SearchDataState {
  recentSearches: string[];
  setRecentSearches: React.Dispatch<React.SetStateAction<string[]>>;
  historyForHot: Array<{ query: string; ts: number; count: number }>;
  trendingCache: TrendingCache | undefined;
  setTrendingCache: React.Dispatch<React.SetStateAction<TrendingCache | undefined>>;
  historyPermission: boolean | null;
  historyEntries: HistorySearchEntry[];
  historyLoading: boolean;
  closedTabRecords: ClosedTabRecord[];
  setClosedTabRecords: React.Dispatch<React.SetStateAction<ClosedTabRecord[]>>;
  debouncedQuery: string;
  setDebouncedQuery: React.Dispatch<React.SetStateAction<string>>;
  enableHistorySuggestions: () => Promise<void>;
  /** 归档会话列表（用于统一索引） */
  archiveSessions: ArchivedSession[];
}

export function useSearchData(options: {
  open: boolean;
  normalizedQuery: string;
  effectiveHotSource: HotKeywordSource;
  useHistorySuggestions: boolean;
  historyEnabled: boolean;
}): SearchDataState {
  const { open, normalizedQuery, effectiveHotSource, useHistorySuggestions } = options;

  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [historyForHot, setHistoryForHot] = useState<
    Array<{ query: string; ts: number; count: number }>
  >([]);
  const [trendingCache, setTrendingCache] = useState<TrendingCache | undefined>(undefined);
  const [historyPermission, setHistoryPermission] = useState<boolean | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistorySearchEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [closedTabRecords, setClosedTabRecords] = useState<ClosedTabRecord[]>([]);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [archiveSessions, setArchiveSessions] = useState<ArchivedSession[]>([]);

  // 打开时加载最近搜索、热词历史、最近关闭、归档会话
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void getRecentSearches().then((items) => {
      if (!cancelled) setRecentSearches(items);
    });
    void getSearchHistory().then((entries) => {
      if (!cancelled) setHistoryForHot(entries);
    });
    void getClosedTabs().then((tabs) => {
      if (!cancelled) setClosedTabRecords(tabs);
    });
    void getArchivedSessions().then((sessions) => {
      if (!cancelled) setArchiveSessions(sessions);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // 热榜缓存加载
  useEffect(() => {
    if (!open || effectiveHotSource !== "trending") return;
    let cancelled = false;
    void (async () => {
      const cached = await storageGet<TrendingCache>(STORAGE_KEYS.trendingCache);
      if (!cancelled && cached !== undefined) setTrendingCache(cached);
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

  // 检查历史记录权限
  useEffect(() => {
    if (!open || !useHistorySuggestions) return;
    let cancelled = false;
    void hasHistoryPermission().then((granted) => {
      if (!cancelled) setHistoryPermission(granted);
    });
    return () => {
      cancelled = true;
    };
  }, [open, useHistorySuggestions]);

  // 防抖 query
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setDebouncedQuery(normalizedQuery);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [open, normalizedQuery]);

  // 拉取历史建议
  useEffect(() => {
    if (!open || !useHistorySuggestions || historyPermission !== true) return;
    let cancelled = false;
    setHistoryLoading(true);
    void searchHistoryEntries(debouncedQuery, debouncedQuery === "" ? 5 : 6)
      .then((entries) => {
        if (!cancelled) setHistoryEntries(entries);
      })
      .catch(() => {
        if (!cancelled) setHistoryEntries([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, historyPermission, open, useHistorySuggestions]);

  const enableHistorySuggestions = async () => {
    const granted = await requestHistoryPermission();
    setHistoryPermission(granted);
    if (granted) {
      const entries = await searchHistoryEntries(debouncedQuery, debouncedQuery === "" ? 5 : 6);
      setHistoryEntries(entries);
    }
  };

  return {
    recentSearches,
    setRecentSearches,
    historyForHot,
    trendingCache,
    setTrendingCache,
    historyPermission,
    historyEntries,
    historyLoading,
    closedTabRecords,
    setClosedTabRecords,
    debouncedQuery,
    setDebouncedQuery,
    enableHistorySuggestions,
    archiveSessions,
  };
}
