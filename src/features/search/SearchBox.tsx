/**
 * SearchBox —— 全能搜索浮层。
 *
 * 设计目标：
 * 1. 优先在当前标签页中快速检索并切换。
 * 2. 提供最近搜索、历史记录、热门关键词联想。
 * 3. 当本地结果不足时，直接给出网页搜索动作，模拟主流搜索引擎体验。
 * 4. 保持键盘优先与轻量界面，确保输入响应足够快。
 */

import { useState, useMemo, useRef, useCallback, useEffect, type ReactNode } from "react";
import { Modal, Input, theme, Popover, Button, Image } from "antd";
import { FeatureEmptyState } from "@/shared/ui/FeatureEmptyState";
import type { InputRef } from "antd";
import { Search, Check, ChevronDown, History } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import type { LiveTab, SearchEngineId, SearchScopeField, TrendingCache } from "@/shared/types";
import type { CustomSearchEngine } from "@/shared/types/settings";
import { useTabsStore, useSettingsStore, useMetadataStore } from "@/store";
import { useT } from "@/shared/i18n";
import {
  createTab,
  hasHistoryPermission,
  requestHistoryPermission,
  searchHistoryEntries,
  storageGet,
  type HistorySearchEntry,
} from "@/chrome";
import { track } from "@/shared/utils/metrics";
import {
  getRecentSearches,
  getSearchHistory,
  pushRecentSearch,
  getClosedTabs,
  deleteClosedTab,
} from "@/repositories";
import type { ClosedTabRecord } from "@/shared/types";
import { STORAGE_KEYS } from "@/shared/config/storage-keys";
import { fetchMultipleBoards } from "@/services/trending-service";
import {
  buildSearchUrl,
  resolveHotKeywords,
  getSearchEngineOption,
  normalizeEnabledSearchEngines,
  type SearchEngineOption,
  type HotKeywordSource,
} from "@/shared/config/search-engines";
import { iconColor } from "@/shared/utils/icon-colors";
import { normalizeMetadataKey } from "@/shared/utils/metadata-key";
import { SearchResultItem } from "./components/SearchResultItem";
import type { UniversalSearchItem, SearchSection } from "./types";
import styles from "./SearchBox.module.less";

const DEFAULT_SEARCH_SCOPE: SearchScopeField[] = ["title", "hostname", "url"];
const SEARCH_DEBOUNCE_MS = 180;
const SEARCH_TRENDING_PLATFORMS = ["weibo", "baidu", "toutiao"];

type PinyinMatchFn = (text: string, query: string) => boolean;
interface SearchIndexLike {
  search: (query: string) => Array<{ id: number }>;
}

interface SearchBoxProps {
  /** 受控：是否打开 */
  open: boolean;
  /** 受控：开关切换回调 */
  onOpenChange: (open: boolean) => void;
  /** 点击「查看全部历史」时的回调；未传时不展示该入口 */
  onOpenHistory?: () => void;
}

interface SearchSettingsSnapshot {
  searchCustomEngines?: CustomSearchEngine[];
}

function normalizeSearchText(text: string): string {
  return text.trim().toLowerCase();
}

function Kbd({ children }: { children: ReactNode }) {
  return <span className={styles["search-box-kbd"]}>{children}</span>;
}

/**
 * 全能搜索浮层。
 */
export function SearchBox({ open, onOpenChange, onOpenHistory }: SearchBoxProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [currentEngine, setCurrentEngine] = useState<SearchEngineId>("google");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  /** 本地热词聚合需要完整的 SearchHistoryEntry（带 count + ts），不能复用 recentSearches */
  const [historyForHot, setHistoryForHot] = useState<
    Array<{ query: string; ts: number; count: number }>
  >([]);
  const [trendingCache, setTrendingCache] = useState<TrendingCache | undefined>(undefined);
  const [historyPermission, setHistoryPermission] = useState<boolean | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistorySearchEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [enginePopoverOpen, setEnginePopoverOpen] = useState(false);
  /** 「最近关闭」：输入为空时作为 section 展示；有输入时也作为补充候选 */
  const [closedTabRecords, setClosedTabRecords] = useState<ClosedTabRecord[]>([]);
  const inputRef = useRef<InputRef>(null);
  const tabs = useTabsStore((s) => s.tabs);
  const tagsByUrl = useMetadataStore((s) => s.tags);
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const { t, locale } = useT();
  const { token } = theme.useToken();

  const rawSearchScope = useSettingsStore((s) => s.settings.searchScope);
  const searchScope = rawSearchScope ?? DEFAULT_SEARCH_SCOPE;
  const enablePinyin = useSettingsStore((s) => s.settings.searchEnablePinyin ?? true);
  const searchSortBy = useSettingsStore((s) => s.settings.searchSortBy ?? "relevance");
  const defaultEngine = useSettingsStore((s) => s.settings.searchDefaultEngine ?? "google");
  const enabledEngineIds = useSettingsStore((s) => s.settings.searchEnabledEngines);
  const customEngines = useSettingsStore((s): CustomSearchEngine[] => {
    const settings = s.settings as SearchSettingsSnapshot;
    return settings.searchCustomEngines ?? [];
  });
  const autoFallbackToWeb = useSettingsStore((s) => s.settings.searchAutoFallbackToWeb ?? true);
  const useHistorySuggestions = useSettingsStore(
    (s) => s.settings.searchUseHistorySuggestions ?? true,
  );
  const useHotSuggestions = useSettingsStore((s) => s.settings.searchUseHotSuggestions ?? true);
  const hotSuggestionSource = useSettingsStore((s) => s.settings.hotSuggestionSource);
  /** 历史记录主开关：关闭时不再展示「最近关闭」section */
  const historyEnabled = useSettingsStore((s) => s.settings.historyEnabled !== false);

  /**
   * 归一化热词来源：老开关（布尔）+ 新字段（3 档）的兼容规则——
   *   - searchUseHotSuggestions=false → 绝对 off（不管 hotSuggestionSource 设什么）
   *   - 未设 hotSuggestionSource → 默认 'local'
   */
  const effectiveHotSource: HotKeywordSource = !useHotSuggestions
    ? "off"
    : (hotSuggestionSource ?? "local");

  const enabledEngines = useMemo(
    () => normalizeEnabledSearchEngines(enabledEngineIds, customEngines),
    [customEngines, enabledEngineIds],
  );
  const engineOptions = useMemo<SearchEngineOption[]>(
    () => enabledEngines.map((engineId) => getSearchEngineOption(engineId, customEngines)),
    [customEngines, enabledEngines],
  );
  const resolvedDefaultEngine: SearchEngineId = enabledEngines.includes(defaultEngine)
    ? defaultEngine
    : (enabledEngines[0] ?? "google");
  const currentEngineOption = getSearchEngineOption(currentEngine, customEngines);
  const normalizedQuery = query.trim();
  const lowerQuery = normalizedQuery.toLowerCase();
  const tagScopedMatch = /^tag[:：]\s*(.*)$/i.exec(normalizedQuery);
  const isTagScopedQuery = tagScopedMatch !== null;
  const tagScopedQuery = isTagScopedQuery ? (tagScopedMatch[1] ?? "").trim() : "";
  const searchText = isTagScopedQuery ? tagScopedQuery : normalizedQuery;
  const lowerSearchText = normalizeSearchText(searchText);

  const rootVars = useMemo(
    () =>
      ({
        "--searchbox-border": token.colorBorderSecondary,
        "--searchbox-text": token.colorText,
        "--searchbox-text-secondary": token.colorTextSecondary,
        "--searchbox-text-tertiary": token.colorTextTertiary,
        "--searchbox-fill-secondary": token.colorFillSecondary,
        "--searchbox-fill-tertiary": token.colorFillTertiary,
        "--searchbox-fill-quaternary": token.colorFillQuaternary,
        "--searchbox-accent": token.colorPrimary,
        "--searchbox-radius": `${token.borderRadiusLG}px`,
        "--searchbox-transition": token.motionDurationFast,
        "--searchbox-search-icon": iconColor("search", token),
      }) as React.CSSProperties,
    [token],
  );

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
      if (!cancelled) {
        setSearchIndex(ms);
      }
    })();
    return () => {
      cancelled = true;
    };
    // 依赖项 tabs 通过 tabsIndexSignature 间接表达；ESLint 在该 hook 上忽略 tabs 是有意为之
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, searchScope, tabsIndexSignature]);

  /**
   * 拼音匹配函数（异步预加载）。
   */
  const [loadedPinyinMatchFn, setLoadedPinyinMatchFn] = useState<PinyinMatchFn | null>(null);
  const pinyinMatchFn = enablePinyin ? loadedPinyinMatchFn : null;
  useEffect(() => {
    if (!enablePinyin || loadedPinyinMatchFn !== null) return;
    void (async () => {
      const { pinyinMatch } = await import("@/shared/utils/pinyin");
      setLoadedPinyinMatchFn(() => pinyinMatch);
    })();
  }, [enablePinyin, loadedPinyinMatchFn]);

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
   * 拉取历史建议。
   * - debouncedQuery 改变时立即清空旧结果，避免「上一个 query 的历史」短暂错位显示。
   * - 防抖已在上一个 effect 中通过 setDebouncedQuery 完成，这里直接发起请求，无需再嵌套 setTimeout。
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
   * 计算标签页结果。
   */
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
    const toItem = (tab: LiveTab): UniversalSearchItem => {
      const matchedTags = getMatchedTags(tab);
      return {
        id: `tab-${tab.id}`,
        type: "tab",
        title: tab.title,
        subtitle: tab.hostname,
        tab,
        badge: tab.isCurrentWindow ? undefined : t("tabs.otherWindow"),
        matchedTags,
      };
    };

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
            const matchesTitle = matchTitle && pinyinMatchFn(tab.title, normalizedQuery);
            const matchesHostname = matchHostname && pinyinMatchFn(tab.hostname, normalizedQuery);
            return matchesTitle || matchesHostname;
          });
          extras.forEach((item) => existingIds.add(item.id));
          matchedTabs = [...matchedTabs, ...extras];
        }

        const tagMatchedTabs = tabs.filter((tab) => !existingIds.has(tab.id) && hasTagMatch(tab));
        matchedTabs = [...matchedTabs, ...tagMatchedTabs];

        return sortTabs(matchedTabs).map(toItem);
      }
    } catch {
      /* MiniSearch 异常时走兜底匹配 */
    }

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
  }, [
    enablePinyin,
    isTagScopedQuery,
    lowerQuery,
    lowerSearchText,
    normalizedQuery,
    pinyinMatchFn,
    searchIndex,
    searchScope,
    searchSortBy,
    t,
    tabs,
    tagsByUrl,
  ]);

  /**
   * 计算"最近搜索"列表（独立 section）。
   * - 空 query：展示用户的最近搜索词（按存储顺序）
   * - 有 query：把最近搜索作为联想（包含子串过滤）
   */
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
      items.push({
        id: `recent-${key}`,
        type: "suggestion",
        title: normalized,
        subtitle: t("search.sourceRecent"),
        keyword: normalized,
        source: "recent",
      });
    });
    return items;
  }, [isTagScopedQuery, lowerQuery, normalizedQuery, recentSearches, t]);

  /**
   * 计算"热门话题"列表（独立 section）。
   * - source=local 时基于本地历史聚合；本地为空时由 resolveHotKeywords 退化为 preset
   * - source=preset/trending 时按各自规则
   * - source=off 时返回空
   */
  const hotItems = useMemo<UniversalSearchItem[]>(() => {
    if (isTagScopedQuery || effectiveHotSource === "off") return [];
    const seen = new Set<string>();
    // 同名词去重：避免某个 keyword 同时出现在 recent 与 hot 中导致两条
    recentItems.forEach((item) => {
      if (item.type === "suggestion") seen.add(item.keyword.toLowerCase());
    });
    const items: UniversalSearchItem[] = [];
    const hotKeywords = resolveHotKeywords(
      effectiveHotSource,
      locale,
      historyForHot,
      trendingCache,
    ).filter((item) => (normalizedQuery === "" ? true : item.toLowerCase().includes(lowerQuery)));
    hotKeywords.slice(0, normalizedQuery === "" ? 6 : 4).forEach((keyword) => {
      const normalized = keyword.trim();
      const key = normalized.toLowerCase();
      if (normalized === "" || seen.has(key)) return;
      seen.add(key);
      items.push({
        id: `hot-${key}`,
        type: "suggestion",
        title: normalized,
        subtitle: t("search.sourceHot"),
        keyword: normalized,
        source: "hot",
      });
    });
    return items;
  }, [
    effectiveHotSource,
    historyForHot,
    isTagScopedQuery,
    locale,
    lowerQuery,
    normalizedQuery,
    recentItems,
    t,
    trendingCache,
  ]);

  /**
   * 计算历史结果。
   */
  const historyItems = useMemo<UniversalSearchItem[]>(() => {
    if (isTagScopedQuery || !useHistorySuggestions || historyPermission !== true) return [];
    return historyEntries
      .filter((entry) => entry.url !== "")
      .map((entry) => ({
        id: `history-${entry.id}`,
        type: "history",
        title: entry.title,
        subtitle: entry.url,
        entry,
      }));
  }, [historyEntries, historyPermission, isTagScopedQuery, useHistorySuggestions]);

  /**
   * 「最近关闭」section
   * - 空 query：展示最多 5 条最近关闭
   * - 有 query：作为子串过滤后的补充候选（最多 4 条）
   * - 主开关关闭时不展示
   */
  const closedItems = useMemo<UniversalSearchItem[]>(() => {
    if (isTagScopedQuery) return [];
    if (!historyEnabled) return [];
    const filtered = closedTabRecords.filter((r) => {
      if (normalizedQuery === "") return true;
      const hay = `${r.title} ${r.url} ${r.hostname}`.toLowerCase();
      return hay.includes(lowerQuery);
    });
    return filtered.slice(0, normalizedQuery === "" ? 5 : 4).map((r) => ({
      id: `closed-${r.id}`,
      type: "closed" as const,
      title: r.title === "" ? r.url : r.title,
      subtitle: r.hostname === "" ? r.url : r.hostname,
      record: r,
    }));
  }, [closedTabRecords, historyEnabled, isTagScopedQuery, lowerQuery, normalizedQuery]);

  const webItems = useMemo<UniversalSearchItem[]>(() => {
    if (isTagScopedQuery || normalizedQuery === "") return [];
    const primary: UniversalSearchItem[] = [
      {
        id: `web-${currentEngine}-${normalizedQuery}`,
        type: "web",
        title: t("search.searchWithEngine", {
          engine: currentEngineOption.label,
          query: normalizedQuery,
        }),
        subtitle: t("search.searchWithEngineHint"),
        query: normalizedQuery,
        engineId: currentEngine,
      },
    ];

    const secondaryEngines = enabledEngines
      .filter((engineId) => engineId !== currentEngine)
      .slice(0, 2);
    secondaryEngines.forEach((engineId) => {
      const option = getSearchEngineOption(engineId, customEngines);
      primary.push({
        id: `web-${engineId}-${normalizedQuery}`,
        type: "web",
        title: t("search.searchWithEngine", {
          engine: option.label,
          query: normalizedQuery,
        }),
        subtitle: t("search.searchWithEngineHint"),
        query: normalizedQuery,
        engineId,
      });
    });

    return primary;
  }, [
    currentEngine,
    currentEngineOption.label,
    customEngines,
    enabledEngines,
    isTagScopedQuery,
    normalizedQuery,
    t,
  ]);

  const permissionItems = useMemo<UniversalSearchItem[]>(() => {
    if (isTagScopedQuery || !useHistorySuggestions || historyPermission !== false) return [];
    return [
      {
        id: "permission-history",
        type: "permission",
        title: t("search.enableHistory"),
        subtitle: t("search.enableHistoryHint"),
      },
    ];
  }, [historyPermission, isTagScopedQuery, t, useHistorySuggestions]);

  /**
   * 「快捷动作」候选项：输入「history / 历史 / recent / 最近 / closed / 关闭 / /h / /history」
   * 等关键词时，为用户提供一条「打开历史面板」的路由入口。未提供 onOpenHistory 时不出现。
   */
  const commandItems = useMemo<UniversalSearchItem[]>(() => {
    if (isTagScopedQuery || onOpenHistory === undefined) return [];
    if (normalizedQuery === "") return [];
    const triggers = ["history", "recent", "closed", "/h", "/history", "历史", "最近", "关闭"];
    const hit = triggers.some((kw) => lowerQuery.includes(kw));
    if (!hit) return [];
    return [
      {
        id: "command-open-history",
        type: "command",
        title: t("search.commandOpenHistory"),
        subtitle: t("search.commandOpenHistoryHint"),
        commandId: "open-history",
      },
    ];
  }, [isTagScopedQuery, lowerQuery, normalizedQuery, onOpenHistory, t]);

  /**
   * 按优先级组装搜索区块。
   */
  const sections = useMemo<SearchSection[]>(() => {
    const nextSections: SearchSection[] = [];
    const hasTabMatches = tabItems.length > 0;

    if (normalizedQuery !== "" && autoFallbackToWeb && !hasTabMatches && webItems.length > 0) {
      nextSections.push({ key: "web-primary", title: t("search.sectionWeb"), items: webItems });
    }
    if (commandItems.length > 0) {
      // 「快捷动作」总是置顶，避免被页内 tab 结果淹没
      nextSections.push({
        key: "commands",
        title: t("search.sectionCommands"),
        items: commandItems,
      });
    }
    if (tabItems.length > 0) {
      nextSections.push({ key: "tabs", title: t("search.sectionTabs"), items: tabItems });
    }
    if (recentItems.length > 0) {
      nextSections.push({ key: "recent", title: t("search.sectionRecent"), items: recentItems });
    }
    if (closedItems.length > 0) {
      nextSections.push({
        key: "closed",
        title: t("search.sectionRecentlyClosed"),
        items: closedItems,
      });
    }
    if (hotItems.length > 0) {
      nextSections.push({ key: "hot", title: t("search.sectionHot"), items: hotItems });
    }
    if (historyItems.length > 0 || permissionItems.length > 0) {
      nextSections.push({
        key: "history",
        title: t("search.sectionHistory"),
        items: historyItems.length > 0 ? historyItems : permissionItems,
      });
    }
    if (!(normalizedQuery !== "" && autoFallbackToWeb && !hasTabMatches) && webItems.length > 0) {
      nextSections.push({ key: "web", title: t("search.sectionWeb"), items: webItems });
    }

    return nextSections;
  }, [
    autoFallbackToWeb,
    closedItems,
    commandItems,
    historyItems,
    hotItems,
    normalizedQuery,
    permissionItems,
    recentItems,
    t,
    tabItems,
    webItems,
  ]);

  const flatItems = useMemo(() => sections.flatMap((section) => section.items), [sections]);
  const firstWebItemIndex = useMemo(
    () => flatItems.findIndex((item) => item.type === "web"),
    [flatItems],
  );

  /**
   * 当结果集合变化导致 activeIndex 越界时，把它 clamp 回合法范围。
   * 避免「输入新关键词后，旧的 activeIndex 大于当前列表长度，高亮丢失」的问题。
   */
  useEffect(() => {
    if (flatItems.length === 0) {
      if (activeIndex !== 0) setActiveIndex(0);
      return;
    }
    if (activeIndex >= flatItems.length) {
      setActiveIndex(flatItems.length - 1);
    }
  }, [activeIndex, flatItems.length]);

  /**
   * 当 enabledEngines 变化导致 currentEngine 不在启用列表中时，
   * 自动切到一个合法引擎，避免 Select 显示空白或 Cmd+Enter 用错引擎。
   */
  useEffect(() => {
    if (!enabledEngines.includes(currentEngine)) {
      setCurrentEngine(enabledEngines[0] ?? "google");
    }
  }, [currentEngine, enabledEngines]);
  const shortcutHints = useMemo(
    () => [
      { id: "navigate", keys: ["↑", "↓"], label: t("search.navigate") },
      { id: "open", keys: ["↵"], label: t("search.open") },
      { id: "web", keys: ["⌘↵"], label: t("search.web") },
      { id: "switch", keys: ["Tab"], label: t("search.switchToWeb") },
      { id: "close", keys: ["esc"], label: t("search.close") },
    ],
    [t],
  );

  /**
   * 将高频变化的键盘导航状态缓存到 ref 中，
   * 使 handleKeyDown 的依赖稳定，避免频繁重建导致 Input 重新渲染。
   * 改为在 handleKeyDown 执行时更新 ref，避免 useEffect 高频触发。
   */
  const navStateRef = useRef({
    activeIndex,
    flatItems,
    firstWebItemIndex,
    normalizedQuery,
    currentEngine,
    enabledEngines,
  });
  const updateNavStateRef = useCallback(() => {
    navStateRef.current = {
      activeIndex,
      flatItems,
      firstWebItemIndex,
      normalizedQuery,
      currentEngine,
      enabledEngines,
    };
  }, [activeIndex, flatItems, firstWebItemIndex, normalizedQuery, currentEngine, enabledEngines]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  /**
   * 执行网页搜索。
   * @param active - 是否切换到新打开的 Tab；Alt+Enter 等场景需要后台打开（false）
   */
  const runWebSearch = useCallback(
    async (searchQuery: string, engineId: SearchEngineId = currentEngine, active = true) => {
      const trimmed = searchQuery.trim();
      if (trimmed === "") return;
      const url = buildSearchUrl(engineId, trimmed, customEngines);
      // 先记录搜索历史，再关闭浮层；避免组件被 destroyOnHidden 卸载后 setState 警告
      try {
        const updatedRecent = await pushRecentSearch(trimmed);
        setRecentSearches(updatedRecent);
      } catch {
        /* 搜索历史保存失败不影响用户操作 */
      }
      try {
        await createTab({ url, active });
        void track("search_web", { engine: engineId, query: trimmed });
        close();
      } catch (err) {
        // createTab 失败（如非扩展上下文），回退到 window.open
        try {
          window.open(url, "_blank");
          close();
        } catch {
          /* 彻底失败时静默处理 */
        }
        console.error("[SearchBox] runWebSearch failed:", err);
      }
    },
    [close, currentEngine, customEngines],
  );

  /**
   * 打开历史结果。
   */
  const openHistoryEntry = useCallback(
    async (entry: HistorySearchEntry) => {
      try {
        await createTab({ url: entry.url, active: true });
        close();
      } catch (err) {
        try {
          window.open(entry.url, "_blank", "noopener,noreferrer");
          close();
        } catch {
          /* 彻底失败时静默处理 */
        }
        console.error("[SearchBox] openHistoryEntry failed:", err);
      }
    },
    [close],
  );

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

  /**
   * Modal 打开时重置状态。
   */
  const handleAfterOpenChange = useCallback(
    (visible: boolean) => {
      if (!visible) return;
      setQuery("");
      setDebouncedQuery("");
      setActiveIndex(0);
      setCurrentEngine(resolvedDefaultEngine);
      setHistoryEntries([]);
      setEnginePopoverOpen(false);
      inputRef.current?.focus();
    },
    [resolvedDefaultEngine],
  );

  const handleJump = useCallback(
    (tab: LiveTab) => {
      void jumpToTab(tab.id, tab.windowId);
      close();
    },
    [close, jumpToTab],
  );

  /**
   * 恢复一条「最近关闭」记录。
   */
  const restoreClosedTab = useCallback(
    async (record: ClosedTabRecord) => {
      try {
        await createTab({ url: record.url, active: true, pinned: record.pinned });
        await deleteClosedTab(record.id);
        // 同步本地状态，让 UI 立即反馈该项消失
        setClosedTabRecords((prev) => prev.filter((r) => r.id !== record.id));
        close();
      } catch (err) {
        try {
          window.open(record.url, "_blank");
          close();
        } catch {
          /* 彻底失败静默处理 */
        }
        console.error("[SearchBox] restoreClosedTab failed:", err);
      }
    },
    [close],
  );

  /**
   * 执行当前高亮项。
   */
  const handleActivate = useCallback(
    (item: UniversalSearchItem) => {
      if (item.type === "tab") {
        handleJump(item.tab);
        return;
      }
      if (item.type === "history") {
        void openHistoryEntry(item.entry);
        return;
      }
      if (item.type === "closed") {
        void restoreClosedTab(item.record);
        return;
      }
      if (item.type === "suggestion") {
        void runWebSearch(item.keyword, currentEngine);
        return;
      }
      if (item.type === "web") {
        void runWebSearch(item.query, item.engineId);
        return;
      }
      if (item.type === "permission") {
        void enableHistorySuggestions();
        return;
      }
      if (item.type === "command") {
        // 目前只接入 open-history，后续如有更多命令式 item，按 commandId 分支扩展
        if (item.commandId === "open-history" && onOpenHistory !== undefined) {
          close();
          onOpenHistory();
        }
      }
    },
    [
      close,
      currentEngine,
      enableHistorySuggestions,
      handleJump,
      onOpenHistory,
      openHistoryEntry,
      restoreClosedTab,
      runWebSearch,
    ],
  );

  /**
   * 键盘导航（v1.1 完善）：
   *   - Escape        ：有输入 → 清空；无输入 → 关闭 Modal
   *   - Cmd/Ctrl+K    ：在 Modal 内再按一次同样关闭（与打开对称）
   *   - Enter         ：激活当前高亮项；无高亮时 web 搜索
   *   - Cmd/Ctrl+Enter：始终以 web 搜索跳转（不走 activate）
   *   - Alt+Enter     ：web 搜索并后台打开（不抢焦点）
   *   - Cmd+1..9      ：直接用第 N 个已启用引擎对当前 query 进行 web 搜索
   *   - Tab           ：跳到第一个 web 搜索项（保留老行为）
   *   - ↑ / ↓         ：上下选择
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // 执行前更新 ref，确保使用最新状态，避免高频 useEffect
      updateNavStateRef();
      const {
        activeIndex: idx,
        flatItems: items,
        firstWebItemIndex: webIdx,
        normalizedQuery: nq,
        currentEngine: engine,
        enabledEngines: engines,
      } = navStateRef.current;
      // Cmd/Ctrl + K：再按一次关闭 Modal（与打开快捷键对称）
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        close();
        return;
      }

      if (e.key === "Escape") {
        if (nq !== "") {
          e.preventDefault();
          e.stopPropagation();
          setQuery("");
          setDebouncedQuery("");
          setActiveIndex(0);
          return;
        }
        // 空输入时 Escape 关闭 Modal（Modal 自身 keyboard=false 禁用了默认行为）
        e.preventDefault();
        close();
        return;
      }

      // Cmd/Ctrl + 1..9：直接用第 N 个启用引擎进行 web 搜索
      if ((e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key) && nq !== "") {
        const engineIdx = Number.parseInt(e.key, 10) - 1;
        const target = engines[engineIdx];
        if (target !== undefined) {
          e.preventDefault();
          void runWebSearch(nq, target);
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && nq !== "") {
        e.preventDefault();
        void runWebSearch(nq, engine);
        return;
      }

      if (e.altKey && e.key === "Enter" && nq !== "") {
        // Alt+Enter：后台打开（不切换到新 Tab）
        e.preventDefault();
        void runWebSearch(nq, engine, false);
        return;
      }

      if (e.key === "Tab" && webIdx >= 0) {
        e.preventDefault();
        setActiveIndex(webIdx);
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((index) => (items.length === 0 ? 0 : (index + 1) % items.length));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((index) =>
          items.length === 0 ? 0 : (index - 1 + items.length) % items.length,
        );
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const activeItem = items[idx];
        if (activeItem !== undefined) {
          handleActivate(activeItem);
          return;
        }
        if (nq !== "") {
          void runWebSearch(nq, engine);
        }
      }
    },
    [close, handleActivate, runWebSearch, updateNavStateRef],
  );

  return (
    <Modal
      open={open}
      onCancel={close}
      afterOpenChange={handleAfterOpenChange}
      footer={null}
      closable={false}
      destroyOnHidden
      keyboard={false}
      width={680}
      centered={false}
      className={styles["search-box-dialog"]}
      classNames={{
        mask: "search-box-mask",
        body: "search-box-body",
        container: "search-box-container",
      }}
      rootClassName={styles["search-box-modal"]}
    >
      <div className={styles["search-box-shell"]} style={rootVars}>
        <div className={styles["search-box-header"]}>
          <Popover
            open={enginePopoverOpen}
            onOpenChange={setEnginePopoverOpen}
            trigger="click"
            placement="bottomLeft"
            arrow={false}
            classNames={{ root: styles["search-box-engine-popover"] }}
            content={
              <ul
                className={styles["search-box-engine-menu"]}
                role="listbox"
                aria-label={t("search.engineSwitcher")}
              >
                {engineOptions.map((option, idx) => {
                  const active = option.id === currentEngine;
                  const shortcut = idx < 9 ? `\u2318${idx + 1}` : undefined;
                  return (
                    <li
                      key={option.id}
                      role="option"
                      aria-selected={active}
                      className={`${styles["search-box-engine-menu-item"]} ${active ? styles["is-active"] : ""}`}
                      style={{ "--searchbox-engine-color": option.color } as React.CSSProperties}
                      onClick={() => {
                        setCurrentEngine(option.id);
                        setEnginePopoverOpen(false);
                        inputRef.current?.focus();
                      }}
                    >
                      <span className={styles["search-box-engine-logo"]} aria-hidden="true">
                        {option.iconUrl ? (
                          <Image
                            src={option.iconUrl}
                            alt=""
                            preview={false}
                            fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                            width={16}
                            height={16}
                          />
                        ) : (
                          option.label.slice(0, 1)
                        )}
                      </span>
                      <span className={styles["search-box-engine-menu-label"]}>{option.label}</span>
                      {shortcut !== undefined && (
                        <span
                          className={styles["search-box-engine-menu-shortcut"]}
                          aria-hidden="true"
                        >
                          {shortcut}
                        </span>
                      )}
                      {active && (
                        <Check
                          size={ICON_SIZE.TINY}
                          className={styles["search-box-engine-menu-check"]}
                          aria-hidden="true"
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            }
          >
            <Button
              type="text"
              className={`${styles["search-box-engine-trigger"]} ${enginePopoverOpen ? styles["is-open"] : ""}`}
              style={
                { "--searchbox-engine-color": currentEngineOption.color } as React.CSSProperties
              }
              aria-haspopup="listbox"
              aria-expanded={enginePopoverOpen}
              aria-label={t("search.engineSwitcher")}
              title={currentEngineOption.label}
            >
              <span className={styles["search-box-engine-logo"]} aria-hidden="true">
                {currentEngineOption.iconUrl ? (
                  <Image
                    src={currentEngineOption.iconUrl}
                    alt=""
                    preview={false}
                    fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                    width={16}
                    height={16}
                  />
                ) : (
                  currentEngineOption.label.slice(0, 1)
                )}
              </span>
              <ChevronDown
                size={ICON_SIZE.TINY}
                className={styles["search-box-engine-trigger-caret"]}
                aria-hidden="true"
              />
            </Button>
          </Popover>
          <Input
            ref={inputRef}
            size="large"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={t("search.universalPlaceholder")}
            prefix={
              <Search size={ICON_SIZE.MEDIUM} className={styles["search-box-input-prefix"]} />
            }
            allowClear
            variant="borderless"
            autoComplete="off"
            spellCheck={false}
            aria-label={t("search.universalPlaceholder")}
            className={styles["search-box-input"]}
          />
          {onOpenHistory !== undefined && (
            <Button
              type="text"
              className={styles["search-box-history-trigger"]}
              onClick={() => {
                close();
                onOpenHistory();
              }}
              aria-label={t("search.openHistoryPanel")}
              title={t("search.openHistoryPanel")}
            >
              <History size={ICON_SIZE.SMALL} aria-hidden="true" />
            </Button>
          )}
        </div>

        <div className={styles["search-box-list-area"]}>
          {flatItems.length === 0
            ? (() => {
                const title = historyLoading
                  ? t("search.loadingHistory")
                  : normalizedQuery !== ""
                    ? t("search.tryOther")
                    : t("search.emptyIdle");
                return (
                  <div className={styles["search-box-empty"]}>
                    <FeatureEmptyState
                      title={title}
                      icon={<Search size={20} className={styles["search-box-empty-icon"]} />}
                      size="small"
                      hints={
                        normalizedQuery !== ""
                          ? [t("search.emptyHint1"), t("search.emptyHint2")]
                          : undefined
                      }
                    />
                  </div>
                );
              })()
            : sections.map((section) => {
                const startIndex = flatItems.findIndex((item) => item.id === section.items[0]?.id);
                return (
                  <section key={section.key} className={styles["search-box-section"]}>
                    <div className={styles["search-box-section-header"]}>
                      <span>{section.title}</span>
                      <span className={styles["search-box-section-count"]}>
                        {section.items.length}
                      </span>
                    </div>
                    <div role="listbox" className={styles["search-box-list"]}>
                      {section.items.map((item, offset) => {
                        const itemIndex = startIndex + offset;
                        const active = itemIndex === activeIndex;

                        return (
                          <SearchResultItem
                            key={item.id}
                            item={item}
                            index={itemIndex}
                            active={active}
                            normalizedQuery={normalizedQuery}
                            onActivate={handleActivate}
                            onMouseEnter={(index) => setActiveIndex(index)}
                          />
                        );
                      })}
                    </div>
                  </section>
                );
              })}
        </div>

        <div className={styles["search-box-footer"]}>
          <span className={styles["search-box-status-text"]}>
            {flatItems.length > 0
              ? t("search.results", { count: flatItems.length })
              : t("search.statusIdle")}
          </span>
          <div className={styles["search-box-shortcuts"]}>
            {shortcutHints.map((shortcut) => (
              <span key={shortcut.id} className={styles["search-box-shortcut"]}>
                <span className={styles["search-box-shortcut-keys"]}>
                  {shortcut.keys.map((key) => (
                    <Kbd key={`${shortcut.id}-${key}`}>{key}</Kbd>
                  ))}
                </span>
                <span>{shortcut.label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
