/**
 * useSearchIndex Hook
 *
 * 管理 MiniSearch 索引的异步构建。
 * 性能注意：tabs 数组在 store 中每次变更都会创建新引用（即使内容没变），
 * 直接把 tabs 放到依赖里会导致索引被频繁重建（用户每切一次 Tab 都重建一次）。
 * 这里改为基于「能影响命中结果的内容指纹」做依赖。
 */

import { useState, useEffect, useMemo } from "react";
import type { LiveTab, SearchScopeField } from "@/shared/types";
import type { SearchIndexLike } from "../types";

interface UseSearchIndexProps {
  open: boolean;
  tabs: LiveTab[];
  searchScope: SearchScopeField[];
}

interface UseSearchIndexReturn {
  searchIndex: SearchIndexLike | null;
}

/**
 * 搜索索引 Hook
 *
 * 异步构建并维护 MiniSearch 索引。
 *
 * @param props - Hook 配置
 * @param props.open
 * @param props.tabs
 * @param props.searchScope
 * @returns 搜索索引
 */
export function useSearchIndex({
  open,
  tabs,
  searchScope,
}: UseSearchIndexProps): UseSearchIndexReturn {
  /**
   * MiniSearch 索引（异步构建）。
   *
   * 性能注意：tabs 数组在 store 中每次变更都会创建新引用（即使内容没变），
   * 直接把 tabs 放到依赖里会导致索引被频繁重建（用户每切一次 Tab 都重建一次）。
   * 这里改为基于「能影响命中结果的内容指纹」做依赖：tabs 数量 + id/title/url/hostname 拼接。
   * 这样标签状态字段（如 lastAccessed、audible）变化不会触发无谓重建。
   */
  const tabsIndexSignature = useMemo(
    () =>
      `${tabs.length}|${tabs.map((t) => `${t.id}:${t.title}:${t.hostname}:${t.url}`).join("\u0001")}`,
    [tabs],
  );

  const [searchIndex, setSearchIndex] = useState<SearchIndexLike | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    void (async () => {
      const { default: MiniSearch } = await import("minisearch");

      if (cancelled) return;

      const fields = searchScope.length > 0 ? [...searchScope] : ["title"];
      const ms = new MiniSearch({
        fields,
        storeFields: ["id"],
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
        // 包装 MiniSearch 实例以符合 SearchIndexLike 接口
        setSearchIndex({
          search: (query: string) => {
            try {
              return ms.search(query).map((result) => ({ id: result.id as number }));
            } catch {
              return [];
            }
          },
        });
      }
    })();

    return () => {
      cancelled = true;
    };
    // 依赖项 tabs 通过 tabsIndexSignature 间接表达
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, searchScope, tabsIndexSignature]);

  return { searchIndex };
}
