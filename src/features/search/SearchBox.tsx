/**
 * SearchBox —— 全能搜索浮层。
 *
 * 设计目标：
 * 1. 优先在当前标签页中快速检索并切换。
 * 2. 提供最近搜索、历史记录、热门关键词联想。
 * 3. 当本地结果不足时，直接给出网页搜索动作，模拟主流搜索引擎体验。
 * 4. 保持键盘优先与轻量界面，确保输入响应足够快。
 */

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Modal, Input, theme, Popover, Button, Image, Tooltip, Typography } from "antd";
import { FeatureEmptyState } from "@/shared/ui/FeatureEmptyState";
import type { InputRef } from "antd";
import { Search, Check, ChevronDown, History, Trash2, RefreshCw } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import type { SearchEngineId } from "@/shared/types";
import type { CustomSearchEngine } from "@/shared/types/settings";
import { useTabsStore, useSettingsStore, useMetadataStore } from "@/store";
import { useT } from "@/shared/i18n";
import { createTab } from "@/chrome";
import { track } from "@/shared/utils/metrics";
import {
  pushRecentSearch,
  deleteClosedTab,
  getLastSearchEngine,
  setLastSearchEngine,
} from "@/repositories";
import { setData } from "@/repositories/storage-repo";
import { STORAGE_KEYS } from "@/shared/config/storage-keys";
import { fetchMultipleBoards } from "@/services/trending-service";
import { SEARCH_TRENDING_PLATFORMS } from "./hooks/use-search-data";
import {
  buildSearchUrl,
  normalizeEnabledSearchEngines,
  getSearchEngineOption,
  type SearchEngineOption,
  type HotKeywordSource,
} from "@/shared/config/search-engines";
import { iconColor } from "@/shared/utils/icon-colors";
import { SearchResultItem } from "./components/SearchResultItem";
import { useSearchData } from "./hooks/use-search-data";
import { useSearchBridgeSync } from "./hooks/use-search-bridge";
import { useSearchResults } from "./hooks/use-search-results";
import { useKeyboardNav } from "./hooks/use-keyboard-nav";
import styles from "./SearchBox.module.less";

const DEFAULT_SEARCH_SCOPE = ["title", "hostname", "url"] as const;

interface SearchBoxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenHistory?: () => void;
}

interface SearchSettingsSnapshot {
  searchCustomEngines?: CustomSearchEngine[];
}

export function SearchBox({ open, onOpenChange, onOpenHistory }: SearchBoxProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [currentEngine, setCurrentEngine] = useState<SearchEngineId>("google");
  const [enginePopoverOpen, setEnginePopoverOpen] = useState(false);
  const inputRef = useRef<InputRef>(null);

  const tabs = useTabsStore((s) => s.tabs);
  const tagsByUrl = useMetadataStore((s) => s.tags);
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const { t } = useT();
  const { token } = theme.useToken();

  const rawSearchScope = useSettingsStore((s) => s.settings.searchScope);
  const searchScope = rawSearchScope ?? [...DEFAULT_SEARCH_SCOPE];
  const enablePinyin = useSettingsStore((s) => s.settings.searchEnablePinyin ?? true);
  const searchSortBy = useSettingsStore((s) => s.settings.searchSortBy ?? "relevance");
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
  const historyEnabled = useSettingsStore((s) => s.settings.historyEnabled !== false);

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
  const currentEngineOption = getSearchEngineOption(currentEngine, customEngines);

  const normalizedQuery = query.trim();
  const lowerQuery = normalizedQuery.toLowerCase();
  const tagScopedMatch = /^tag[:：]\s*(.*)$/i.exec(normalizedQuery);
  const isTagScopedQuery = tagScopedMatch !== null;
  const tagScopedQuery = isTagScopedQuery ? (tagScopedMatch[1] ?? "").trim() : "";
  const searchText = isTagScopedQuery ? tagScopedQuery : normalizedQuery;
  const lowerSearchText = searchText.trim().toLowerCase();

  // ── 数据加载（先获取 archiveSessions 再构建索引）───────────────────────────
  const {
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
    setDebouncedQuery,
    enableHistorySuggestions,
    archiveSessions,
  } = useSearchData({
    open,
    normalizedQuery,
    effectiveHotSource,
    useHistorySuggestions,
    historyEnabled,
  });

  // ── 索引构建（使用 Web Worker 后台索引，避免主线程阻塞）─────────────────────
  const { searchIndex, pinyinMatchFn } = useSearchBridgeSync({
    active: open,
    tabs,
    archiveSessions,
    normalizedQuery,
  });

  // ── 结果计算 ──────────────────────────────────────────────────────────────
  const { sections, flatItems, firstWebItemIndex } = useSearchResults({
    normalizedQuery,
    lowerQuery,
    isTagScopedQuery,
    lowerSearchText,
    tabs,
    tagsByUrl,
    searchScope,
    searchSortBy,
    enablePinyin,
    pinyinMatchFn,
    searchIndex,
    recentSearches,
    historyForHot,
    trendingCache,
    historyPermission,
    historyEntries,
    closedTabRecords,
    historyEnabled,
    effectiveHotSource,
    useHistorySuggestions,
    autoFallbackToWeb,
    currentEngine,
    currentEngineOption,
    enabledEngines,
    customEngines,
    onOpenHistory,
    archiveSessions,
  });

  // activeIndex 越界保护
  useEffect(() => {
    if (flatItems.length === 0) {
      if (activeIndex !== 0) setActiveIndex(0);
      return;
    }
    if (activeIndex >= flatItems.length) setActiveIndex(flatItems.length - 1);
  }, [activeIndex, flatItems.length]);

  // currentEngine 合法性保护
  useEffect(() => {
    if (!enabledEngines.includes(currentEngine)) {
      setCurrentEngine(enabledEngines[0] ?? "google");
    }
  }, [currentEngine, enabledEngines]);

  // 从 localStorage 恢复上次选择的搜索引擎
  useEffect(() => {
    const saved = getLastSearchEngine() as SearchEngineId | undefined;
    if (saved !== undefined && enabledEngines.includes(saved)) {
      setCurrentEngine(saved);
    }
  }, [enabledEngines]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const runWebSearch = useCallback(
    async (searchQuery: string, engineId: SearchEngineId = currentEngine, active = true) => {
      const trimmed = searchQuery.trim();
      if (trimmed === "") return;
      const url = buildSearchUrl(engineId, trimmed, customEngines);
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
        try {
          window.open(url, "_blank", "noopener,noreferrer");
          close();
        } catch {
          /* 彻底失败时静默处理 */
        }
        console.error("[SearchBox] runWebSearch failed:", err);
      }
    },
    [close, currentEngine, customEngines, setRecentSearches],
  );

  /**
   * 统一的 URL 打开辅助函数：
   * 1. 优先使用 chrome.tab.create（保留 opener 等上下文）
   * 2. 失败时降级为 window.open（保证用户总能得到结果）
   * 3. 统一记录错误日志
   */
  const openUrlSafely = useCallback(
    async (url: string, active = true, options?: { pinned?: boolean }) => {
      try {
        await createTab({ url, active, ...options });
        close();
      } catch (err) {
        try {
          window.open(url, "_blank", "noopener,noreferrer");
          close();
        } catch {
          /* 彻底失败时静默处理 */
        }
        console.error("[SearchBox] openUrlSafely failed:", err);
      }
    },
    [close],
  );

  const handleActivate = useCallback(
    (item: ReturnType<typeof useSearchResults>["flatItems"][number]) => {
      switch (item.type) {
        case "tab":
          void jumpToTab(item.tab.id, item.tab.windowId);
          close();
          break;
        case "history":
          void openUrlSafely(item.entry.url);
          break;
        case "closed":
          void (async () => {
            await openUrlSafely(item.record.url, true, { pinned: item.record.pinned });
            await deleteClosedTab(item.record.id);
            setClosedTabRecords((prev) => prev.filter((r) => r.id !== item.record.id));
          })();
          break;
        case "archive":
          void openUrlSafely(item.url);
          break;
        case "bookmark":
          void openUrlSafely(item.url);
          break;
        case "suggestion":
          void runWebSearch(item.keyword, currentEngine);
          break;
        case "web":
          void runWebSearch(item.query, item.engineId);
          break;
        case "permission":
          void enableHistorySuggestions();
          break;
        case "command":
          if (item.commandId === "open-history" && onOpenHistory !== undefined) {
            close();
            onOpenHistory();
          }
          break;
      }
    },
    [
      close,
      currentEngine,
      enableHistorySuggestions,
      jumpToTab,
      onOpenHistory,
      openUrlSafely,
      runWebSearch,
      setClosedTabRecords,
    ],
  );

  // ── 键盘导航 ──────────────────────────────────────────────────────────────
  const { handleKeyDown } = useKeyboardNav({
    activeIndex,
    flatItems,
    firstWebItemIndex,
    normalizedQuery,
    currentEngine,
    enabledEngines,
    setActiveIndex,
    setQuery,
    setDebouncedQuery,
    close,
    handleActivate,
    runWebSearch,
  });

  const handleAfterOpenChange = useCallback(
    (visible: boolean) => {
      if (!visible) return;
      setQuery("");
      setDebouncedQuery("");
      setActiveIndex(0);
      setEnginePopoverOpen(false);
      inputRef.current?.focus();
    },
    [setDebouncedQuery],
  );

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

  // ── 清除最近搜索 ──
  const [clearing, setClearing] = useState(false);
  const handleClearRecent = useCallback(async () => {
    setClearing(true);
    try {
      await setData(STORAGE_KEYS.searchHistory, []);
      setRecentSearches([]);
    } catch {
      /* ignore */
    } finally {
      setClearing(false);
    }
  }, [setRecentSearches]);

  // ── 刷新热词 ──
  const [refreshing, setRefreshing] = useState(false);
  const handleRefreshTrending = useCallback(async () => {
    setRefreshing(true);
    try {
      const boards = await fetchMultipleBoards(SEARCH_TRENDING_PLATFORMS, 3);
      setTrendingCache({ boards, lastRefreshAt: Date.now() });
    } catch {
      /* ignore */
    } finally {
      setRefreshing(false);
    }
  }, [setTrendingCache]);


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
                aria-label={t("搜索引擎切换")}
              >
                {engineOptions.map((option, idx) => {
                  const active = option.id === currentEngine;
                  const shortcut = idx < 9 ? `⌘${idx + 1}` : undefined;
                  return (
                    <li
                      key={option.id}
                      role="option"
                      aria-selected={active}
                      className={`${styles["search-box-engine-menu-item"]} ${active ? styles["is-active"] : ""}`}
                      style={{ "--searchbox-engine-color": option.color } as React.CSSProperties}
                      onClick={() => {
                        setCurrentEngine(option.id);
                        setLastSearchEngine(option.id);
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
                          />
                        ) : (
                          option.label.slice(0, 1).toUpperCase()
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
              aria-label={t("搜索引擎切换")}
              title={currentEngineOption.label}
            >
              <span className={styles["search-box-engine-logo"]} aria-hidden="true">
                {currentEngineOption.iconUrl ? (
                  <Image
                    src={currentEngineOption.iconUrl}
                    alt=""
                    preview={false}
                    fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                  />
                ) : (
                  currentEngineOption.label.slice(0, 1).toUpperCase()
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
            placeholder={t("搜索标签页、历史记录或直接全网搜索...")}
            prefix={
              <Search size={ICON_SIZE.MEDIUM} className={styles["search-box-input-prefix"]} />
            }
            allowClear
            variant="borderless"
            autoComplete="off"
            spellCheck={false}
            aria-label={t("搜索标签页、历史记录或直接全网搜索...")}
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
              aria-label={t("查看全部历史")}
              title={t("查看全部历史")}
            >
              <History size={ICON_SIZE.SMALL} aria-hidden="true" />
            </Button>
          )}
        </div>

        <div className={styles["search-box-list-area"]}>
          {flatItems.length === 0
            ? (() => {
                const title = historyLoading
                  ? t("正在加载历史建议...")
                  : normalizedQuery !== ""
                    ? t("试试其他关键词，或直接执行网页搜索")
                    : t("先输入关键词，或从最近搜索和热门话题开始");
                return (
                  <div className={styles["search-box-empty"]}>
                    <FeatureEmptyState
                      title={title}
                      icon={<Search size={20} className={styles["search-box-empty-icon"]} />}
                      size="small"
                      hints={
                        normalizedQuery !== ""
                          ? [t("尝试使用 site: 语法限定域名"), t("尝试使用 in: 语法限定范围")]
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
                      <Typography.Text>{section.title}</Typography.Text>
                      <span className={styles["search-box-section-count"]}>
                        {section.items.length}
                      </span>
                    </div>
                    <div role="listbox" className={styles["search-box-list"]}>
                      {section.items.map((item, offset) => {
                        const itemIndex = startIndex + offset;
                        return (
                          <SearchResultItem
                            key={item.id}
                            item={item}
                            index={itemIndex}
                            active={itemIndex === activeIndex}
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
              ? t("找到 {count} 个候选项", { count: flatItems.length })
              : t("输入后可在本地与网页结果间快速切换")}
          </span>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {recentSearches.length > 0 && (
              <Tooltip title={t("清空最近搜索")}>
                <Button type="text" size="small" loading={clearing} icon={<Trash2 size={13} />} onClick={handleClearRecent} />
              </Tooltip>
            )}
            {effectiveHotSource === "trending" && (
              <Tooltip title={t("刷新热词")}>
                <Button type="text" size="small" loading={refreshing} icon={<RefreshCw size={13} />} onClick={handleRefreshTrending} />
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
