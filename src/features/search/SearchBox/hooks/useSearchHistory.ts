/**
 * useSearchHistory Hook
 *
 * 管理搜索历史相关的状态和操作：
 * - 最近搜索词
 * - 历史记录权限
 * - 历史记录条目
 * - 热词聚合
 */

import { useState, useEffect, useCallback } from "react";
import type { HistorySearchEntry } from "@/chrome";
import type { ClosedTabRecord } from "@/shared/types";
import {
  hasHistoryPermission,
  requestHistoryPermission,
  searchHistoryEntries,
  storageGet,
} from "@/chrome";
import { getRecentSearches, getSearchHistory, getClosedTabs } from "@/repositories";
import type { TrendingCache } from "@/shared/types";
import { STORAGE_KEYS } from "@/shared/config/storage-keys";
import { fetchMultipleBoards } from "@/services/trending-service";

const SEARCH_DEBOUNCE_MS = 180;
const SEARCH_TRENDING_PLATFORMS = ["weibo", "baidu", "toutiao"];

interface UseSearchHistoryProps {
  open: boolean;
  useHistorySuggestions: boolean;
  effectiveHotSource: string;
  debouncedQuery: string;
  setDebouncedQuery: (query: string) => void;
}

interface UseSearchHistoryReturn {
  recentSearches: string[];
  setRecentSearches: (updater: (prev: string[]) => string[]) => void;
  historyForHot: Array<{ query: string; ts: number; count: number }>;
  trendingCache: TrendingCache | undefined;
  historyPermission: boolean | null;
  setHistoryPermission: (permission: boolean | null) => void;
  historyEntries: HistorySearchEntry[];
  setHistoryEntries: (updater: (prev: HistorySearchEntry[]) => HistorySearchEntry[]) => void;
  historyLoading: boolean;
  setHistoryLoading: (loading: boolean) => void;
  closedTabRecords: ClosedTabRecord[];
  setClosedTabRecords: (updater: (prev: ClosedTabRecord[]) => ClosedTabRecord[]) => void;
  handleDebouncedQuery: (query: string) => void;
  enableHistorySuggestions: () => Promise<void>;
}

/**
 * 搜索历史 Hook
 *
 * @param props - Hook 配置
 * @param props.open
 * @param props.useHistorySuggestions
 * @param props.effectiveHotSource
 * @param props.debouncedQuery
 * @param props.setDebouncedQuery
 * @returns 历史相关状态和操作
 */
export function useSearchHistory({
  open,
  useHistorySuggestions,
  effectiveHotSource,
  debouncedQuery,
  setDebouncedQuery,
}: UseSearchHistoryProps): UseSearchHistoryReturn {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  /** 本地热词聚合需要完整的 SearchHistoryEntry（带 count + ts），不能复用 recentSearches */
  const [historyForHot, setHistoryForHot] = useState<
    Array<{ query: string; ts: number; count: number }>
  >([]);
  const [trendingCache, setTrendingCache] = useState<TrendingCache | undefined>(undefined);
  const [historyPermission, setHistoryPermission] = useState<boolean | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistorySearchEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  /** 「最近关闭」：输入为空时作为 section 展示；有输入时也作为补充候选 */
  const [closedTabRecords, setClosedTabRecords] = useState<ClosedTabRecord[]>([]);

  /**
   * 打开搜索框时加载最近搜索词。
   */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    void getRecentSearches().then((items) => {
      if (!cancelled) {
        setRecentSearches(items);
      }
    });
    // 并行加载完整历史记录，供热词聚合使用
    void getSearchHistory().then((entries) => {
      if (!cancelled) {
        setHistoryForHot(entries);
      }
    });
    // 加载「最近关闭」
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
   * 全网热门话题：优先读后台定时刷新的热榜缓存；没有缓存时主动拉取一组综合热榜。
   */
  useEffect(() => {
    if (!open || effectiveHotSource !== "trending") return;
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
   * 打开搜索框时检查历史记录权限。
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
   * 对历史记录查询做轻微防抖，避免每个键都触发权限能力调用。
   * @param query
   */
  const handleDebouncedQuery = (query: string) => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  };

  /**
   * 拉取历史建议。
   */
  useEffect(() => {
    if (!open || !useHistorySuggestions || historyPermission !== true) return;
    let cancelled = false;

    setHistoryLoading(true);
    void searchHistoryEntries(debouncedQuery, debouncedQuery === "" ? 5 : 6)
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

  /**
   * 申请历史记录权限。
   */
  const enableHistorySuggestions = useCallback(async () => {
    const granted = await requestHistoryPermission();
    setHistoryPermission(granted);
    if (granted) {
      const entries = await searchHistoryEntries(debouncedQuery, debouncedQuery === "" ? 5 : 6);
      setHistoryEntries(entries);
    }
  }, [debouncedQuery]);

  return {
    recentSearches,
    setRecentSearches,
    historyForHot,
    trendingCache,
    historyPermission,
    setHistoryPermission,
    historyEntries,
    setHistoryEntries,
    historyLoading,
    setHistoryLoading,
    closedTabRecords,
    setClosedTabRecords,
    handleDebouncedQuery,
    enableHistorySuggestions,
  };
}
