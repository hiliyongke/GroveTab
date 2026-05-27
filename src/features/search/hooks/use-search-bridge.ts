/**
 * useSearchBridgeSync
 *
 * 将 useUnifiedSearchIndex（Web Worker 异步搜索）的结果适配为
 * useSearchResults 期望的同步 SearchIndexLike 接口。
 *
 * 工作原理：
 *   · 使用 ref 缓存最近的搜索结果（避免重复 Worker 调用）
 *   · searchIndex.search() 实际上是同步返回 cache 中的结果
 *   · 每次 normalizedQuery 变化时，触发异步 searchUnified 并更新 cache
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useUnifiedSearchIndex } from "./use-unified-search-index";
import type { SearchIndexLike } from "./use-search-index";
import type { LiveTab, ArchivedSession } from "@/shared/types";

export function useSearchBridgeSync(options: {
  active: boolean;
  tabs: LiveTab[];
  archiveSessions: ArchivedSession[];
  normalizedQuery: string;
}): {
  searchIndex: SearchIndexLike | null;
  pinyinMatchFn: null;
  workerReady: boolean;
} {
  const { active, tabs, archiveSessions, normalizedQuery } = options;

  const { ready, searchUnified } = useUnifiedSearchIndex({
    active,
    tabs,
    archiveSessions,
  });

  const cacheRef = useRef<Map<string, Array<{ id: number }>>>(new Map());
  const [searchIndex, setSearchIndex] = useState<SearchIndexLike | null>(null);
  const searchTriggerRef = useRef<number>(0);

  // 同步适配器：返回 cache 中对应 query 的结果
  const syncSearch = useCallback(
    (query: string): Array<{ id: number }> => {
      if (query === "") return [];
      return cacheRef.current.get(query.toLowerCase()) ?? [];
    },
    [/* no deps — reads from cacheRef */],
  );

  // normalizedQuery 变化时触发异步搜索并更新 cache
  useEffect(() => {
    if (!active) return;
    if (normalizedQuery === "") {
      setSearchIndex({ search: syncSearch });
      return;
    }

    const trigger = ++searchTriggerRef.current;

    void (async () => {
      const results = await searchUnified(normalizedQuery);
      if (trigger !== searchTriggerRef.current) return; // 废弃过期请求

      const tabResults = results
        .filter((r) => r.source === "tab")
        .map((r) => {
          const numId = Number(r.id.replace("tab:", ""));
          return { id: numId };
        })
        .filter((item) => !Number.isNaN(item.id));

      cacheRef.current.set(normalizedQuery.toLowerCase(), tabResults);
      setSearchIndex({ search: syncSearch });
    })();
  }, [active, normalizedQuery, searchUnified, syncSearch]);

  // 初始化时设置 syncSearch
  useEffect(() => {
    setSearchIndex({ search: syncSearch });
  }, [syncSearch]);

  return {
    searchIndex,
    pinyinMatchFn: null,
    workerReady: ready,
  };
}