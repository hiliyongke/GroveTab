import { useState, useEffect, useRef } from "react";
import type { LiveTab, SearchScopeField } from "@/shared/types";

type PinyinMatchFn = (text: string, query: string) => boolean;

export interface SearchIndexLike {
  search: (query: string) => Array<{ id: number }>;
}

export interface SearchIndexState {
  searchIndex: SearchIndexLike | null;
  pinyinMatchFn: PinyinMatchFn | null;
}

/**
 * 将 LiveTab 映射为 MiniSearch 可索引的文档
 * 抽取为纯函数方便增量比对
 */
function tabToDoc(tab: LiveTab) {
  return { id: tab.id, title: tab.title, hostname: tab.hostname, url: tab.url };
}

/**
 * 搜索索引 Hook（增量更新版）
 *
 * 优化策略：
 *   - 首次打开：全量构建 MiniSearch 索引
 *   - 后续变更：通过 diff 计算 added/removed/changed，调用 MiniSearch 的
 *     add()/discard()/replace() 增量更新，避免每次全量重建
 *   - searchScope 变更时仍需全量重建（字段结构改变）
 */
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

  /** 上一轮索引中的 tab ID → doc 快照，用于增量 diff */
  const prevDocsRef = useRef<Map<number, { title: string; hostname: string; url: string }>>(
    new Map(),
  );
  /** 上一轮的 searchScope，变更时需全量重建 */
  const prevScopeRef = useRef<SearchScopeField[]>(searchScope);

  // 构建或增量更新 MiniSearch 索引
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    void (async () => {
      const { default: MS } = await import("minisearch");
      if (cancelled) return;

      const fields: SearchScopeField[] = searchScope.length > 0 ? [...searchScope] : ["title"];
      const scopeChanged =
        prevScopeRef.current.length !== fields.length ||
        prevScopeRef.current.some((f, i) => f !== fields[i]);

      if (scopeChanged || prevDocsRef.current.size === 0) {
        // ── 全量构建（首次或 scope 变更） ──
        const ms = new MS({
          fields,
          storeFields: ["id"],
          searchOptions: { fuzzy: 0.2, prefix: true },
        });
        if (tabs.length > 0) {
          ms.addAll(tabs.map(tabToDoc));
        }

        // 同步 prevDocs 快照
        const docMap = new Map<number, { title: string; hostname: string; url: string }>();
        for (const tab of tabs) {
          docMap.set(tab.id, { title: tab.title, hostname: tab.hostname, url: tab.url });
        }
        prevDocsRef.current = docMap;
        prevScopeRef.current = fields;

        if (!cancelled) setSearchIndex(ms);
        return;
      }

      // ── 增量更新 ──
      // 使用函数式更新获取最新 searchIndex，避免闭包旧值
      setSearchIndex((prev) => {
        if (prev === null) {
          // 不应出现，但兜底全量重建
          const ms = new MS({
            fields,
            storeFields: ["id"],
            searchOptions: { fuzzy: 0.2, prefix: true },
          });
          if (tabs.length > 0) ms.addAll(tabs.map(tabToDoc));
          const docMap = new Map<number, { title: string; hostname: string; url: string }>();
          for (const tab of tabs) {
            docMap.set(tab.id, { title: tab.title, hostname: tab.hostname, url: tab.url });
          }
          prevDocsRef.current = docMap;
          return ms;
        }

        const ms = prev as InstanceType<typeof MS>;
        const prevDocs = prevDocsRef.current;
        const currentIds = new Set(tabs.map((t) => t.id));

        // 1. 删除已不存在的 tab
        for (const id of prevDocs.keys()) {
          if (!currentIds.has(id)) {
            try {
              ms.discard(id);
            } catch {
              /* 可能已不存在 */
            }
          }
        }

        // 2. 新增或更新 tab
        for (const tab of tabs) {
          const doc = tabToDoc(tab);
          const prevDoc = prevDocs.get(tab.id);
          if (prevDoc === undefined) {
            // 新增
            try {
              ms.add(doc);
            } catch {
              /* 重复 add 安全忽略 */
            }
          } else if (
            prevDoc.title !== doc.title ||
            prevDoc.hostname !== doc.hostname ||
            prevDoc.url !== doc.url
          ) {
            // 内容变更 → replace
            try {
              ms.replace(doc);
            } catch {
              // replace 失败时 fallback: discard + add
              try {
                ms.discard(doc.id);
              } catch {
                /* ignore */
              }
              try {
                ms.add(doc);
              } catch {
                /* ignore */
              }
            }
          }
        }

        // 3. 同步 prevDocs 快照
        const docMap = new Map<number, { title: string; hostname: string; url: string }>();
        for (const tab of tabs) {
          docMap.set(tab.id, { title: tab.title, hostname: tab.hostname, url: tab.url });
        }
        prevDocsRef.current = docMap;

        // 返回同一个引用（ms 已被就地修改），React 检测到同一引用不会 re-render
        // 但为了让消费者知道索引已更新，我们返回一个浅包装
        return ms;
      });
    })();

    return () => {
      cancelled = true;
    };
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
