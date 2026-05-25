import { useState, useEffect } from "react";
import type { LiveTab, SearchScopeField } from "@/shared/types";

type PinyinMatchFn = (text: string, query: string) => boolean;

export interface SearchIndexLike {
  search: (query: string) => Array<{ id: number }>;
}

export interface SearchIndexState {
  searchIndex: SearchIndexLike | null;
  pinyinMatchFn: PinyinMatchFn | null;
}

export function useSearchIndex(options: {
  open: boolean;
  tabs: LiveTab[];
  tabsIndexSignature: string;
  searchScope: SearchScopeField[];
  enablePinyin: boolean;
}): SearchIndexState {
  const { open, tabs, tabsIndexSignature, searchScope, enablePinyin } = options;

  const [searchIndex, setSearchIndex] = useState<SearchIndexLike | null>(null);
  const [loadedPinyinMatchFn, setLoadedPinyinMatchFn] = useState<PinyinMatchFn | null>(null);

  // 构建 MiniSearch 索引
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const { default: MS } = await import("minisearch");
      if (cancelled) return;
      const fields = searchScope.length > 0 ? [...searchScope] : ["title"];
      const ms = new MS({
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
      if (!cancelled) setSearchIndex(ms);
    })();
    return () => { cancelled = true; };
    // tabs 通过 tabsIndexSignature 间接表达，ESLint 在该 hook 上忽略 tabs 是有意为之
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, searchScope, tabsIndexSignature]);

  // 异步预加载拼音匹配函数
  useEffect(() => {
    if (!enablePinyin || loadedPinyinMatchFn !== null) return;
    void (async () => {
      const { pinyinMatch } = await import("@/shared/utils/pinyin");
      setLoadedPinyinMatchFn(() => pinyinMatch);
    })();
  }, [enablePinyin, loadedPinyinMatchFn]);

  return {
    searchIndex,
    pinyinMatchFn: enablePinyin ? loadedPinyinMatchFn : null,
  };
}
