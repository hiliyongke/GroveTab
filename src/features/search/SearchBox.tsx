/**
 * SearchBox —— 全能搜索浮层。
 *
 * 设计目标：
 * 1. 优先在当前标签页中快速检索并切换。
 * 2. 提供最近搜索、历史记录、热门关键词联想。
 * 3. 当本地结果不足时，直接给出网页搜索动作，模拟主流搜索引擎体验。
 * 4. 保持键盘优先与轻量界面，确保输入响应足够快。
 */

import { useState, useMemo, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { Modal, Input, theme, Empty, Select, Tag } from 'antd';
import type { InputRef } from 'antd';
import {
  LayoutGrid,
  Clock,
  CornerDownLeft,
  Flame,
  Globe,
  Link,
  Search,
  Unlock,
} from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import type {
  LiveTab,
  SearchEngineId,
  SearchScopeField,
} from '@/shared/types';
import {
  useTabsStore,
  useSettingsStore,
} from '@/store';
import { useT } from '@/shared/i18n';
import {
  createTab,
  hasHistoryPermission,
  requestHistoryPermission,
  searchHistoryEntries,
  type HistorySearchEntry,
} from '@/chrome';
import { getRecentSearches, getSearchHistory, pushRecentSearch } from '@/repositories';
import {
  SEARCH_ENGINE_OPTIONS,
  buildSearchUrl,
  resolveHotKeywords,
  getSearchEngineOption,
  type HotKeywordSource,
} from '@/shared/config/search-engines';
import { iconColor, iconColorAlpha, type IconRole } from '@/shared/utils/icon-colors';

const DEFAULT_SEARCH_SCOPE: SearchScopeField[] = ['title', 'hostname', 'url'];
const DEFAULT_ENABLED_ENGINES: SearchEngineId[] = SEARCH_ENGINE_OPTIONS.map((item) => item.id);
const SEARCH_DEBOUNCE_MS = 180;

type PinyinMatchFn = (text: string, query: string) => boolean;
type SearchIndexLike = {
  search: (query: string) => Array<{ id: number }>;
};

interface SearchBoxProps {
  /** 受控：是否打开 */
  open: boolean;
  /** 受控：开关切换回调 */
  onOpenChange: (open: boolean) => void;
}

type SuggestionSource = 'recent' | 'hot';

type UniversalSearchItem =
  | {
      id: string;
      type: 'tab';
      title: string;
      subtitle: string;
      tab: LiveTab;
      badge?: string;
    }
  | {
      id: string;
      type: 'history';
      title: string;
      subtitle: string;
      entry: HistorySearchEntry;
    }
  | {
      id: string;
      type: 'suggestion';
      title: string;
      subtitle: string;
      keyword: string;
      source: SuggestionSource;
    }
  | {
      id: string;
      type: 'web';
      title: string;
      subtitle: string;
      query: string;
      engineId: SearchEngineId;
    }
  | {
      id: string;
      type: 'permission';
      title: string;
      subtitle: string;
    };

interface SearchSection {
  key: string;
  title: string;
  items: UniversalSearchItem[];
}

/**
 * 小键盘提示胶囊。
 */
function Kbd({ children }: { children: ReactNode }) {
  const { token } = theme.useToken();
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        fontSize: 10.5,
        fontFamily: 'var(--font-family-mono, monospace)',
        color: token.colorTextSecondary,
        background: token.colorFillTertiary,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 4,
        lineHeight: 1,
      }}
    >
      {children}
    </span>
  );
}

/**
 * 对文本中的命中片段做高亮。
 */
function renderHighlightedText(text: string, query: string, activeColor: string, accentColor: string): ReactNode {
  const normalizedQuery = query.trim();
  if (normalizedQuery === '' || text === '') return text;

  const escaped = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = new RegExp(`(${escaped})`, 'ig');
  const parts = text.split(matcher);

  return parts.map((part, index) => {
    const matched = part.localeCompare(normalizedQuery, undefined, { sensitivity: 'accent' }) === 0
      || part.toLowerCase() === normalizedQuery.toLowerCase();
    return matched ? (
      <mark
        key={`${part}-${index}`}
        style={{
          padding: 0,
          color: accentColor,
          background: 'transparent',
          fontWeight: 700,
        }}
      >
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`} style={{ color: activeColor }}>
        {part}
      </span>
    );
  });
}

/**
 * 规范化搜索引擎列表，确保至少保留一个有效引擎。
 */
function normalizeEnabledEngines(engineIds: SearchEngineId[] | undefined): SearchEngineId[] {
  const validIds = new Set<SearchEngineId>(SEARCH_ENGINE_OPTIONS.map((item) => item.id));
  const normalized = (engineIds ?? []).filter((item) => validIds.has(item));
  return normalized.length > 0 ? normalized : DEFAULT_ENABLED_ENGINES;
}

/**
 * 全能搜索浮层。
 */
export function SearchBox({ open, onOpenChange }: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [currentEngine, setCurrentEngine] = useState<SearchEngineId>('google');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  /** 本地热词聚合需要完整的 SearchHistoryEntry（带 count + ts），不能复用 recentSearches */
  const [historyForHot, setHistoryForHot] = useState<Array<{ query: string; ts: number; count: number }>>([]);
  const [historyPermission, setHistoryPermission] = useState<boolean | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistorySearchEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const inputRef = useRef<InputRef>(null);
  const tabs = useTabsStore((s) => s.tabs);
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const { t, locale } = useT();
  const { token } = theme.useToken();

  const rawSearchScope = useSettingsStore((s) => s.settings.searchScope);
  const searchScope = rawSearchScope ?? DEFAULT_SEARCH_SCOPE;
  const enablePinyin = useSettingsStore((s) => s.settings.searchEnablePinyin ?? true);
  const searchSortBy = useSettingsStore((s) => s.settings.searchSortBy ?? 'relevance');
  const defaultEngine = useSettingsStore((s) => s.settings.searchDefaultEngine ?? 'google');
  const enabledEngineIds = useSettingsStore((s) => s.settings.searchEnabledEngines);
  const autoFallbackToWeb = useSettingsStore((s) => s.settings.searchAutoFallbackToWeb ?? true);
  const useHistorySuggestions = useSettingsStore((s) => s.settings.searchUseHistorySuggestions ?? true);
  const useHotSuggestions = useSettingsStore((s) => s.settings.searchUseHotSuggestions ?? true);
  const hotSuggestionSource = useSettingsStore((s) => s.settings.hotSuggestionSource);

  /**
   * 归一化热词来源：老开关（布尔）+ 新字段（3 档）的兼容规则——
   *   - searchUseHotSuggestions=false → 绝对 off（不管 hotSuggestionSource 设什么）
   *   - 未设 hotSuggestionSource → 默认 'local'
   */
  const effectiveHotSource: HotKeywordSource = !useHotSuggestions
    ? 'off'
    : (hotSuggestionSource ?? 'local');

  const enabledEngines = useMemo(() => normalizeEnabledEngines(enabledEngineIds), [enabledEngineIds]);
  const resolvedDefaultEngine = enabledEngines.includes(defaultEngine) ? defaultEngine : enabledEngines[0];
  const currentEngineOption = getSearchEngineOption(currentEngine);
  const normalizedQuery = query.trim();
  const lowerQuery = normalizedQuery.toLowerCase();

  /**
   * MiniSearch 索引（异步构建）。
   */
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
  }, [open, searchScope, tabs]);

  /**
   * 拼音匹配函数（异步预加载）。
   */
  const [loadedPinyinMatchFn, setLoadedPinyinMatchFn] = useState<PinyinMatchFn | null>(null);
  const pinyinMatchFn = enablePinyin ? loadedPinyinMatchFn : null;
  useEffect(() => {
    if (!enablePinyin || loadedPinyinMatchFn !== null) return;
    void (async () => {
      const { pinyinMatch } = await import('@/shared/utils/pinyin');
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
    return () => {
      cancelled = true;
    };
  }, [open]);

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
   */
  useEffect(() => {
    if (!open || !useHistorySuggestions || historyPermission !== true) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
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
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [debouncedQuery, historyPermission, open, useHistorySuggestions]);

  /**
   * 计算标签页结果。
   */
  const tabItems = useMemo<UniversalSearchItem[]>(() => {
    if (normalizedQuery === '') return [];

    const scopeSet = new Set<SearchScopeField>(searchScope);
    const matchTitle = scopeSet.has('title');
    const matchHostname = scopeSet.has('hostname');
    const matchUrl = scopeSet.has('url');

    try {
      const miniResults: Array<{ id: number }> = searchIndex?.search(normalizedQuery) ?? [];
      if (miniResults.length > 0) {
        const byId = new Map(tabs.map((tab) => [tab.id, tab] as const));
        let matchedTabs = miniResults
          .map((item) => byId.get(item.id))
          .filter((item): item is LiveTab => item !== undefined);

        if (enablePinyin && pinyinMatchFn !== null) {
          const existingIds = new Set(matchedTabs.map((item) => item.id));
          const extras = tabs.filter((tab) => {
            if (existingIds.has(tab.id)) return false;
            const matchesTitle = matchTitle && pinyinMatchFn(tab.title, normalizedQuery);
            const matchesHostname = matchHostname && pinyinMatchFn(tab.hostname, normalizedQuery);
            return matchesTitle || matchesHostname;
          });
          matchedTabs = [...matchedTabs, ...extras];
        }

        if (searchSortBy === 'recentAccess') {
          matchedTabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
        }

        return matchedTabs.map((tab) => ({
          id: `tab-${tab.id}`,
          type: 'tab',
          title: tab.title,
          subtitle: tab.hostname,
          tab,
          badge: tab.isCurrentWindow ? undefined : t('tabs.otherWindow'),
        }));
      }
    } catch {
      /* MiniSearch 异常时走兜底匹配 */
    }

    const fallbackTabs = tabs.filter((tab) => {
      if (matchTitle) {
        const titleMatched = tab.title.toLowerCase().includes(lowerQuery);
        if (titleMatched) return true;
        if (enablePinyin && pinyinMatchFn !== null && pinyinMatchFn(tab.title, normalizedQuery)) return true;
      }
      if (matchHostname) {
        const hostnameMatched = tab.hostname.toLowerCase().includes(lowerQuery);
        if (hostnameMatched) return true;
        if (enablePinyin && pinyinMatchFn !== null && pinyinMatchFn(tab.hostname, normalizedQuery)) return true;
      }
      if (matchUrl && tab.url.toLowerCase().includes(lowerQuery)) return true;
      return false;
    });

    if (searchSortBy === 'recentAccess') {
      fallbackTabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
    }

    return fallbackTabs.map((tab) => ({
      id: `tab-${tab.id}`,
      type: 'tab',
      title: tab.title,
      subtitle: tab.hostname,
      tab,
      badge: tab.isCurrentWindow ? undefined : t('tabs.otherWindow'),
    }));
  }, [enablePinyin, lowerQuery, normalizedQuery, pinyinMatchFn, searchIndex, searchScope, searchSortBy, t, tabs]);

  /**
   * 计算联想建议。
   */
  const suggestionItems = useMemo<UniversalSearchItem[]>(() => {
    const items: UniversalSearchItem[] = [];
    const seen = new Set<string>();
    const pushSuggestion = (keyword: string, source: SuggestionSource, subtitle: string) => {
      const normalized = keyword.trim();
      const key = normalized.toLowerCase();
      if (normalized === '' || seen.has(key)) return;
      seen.add(key);
      items.push({
        id: `${source}-${key}`,
        type: 'suggestion',
        title: normalized,
        subtitle,
        keyword: normalized,
        source,
      });
    };

    const filteredRecent = recentSearches.filter((item) =>
      normalizedQuery === '' ? true : item.toLowerCase().includes(lowerQuery),
    );
    filteredRecent.slice(0, 4).forEach((item) => {
      pushSuggestion(item, 'recent', t('search.sourceRecent'));
    });

    if (effectiveHotSource !== 'off') {
      const hotKeywords = resolveHotKeywords(effectiveHotSource, locale, historyForHot).filter((item) =>
        normalizedQuery === '' ? true : item.toLowerCase().includes(lowerQuery),
      );
      hotKeywords.slice(0, normalizedQuery === '' ? 5 : 4).forEach((item) => {
        pushSuggestion(item, 'hot', t('search.sourceHot'));
      });
    }

    return items;
  }, [locale, lowerQuery, normalizedQuery, recentSearches, t, effectiveHotSource, historyForHot]);

  /**
   * 计算历史结果。
   */
  const historyItems = useMemo<UniversalSearchItem[]>(() => {
    if (!useHistorySuggestions || historyPermission !== true) return [];
    return historyEntries
      .filter((entry) => entry.url !== '')
      .map((entry) => ({
        id: `history-${entry.id}`,
        type: 'history',
        title: entry.title,
        subtitle: entry.url,
        entry,
      }));
  }, [historyEntries, historyPermission, useHistorySuggestions]);

  const webItems = useMemo<UniversalSearchItem[]>(() => {
    if (normalizedQuery === '') return [];
    const primary: UniversalSearchItem[] = [
      {
        id: `web-${currentEngine}-${normalizedQuery}`,
        type: 'web',
        title: t('search.searchWithEngine', {
          engine: currentEngineOption.label,
          query: normalizedQuery,
        }),
        subtitle: t('search.searchWithEngineHint'),
        query: normalizedQuery,
        engineId: currentEngine,
      },
    ];

    const secondaryEngines = enabledEngines.filter((engineId) => engineId !== currentEngine).slice(0, 2);
    secondaryEngines.forEach((engineId) => {
      const option = getSearchEngineOption(engineId);
      primary.push({
        id: `web-${engineId}-${normalizedQuery}`,
        type: 'web',
        title: t('search.searchWithEngine', {
          engine: option.label,
          query: normalizedQuery,
        }),
        subtitle: t('search.searchWithEngineHint'),
        query: normalizedQuery,
        engineId,
      });
    });

    return primary;
  }, [currentEngine, currentEngineOption.label, enabledEngines, normalizedQuery, t]);

  const permissionItems = useMemo<UniversalSearchItem[]>(() => {
    if (!useHistorySuggestions || historyPermission !== false) return [];
    return [
      {
        id: 'permission-history',
        type: 'permission',
        title: t('search.enableHistory'),
        subtitle: t('search.enableHistoryHint'),
      },
    ];
  }, [historyPermission, t, useHistorySuggestions]);

  /**
   * 按优先级组装搜索区块。
   */
  const sections = useMemo<SearchSection[]>(() => {
    const nextSections: SearchSection[] = [];
    const hasTabMatches = tabItems.length > 0;

    if (normalizedQuery !== '' && autoFallbackToWeb && !hasTabMatches && webItems.length > 0) {
      nextSections.push({ key: 'web-primary', title: t('search.sectionWeb'), items: webItems });
    }
    if (tabItems.length > 0) {
      nextSections.push({ key: 'tabs', title: t('search.sectionTabs'), items: tabItems });
    }
    if (suggestionItems.length > 0) {
      nextSections.push({ key: 'suggestions', title: t('search.sectionSuggestions'), items: suggestionItems });
    }
    if (historyItems.length > 0 || permissionItems.length > 0) {
      nextSections.push({
        key: 'history',
        title: t('search.sectionHistory'),
        items: historyItems.length > 0 ? historyItems : permissionItems,
      });
    }
    if (!(normalizedQuery !== '' && autoFallbackToWeb && !hasTabMatches) && webItems.length > 0) {
      nextSections.push({ key: 'web', title: t('search.sectionWeb'), items: webItems });
    }

    return nextSections;
  }, [autoFallbackToWeb, historyItems, normalizedQuery, permissionItems, suggestionItems, t, tabItems, webItems]);

  const flatItems = useMemo(() => sections.flatMap((section) => section.items), [sections]);
  const firstWebItemIndex = useMemo(
    () => flatItems.findIndex((item) => item.type === 'web'),
    [flatItems],
  );

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  /**
   * 执行网页搜索。
   */
  const runWebSearch = useCallback(async (searchText: string, engineId: SearchEngineId) => {
    const trimmed = searchText.trim();
    if (trimmed === '') return;
    try {
      await createTab({ url: buildSearchUrl(engineId, trimmed), active: true });
      close();
      // 打开成功后再保存搜索历史，避免存储写入阻塞或阻断核心操作
      try {
        const updatedRecent = await pushRecentSearch(trimmed);
        setRecentSearches(updatedRecent);
      } catch {
        /* 搜索历史保存失败不影响用户操作 */
      }
    } catch (err) {
      // createTab 失败（如非扩展上下文），回退到 window.open
      try {
        window.open(buildSearchUrl(engineId, trimmed), '_blank');
        close();
      } catch {
        /* 彻底失败时静默处理 */
      }
      console.error('[SearchBox] runWebSearch failed:', err);
    }
  }, [close]);

  /**
   * 打开历史结果。
   */
  const openHistoryEntry = useCallback(async (entry: HistorySearchEntry) => {
    try {
      await createTab({ url: entry.url, active: true });
      close();
    } catch (err) {
      try {
        window.open(entry.url, '_blank');
        close();
      } catch {
        /* 彻底失败时静默处理 */
      }
      console.error('[SearchBox] openHistoryEntry failed:', err);
    }
  }, [close]);

  /**
   * 申请历史记录权限。
   */
  const enableHistorySuggestions = useCallback(async () => {
    const granted = await requestHistoryPermission();
    setHistoryPermission(granted);
    if (granted) {
      const entries = await searchHistoryEntries(debouncedQuery, debouncedQuery === '' ? 5 : 6);
      setHistoryEntries(entries);
    }
  }, [debouncedQuery]);

  /**
   * Modal 打开时重置状态。
   */
  const handleAfterOpenChange = useCallback((visible: boolean) => {
    if (!visible) return;
    setQuery('');
    setDebouncedQuery('');
    setActiveIndex(0);
    setCurrentEngine(resolvedDefaultEngine);
    setHistoryEntries([]);
    inputRef.current?.focus();
  }, [resolvedDefaultEngine]);

  const handleJump = useCallback((tab: LiveTab) => {
    void jumpToTab(tab.id, tab.windowId);
    close();
  }, [close, jumpToTab]);

  /**
   * 执行当前高亮项。
   */
  const handleActivate = useCallback((item: UniversalSearchItem) => {
    if (item.type === 'tab') {
      handleJump(item.tab);
      return;
    }
    if (item.type === 'history') {
      void openHistoryEntry(item.entry);
      return;
    }
    if (item.type === 'suggestion') {
      void runWebSearch(item.keyword, currentEngine);
      return;
    }
    if (item.type === 'web') {
      void runWebSearch(item.query, item.engineId);
      return;
    }
    if (item.type === 'permission') {
      void enableHistorySuggestions();
    }
  }, [currentEngine, enableHistorySuggestions, handleJump, openHistoryEntry, runWebSearch]);

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
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Cmd/Ctrl + K：再按一次关闭 Modal（与打开快捷键对称）
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      close();
      return;
    }

    if (e.key === 'Escape') {
      if (normalizedQuery !== '') {
        e.preventDefault();
        e.stopPropagation();
        setQuery('');
        setDebouncedQuery('');
        setActiveIndex(0);
        return;
      }
      // 空输入时 Escape 关闭 Modal（Modal 自身 keyboard=false 禁用了默认行为）
      e.preventDefault();
      close();
      return;
    }

    // Cmd/Ctrl + 1..9：直接用第 N 个启用引擎进行 web 搜索
    if ((e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key) && normalizedQuery !== '') {
      const idx = Number.parseInt(e.key, 10) - 1;
      const target = enabledEngines[idx];
      if (target !== undefined) {
        e.preventDefault();
        void runWebSearch(normalizedQuery, target);
      }
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && normalizedQuery !== '') {
      e.preventDefault();
      void runWebSearch(normalizedQuery, currentEngine);
      return;
    }

    if (e.altKey && e.key === 'Enter' && normalizedQuery !== '') {
      // Alt+Enter：后台打开（不切换到新 Tab）
      e.preventDefault();
      void runWebSearch(normalizedQuery, currentEngine);
      return;
    }

    if (e.key === 'Tab' && firstWebItemIndex >= 0) {
      e.preventDefault();
      setActiveIndex(firstWebItemIndex);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((index) => (flatItems.length === 0 ? 0 : (index + 1) % flatItems.length));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((index) => (flatItems.length === 0 ? 0 : (index - 1 + flatItems.length) % flatItems.length));
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const activeItem = flatItems[activeIndex];
      if (activeItem !== undefined) {
        handleActivate(activeItem);
        return;
      }
      if (normalizedQuery !== '') {
        void runWebSearch(normalizedQuery, currentEngine);
      }
    }
  }, [activeIndex, close, currentEngine, enabledEngines, firstWebItemIndex, flatItems, handleActivate, normalizedQuery, runWebSearch]);

  return (
    <Modal
      open={open}
      onCancel={close}
      afterOpenChange={handleAfterOpenChange}
      footer={null}
      closable={false}
      destroyOnHidden
      keyboard={false}
      width={720}
      centered={false}
      styles={{
        mask: { backdropFilter: 'blur(8px)' },
        body: { padding: 0 },
      }}
      style={{ top: '12vh' }}
    >
      <div
        style={{
          padding: '14px 16px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Input
          ref={inputRef}
          size="large"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder={t('search.universalPlaceholder')}
prefix={<Search size={ICON_SIZE.MEDIUM} style={{ color: iconColor('search', token) }} />}
          allowClear
          variant="borderless"
          autoComplete="off"
          spellCheck={false}
          aria-label={t('search.universalPlaceholder')}
          style={{ fontSize: 15, flex: 1 }}
        />
        <Select<SearchEngineId>
          size="small"
          value={currentEngine}
          onChange={setCurrentEngine}
          style={{ minWidth: 132 }}
suffixIcon={<Globe size={ICON_SIZE.MEDIUM} />}
          options={enabledEngines.map((engineId) => {
            const option = getSearchEngineOption(engineId);
            return { value: option.id, label: option.label };
          })}
        />
      </div>

      <div style={{ maxHeight: '52vh', overflowY: 'auto', padding: '6px 0' }}>
        {flatItems.length === 0 ? (
          <div style={{ padding: '32px 24px' }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span style={{ fontSize: 13, color: token.colorTextSecondary }}>
                  {historyLoading ? t('search.loadingHistory') : normalizedQuery !== '' ? t('search.tryOther') : t('search.emptyIdle')}
                </span>
              }
            />
          </div>
        ) : (
          sections.map((section) => {
            const startIndex = flatItems.findIndex((item) => item.id === section.items[0]?.id);
            return (
              <section key={section.key} style={{ paddingTop: 4 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 18px 6px',
                    fontSize: 11,
                    color: token.colorTextTertiary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  <span>{section.title}</span>
                  <span>{section.items.length}</span>
                </div>
                <ul
                  role="listbox"
                  style={{
                    listStyle: 'none',
                    margin: 0,
                    padding: '0 0 4px',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {section.items.map((item, offset) => {
                    const itemIndex = startIndex + offset;
                    const active = itemIndex === activeIndex;
let icon: ReactNode = <Search size={ICON_SIZE.TINY} />;
                    let iconRole: IconRole = 'search';
if (item.type === 'tab') { icon = <LayoutGrid size={ICON_SIZE.TINY} />; iconRole = 'tab'; }
if (item.type === 'history') { icon = <Link size={ICON_SIZE.TINY} />; iconRole = 'history'; }
if (item.type === 'web') { icon = <Globe size={ICON_SIZE.TINY} />; iconRole = 'web'; }
if (item.type === 'permission') { icon = <Unlock size={ICON_SIZE.TINY} />; iconRole = 'permission'; }
if (item.type === 'suggestion' && item.source === 'recent') { icon = <Clock size={ICON_SIZE.TINY} />; iconRole = 'recent'; }
if (item.type === 'suggestion' && item.source === 'hot') { icon = <Flame size={ICON_SIZE.TINY} />; iconRole = 'hot'; }

                    const semanticIconColor = iconColor(iconRole, token);
                    const titleNode = renderHighlightedText(item.title, normalizedQuery, token.colorText, token.colorPrimary);
                    const subtitleNode = renderHighlightedText(item.subtitle, normalizedQuery, token.colorTextTertiary, token.colorPrimary);

                    return (
                      <li
                        key={item.id}
                        role="option"
                        aria-selected={active}
                        onMouseEnter={() => setActiveIndex(itemIndex)}
                        onClick={() => handleActivate(item)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          margin: '0 8px',
                          padding: '10px 12px',
                          borderRadius: token.borderRadiusLG,
                          cursor: 'pointer',
                          background: active ? token.colorFillSecondary : 'transparent',
                          transition: `background ${token.motionDurationFast}`,
                        }}
                      >
                        {item.type === 'tab' && item.tab.favIconUrl !== '' ? (
                          <img
                            src={item.tab.favIconUrl}
                            alt=""
                            style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0 }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <span
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 4,
                              background: iconColorAlpha(iconRole, token, active ? 0.2 : 0.1),
                              color: semanticIconColor,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              fontSize: 11,
                            }}
                          >
                            {icon}
                          </span>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              minWidth: 0,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 13.5,
                                fontWeight: 500,
                                color: token.colorText,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                lineHeight: 1.3,
                              }}
                            >
                              {titleNode}
                            </div>
                            {item.type === 'tab' && item.badge !== undefined && (
                              <Tag style={{ margin: 0, fontSize: 10 }}>{item.badge}</Tag>
                            )}
                            {item.type === 'suggestion' && (
                              <Tag style={{ margin: 0, fontSize: 10 }} color={item.source === 'hot' ? 'gold' : 'default'}>
                                {item.source === 'hot' ? t('search.sourceHot') : t('search.sourceRecent')}
                              </Tag>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: 11.5,
                              color: token.colorTextTertiary,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              marginTop: 2,
                              lineHeight: 1.3,
                            }}
                          >
                            {subtitleNode}
                          </div>
                        </div>
                        {active && (
                          <CornerDownLeft
size={ICON_SIZE.SMALL}
                            style={{ color: token.colorTextTertiary, flexShrink: 0 }}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          height: 42,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorFillQuaternary,
          fontSize: 11.5,
          color: token.colorTextTertiary,
        }}
      >
        <span>
          {flatItems.length > 0 ? t('search.results', { count: flatItems.length }) : t('search.statusIdle')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            <span>{t('search.navigate')}</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Kbd>↵</Kbd>
            <span>{t('search.open')}</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Kbd>⌘↵</Kbd>
            <span>{t('search.web')}</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Kbd>Tab</Kbd>
            <span>{t('search.switchToWeb')}</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Kbd>esc</Kbd>
            <span>{t('search.close')}</span>
          </span>
        </div>
      </div>
    </Modal>
  );
}
