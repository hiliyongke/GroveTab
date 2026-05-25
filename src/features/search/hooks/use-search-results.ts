import { useMemo } from "react";
import type { LiveTab, SearchScopeField } from "@/shared/types";
import type { HistorySearchEntry } from "@/chrome";
import type { ClosedTabRecord, TrendingCache } from "@/shared/types";
import type { CustomSearchEngine } from "@/shared/types/settings";
import type { SearchEngineId } from "@/shared/types";
import type { SearchEngineOption, HotKeywordSource } from "@/shared/config/search-engines";
import {
  getSearchEngineOption,
  resolveHotKeywords,
} from "@/shared/config/search-engines";
import { normalizeMetadataKey } from "@/shared/utils/metadata-key";
import { useT } from "@/shared/i18n";
import type { UniversalSearchItem, SearchSection } from "../types";
import type { SearchIndexLike } from "./use-search-index";

function normalizeSearchText(text: string): string {
  return text.trim().toLowerCase();
}

type PinyinMatchFn = (text: string, query: string) => boolean;

export interface SearchResultsState {
  tabItems: UniversalSearchItem[];
  recentItems: UniversalSearchItem[];
  hotItems: UniversalSearchItem[];
  historyItems: UniversalSearchItem[];
  closedItems: UniversalSearchItem[];
  webItems: UniversalSearchItem[];
  permissionItems: UniversalSearchItem[];
  commandItems: UniversalSearchItem[];
  sections: SearchSection[];
  flatItems: UniversalSearchItem[];
  firstWebItemIndex: number;
}

export function useSearchResults(options: {
  normalizedQuery: string;
  lowerQuery: string;
  isTagScopedQuery: boolean;
  lowerSearchText: string;
  tabs: LiveTab[];
  tagsByUrl: Record<string, string[]>;
  searchScope: SearchScopeField[];
  searchSortBy: string;
  enablePinyin: boolean;
  pinyinMatchFn: PinyinMatchFn | null;
  searchIndex: SearchIndexLike | null;
  recentSearches: string[];
  historyForHot: Array<{ query: string; ts: number; count: number }>;
  trendingCache: TrendingCache | undefined;
  historyPermission: boolean | null;
  historyEntries: HistorySearchEntry[];
  closedTabRecords: ClosedTabRecord[];
  historyEnabled: boolean;
  effectiveHotSource: HotKeywordSource;
  useHistorySuggestions: boolean;
  autoFallbackToWeb: boolean;
  currentEngine: SearchEngineId;
  currentEngineOption: SearchEngineOption;
  enabledEngines: SearchEngineId[];
  customEngines: CustomSearchEngine[];
  onOpenHistory?: () => void;
}): SearchResultsState {
  const {
    normalizedQuery, lowerQuery, isTagScopedQuery, lowerSearchText,
    tabs, tagsByUrl, searchScope, searchSortBy, enablePinyin, pinyinMatchFn,
    searchIndex, recentSearches, historyForHot, trendingCache, historyPermission,
    historyEntries, closedTabRecords, historyEnabled, effectiveHotSource,
    useHistorySuggestions, autoFallbackToWeb, currentEngine, currentEngineOption,
    enabledEngines, customEngines, onOpenHistory,
  } = options;

  const { t, locale } = useT();

  const tabItems = useMemo<UniversalSearchItem[]>(() => {
    if (normalizedQuery === "") return [];
    const scopeSet = new Set<SearchScopeField>(searchScope);
    const matchTitle = scopeSet.has("title");
    const matchHostname = scopeSet.has("hostname");
    const matchUrl = scopeSet.has("url");
    const getTabTags = (tab: LiveTab) => tagsByUrl[normalizeMetadataKey(tab.url)] ?? [];
    const getMatchedTags = (tab: LiveTab) => {
      if (lowerSearchText === "") return [];
      return getTabTags(tab).filter((tag) => normalizeSearchText(tag).includes(lowerSearchText));
    };
    const hasTagMatch = (tab: LiveTab) => getMatchedTags(tab).length > 0;
    const sortTabs = (items: LiveTab[]) => {
      if (searchSortBy === "recentAccess") {
        items.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
      }
      return items;
    };
    const toItem = (tab: LiveTab): UniversalSearchItem => ({
      id: `tab-${tab.id}`,
      type: "tab",
      title: tab.title,
      subtitle: tab.hostname,
      tab,
      badge: tab.isCurrentWindow ? undefined : t('其他窗口'),
      matchedTags: getMatchedTags(tab),
    });

    if (isTagScopedQuery) {
      if (lowerSearchText === "") return [];
      return sortTabs(tabs.filter(hasTagMatch)).map(toItem);
    }

    try {
      const miniResults: Array<{ id: number }> = searchIndex?.search(normalizedQuery) ?? [];
      if (miniResults.length > 0) {
        const byId = new Map(tabs.map((tab) => [tab.id, tab] as const));
        let matchedTabs = miniResults
          .map((item) => byId.get(item.id))
          .filter((item): item is LiveTab => item !== undefined);
        const existingIds = new Set(matchedTabs.map((item) => item.id));
        if (enablePinyin && pinyinMatchFn !== null) {
          const extras = tabs.filter((tab) => {
            if (existingIds.has(tab.id)) return false;
            return (matchTitle && pinyinMatchFn(tab.title, normalizedQuery)) ||
              (matchHostname && pinyinMatchFn(tab.hostname, normalizedQuery));
          });
          extras.forEach((item) => existingIds.add(item.id));
          matchedTabs = [...matchedTabs, ...extras];
        }
        const tagMatchedTabs = tabs.filter((tab) => !existingIds.has(tab.id) && hasTagMatch(tab));
        return sortTabs([...matchedTabs, ...tagMatchedTabs]).map(toItem);
      }
    } catch { /* MiniSearch 异常时走兜底匹配 */ }

    const fallbackTabs = tabs.filter((tab) => {
      if (hasTagMatch(tab)) return true;
      if (matchTitle) {
        if (tab.title.toLowerCase().includes(lowerQuery)) return true;
        if (enablePinyin && pinyinMatchFn?.(tab.title, normalizedQuery)) return true;
      }
      if (matchHostname) {
        if (tab.hostname.toLowerCase().includes(lowerQuery)) return true;
        if (enablePinyin && pinyinMatchFn?.(tab.hostname, normalizedQuery)) return true;
      }
      if (matchUrl && tab.url.toLowerCase().includes(lowerQuery)) return true;
      return false;
    });
    return sortTabs(fallbackTabs).map(toItem);
  }, [enablePinyin, isTagScopedQuery, lowerQuery, lowerSearchText, normalizedQuery, pinyinMatchFn, searchIndex, searchScope, searchSortBy, t, tabs, tagsByUrl]);

  const recentItems = useMemo<UniversalSearchItem[]>(() => {
    if (isTagScopedQuery) return [];
    const seen = new Set<string>();
    const items: UniversalSearchItem[] = [];
    const filtered = recentSearches.filter((item) =>
      normalizedQuery === "" ? true : item.toLowerCase().includes(lowerQuery),
    );
    filtered.slice(0, normalizedQuery === "" ? 6 : 4).forEach((keyword) => {
      const normalized = keyword.trim();
      const key = normalized.toLowerCase();
      if (normalized === "" || seen.has(key)) return;
      seen.add(key);
      items.push({ id: `recent-${key}`, type: "suggestion", title: normalized, subtitle: t('最近搜索'), keyword: normalized, source: "recent" });
    });
    return items;
  }, [isTagScopedQuery, lowerQuery, normalizedQuery, recentSearches, t]);

  const hotItems = useMemo<UniversalSearchItem[]>(() => {
    if (isTagScopedQuery || effectiveHotSource === "off") return [];
    const seen = new Set<string>();
    recentItems.forEach((item) => { if (item.type === "suggestion") seen.add(item.keyword.toLowerCase()); });
    const items: UniversalSearchItem[] = [];
    const hotKeywords = resolveHotKeywords(effectiveHotSource, locale, historyForHot, trendingCache)
      .filter((item) => normalizedQuery === "" ? true : item.toLowerCase().includes(lowerQuery));
    hotKeywords.slice(0, normalizedQuery === "" ? 6 : 4).forEach((keyword) => {
      const normalized = keyword.trim();
      const key = normalized.toLowerCase();
      if (normalized === "" || seen.has(key)) return;
      seen.add(key);
      items.push({ id: `hot-${key}`, type: "suggestion", title: normalized, subtitle: t('热门关键词'), keyword: normalized, source: "hot" });
    });
    return items;
  }, [effectiveHotSource, historyForHot, isTagScopedQuery, locale, lowerQuery, normalizedQuery, recentItems, t, trendingCache]);

  const historyItems = useMemo<UniversalSearchItem[]>(() => {
    if (isTagScopedQuery || !useHistorySuggestions || historyPermission !== true) return [];
    return historyEntries
      .filter((entry) => entry.url !== "")
      .map((entry) => ({ id: `history-${entry.id}`, type: "history" as const, title: entry.title, subtitle: entry.url, entry }));
  }, [historyEntries, historyPermission, isTagScopedQuery, useHistorySuggestions]);

  const closedItems = useMemo<UniversalSearchItem[]>(() => {
    if (isTagScopedQuery || !historyEnabled) return [];
    const filtered = closedTabRecords.filter((r) => {
      if (normalizedQuery === "") return true;
      return `${r.title} ${r.url} ${r.hostname}`.toLowerCase().includes(lowerQuery);
    });
    return filtered.slice(0, normalizedQuery === "" ? 5 : 4).map((r) => ({
      id: `closed-${r.id}`, type: "closed" as const,
      title: r.title === "" ? r.url : r.title,
      subtitle: r.hostname === "" ? r.url : r.hostname,
      record: r,
    }));
  }, [closedTabRecords, historyEnabled, isTagScopedQuery, lowerQuery, normalizedQuery]);

  const webItems = useMemo<UniversalSearchItem[]>(() => {
    if (isTagScopedQuery || normalizedQuery === "") return [];
    const primary: UniversalSearchItem[] = [{
      id: `web-${currentEngine}-${normalizedQuery}`, type: "web",
      title: t('使用 {engine} 搜索 "{query}"', { engine: currentEngineOption.label, query: normalizedQuery }),
      subtitle: t('回车即可打开搜索结果页'),
      query: normalizedQuery, engineId: currentEngine,
    }];
    enabledEngines.filter((id) => id !== currentEngine).slice(0, 2).forEach((engineId) => {
      const option = getSearchEngineOption(engineId, customEngines);
      primary.push({
        id: `web-${engineId}-${normalizedQuery}`, type: "web",
        title: t('使用 {engine} 搜索 "{query}"', { engine: option.label, query: normalizedQuery }),
        subtitle: t('回车即可打开搜索结果页'),
        query: normalizedQuery, engineId,
      });
    });
    return primary;
  }, [currentEngine, currentEngineOption.label, customEngines, enabledEngines, isTagScopedQuery, normalizedQuery, t]);

  const permissionItems = useMemo<UniversalSearchItem[]>(() => {
    if (isTagScopedQuery || !useHistorySuggestions || historyPermission !== false) return [];
    return [{ id: "permission-history", type: "permission" as const, title: t('启用历史建议'), subtitle: t('授权后可在搜索框中显示浏览历史与最近访问页面') }];
  }, [historyPermission, isTagScopedQuery, t, useHistorySuggestions]);

  const commandItems = useMemo<UniversalSearchItem[]>(() => {
    if (isTagScopedQuery || onOpenHistory === undefined || normalizedQuery === "") return [];
    const triggers = ["history", "recent", "closed", "/h", "/history", "历史", "最近", "关闭"];
    if (!triggers.some((kw) => lowerQuery.includes(kw))) return [];
    return [{ id: "command-open-history", type: "command" as const, title: t('打开历史面板'), subtitle: t('查看最近关闭的标签页和完整操作时间线'), commandId: "open-history" }];
  }, [isTagScopedQuery, lowerQuery, normalizedQuery, onOpenHistory, t]);

  const sections = useMemo<SearchSection[]>(() => {
    const nextSections: SearchSection[] = [];
    const hasTabMatches = tabItems.length > 0;
    if (normalizedQuery !== "" && autoFallbackToWeb && !hasTabMatches && webItems.length > 0) {
      nextSections.push({ key: "web-primary", title: t('网页搜索'), items: webItems });
    }
    if (commandItems.length > 0) nextSections.push({ key: "commands", title: t('快捷操作'), items: commandItems });
    if (tabItems.length > 0) nextSections.push({ key: "tabs", title: t('标签页'), items: tabItems });
    if (recentItems.length > 0) nextSections.push({ key: "recent", title: t('最近搜索'), items: recentItems });
    if (closedItems.length > 0) nextSections.push({ key: "closed", title: t('最近关闭'), items: closedItems });
    if (hotItems.length > 0) nextSections.push({ key: "hot", title: t('热门话题'), items: hotItems });
    if (historyItems.length > 0 || permissionItems.length > 0) {
      nextSections.push({ key: "history", title: t('历史记录'), items: historyItems.length > 0 ? historyItems : permissionItems });
    }
    if (!(normalizedQuery !== "" && autoFallbackToWeb && !hasTabMatches) && webItems.length > 0) {
      nextSections.push({ key: "web", title: t('网页搜索'), items: webItems });
    }
    return nextSections;
  }, [autoFallbackToWeb, closedItems, commandItems, historyItems, hotItems, normalizedQuery, permissionItems, recentItems, t, tabItems, webItems]);

  const flatItems = useMemo(() => sections.flatMap((section) => section.items), [sections]);
  const firstWebItemIndex = useMemo(() => flatItems.findIndex((item) => item.type === "web"), [flatItems]);

  return { tabItems, recentItems, hotItems, historyItems, closedItems, webItems, permissionItems, commandItems, sections, flatItems, firstWebItemIndex };
}
