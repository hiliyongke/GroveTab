/**
 * Popup 主内容区：搜索框 + 工具栏 + Tab 列表 + 底部操作。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Dropdown,
  Empty,
  Input,
  message,
  Popconfirm,
  Tooltip,
  Typography,
} from "antd";
import {
  LayoutGrid,
  Save,
  Search,
  CopyX,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FolderTree,
  Trash2,
  Monitor,
  MonitorOff,
} from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { archiveCurrentWindowTabs } from "@/services";
import { BRAND } from "@/shared/config/brand";
import { buildSearchUrl } from "@/shared/config/search-engines";
import type { SearchEngineId } from "@/shared/types";
import { getSettings, saveSettings } from "@/repositories";
import { closeTab, createTab, getFaviconUrl, queryAllTabs } from "@/chrome";
import { useT } from "@/shared/i18n";
import { pinyinMatch } from "@/shared/utils/pinyin";
import {
  type RecentTab,
  type SortMode,
  SORT_OPTIONS,
  extractHostname,
  sortTabs,
  focusTab,
} from "./sort-utils";
import { RecentTabRow } from "./RecentTabRow";
import { PopupDomainGroup } from "./PopupDomainGroup";

const { Text } = Typography;

export function PopupContent() {
  const [query, setQuery] = useState("");
  const [recentTabs, setRecentTabs] = useState<RecentTab[]>([]);
  const [hasAnyTab, setHasAnyTab] = useState(true);
  const archivingRef = useRef(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const [defaultEngine, setDefaultEngine] = useState<SearchEngineId>("google");
  const [loaded, setLoaded] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [sortAsc, setSortAsc] = useState(false);
  const [groupByDomain, setGroupByDomain] = useState(false);
  const [overrideNewTab, setOverrideNewTab] = useState(true);
  const [dedupRunning, setDedupRunning] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);
  const runWebSearchRef = useRef<() => void>(() => {});
  const focusIndexRef = useRef(focusIndex);
  focusIndexRef.current = focusIndex;
  const [messageApi, contextHolder] = message.useMessage();
  const { t } = useT();

  const refreshTabs = useCallback(async () => {
    try {
      const all = await queryAllTabs();
      setHasAnyTab(all.length > 0);
      const list: RecentTab[] = all
        .filter(
          (tab) =>
            tab.id !== undefined && tab.url !== undefined && tab.url !== "",
        )
        .map((tab) => {
          const url = tab.url ?? "";
          const extensionFavicon = getFaviconUrl(url);
          return {
            id: tab.id!,
            windowId: tab.windowId,
            title: tab.title ?? url,
            url,
            favIconUrl:
              extensionFavicon !== ""
                ? extensionFavicon
                : (tab.favIconUrl ?? ""),
            hostname: extractHostname(url),
            lastAccessed: tab.lastAccessed ?? 0,
          };
        })
        .sort((a, b) => b.lastAccessed - a.lastAccessed);
      setRecentTabs(list);
      setLoaded(true);
    } catch (err) {
      console.warn(`${BRAND.logTag}/popup query tabs failed`, err);
    }
  }, []);

  // ── 加载持久化偏好 ──
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const settings = await getSettings();
        if (!alive) return;
        if (settings.searchDefaultEngine) {
          setDefaultEngine(settings.searchDefaultEngine);
        }
        if (settings.popupSortMode)
          setSortMode(settings.popupSortMode as SortMode);
        if (typeof settings.popupSortAsc === "boolean")
          setSortAsc(settings.popupSortAsc);
        if (typeof settings.popupGroupByDomain === "boolean")
          setGroupByDomain(settings.popupGroupByDomain);
        if (typeof settings.overrideNewTab === "boolean")
          setOverrideNewTab(settings.overrideNewTab);
      } catch {
        /* 兑底默认 */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ── 持久化偏好 ──
  useEffect(() => {
    void saveSettings({
      popupSortMode: sortMode,
      popupSortAsc: sortAsc,
      popupGroupByDomain: groupByDomain,
      overrideNewTab: overrideNewTab,
    });
  }, [sortMode, sortAsc, groupByDomain, overrideNewTab]);

  // ── Tab 事件监听 ──
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const requestTabsRefresh = () => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        void refreshTabs();
      }, 300);
    };
    const requestImmediate = () => {
      void refreshTabs();
    };
    requestImmediate();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") requestTabsRefresh();
    };

    chrome.tabs?.onCreated?.addListener?.(requestTabsRefresh);
    chrome.tabs?.onUpdated?.addListener?.(requestTabsRefresh);
    chrome.tabs?.onRemoved?.addListener?.(requestTabsRefresh);
    chrome.tabs?.onActivated?.addListener?.(requestTabsRefresh);
    chrome.tabs?.onMoved?.addListener?.(requestTabsRefresh);
    chrome.tabs?.onAttached?.addListener?.(requestTabsRefresh);
    chrome.tabs?.onDetached?.addListener?.(requestTabsRefresh);
    chrome.tabs?.onReplaced?.addListener?.(requestTabsRefresh);
    chrome.windows?.onCreated?.addListener?.(requestTabsRefresh);
    chrome.windows?.onRemoved?.addListener?.(requestTabsRefresh);
    chrome.windows?.onFocusChanged?.addListener?.(requestTabsRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", requestTabsRefresh);
    window.addEventListener("pageshow", requestTabsRefresh);

    return () => {
      if (timer !== null) clearTimeout(timer);
      chrome.tabs?.onCreated?.removeListener?.(requestTabsRefresh);
      chrome.tabs?.onUpdated?.removeListener?.(requestTabsRefresh);
      chrome.tabs?.onRemoved?.removeListener?.(requestTabsRefresh);
      chrome.tabs?.onActivated?.removeListener?.(requestTabsRefresh);
      chrome.tabs?.onMoved?.removeListener?.(requestTabsRefresh);
      chrome.tabs?.onAttached?.removeListener?.(requestTabsRefresh);
      chrome.tabs?.onDetached?.removeListener?.(requestTabsRefresh);
      chrome.tabs?.onReplaced?.removeListener?.(requestTabsRefresh);
      chrome.windows?.onCreated?.removeListener?.(requestTabsRefresh);
      chrome.windows?.onRemoved?.removeListener?.(requestTabsRefresh);
      chrome.windows?.onFocusChanged?.removeListener?.(requestTabsRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", requestTabsRefresh);
      window.removeEventListener("pageshow", requestTabsRefresh);
    };
  }, [refreshTabs]);

  // ── 派生数据 ──
  const filteredTabs = useMemo(() => {
    const q = query.trim();
    if (q === "") return recentTabs;
    const lowerQ = q.toLowerCase();
    return recentTabs.filter(
      (tab) =>
        tab.title.toLowerCase().includes(lowerQ) ||
        tab.url.toLowerCase().includes(lowerQ) ||
        tab.hostname.toLowerCase().includes(lowerQ) ||
        pinyinMatch(tab.title, q) ||
        pinyinMatch(tab.hostname, q),
    );
  }, [recentTabs, query]);

  const displayTabs = useMemo(
    () => sortTabs(filteredTabs, sortMode, sortAsc),
    [filteredTabs, sortMode, sortAsc],
  );

  const displayTabsRef = useRef(displayTabs);
  displayTabsRef.current = displayTabs;

  const groupedTabs = useMemo(() => {
    if (!groupByDomain) return null;
    const groups = new Map<string, RecentTab[]>();
    for (const tab of displayTabs) {
      const list = groups.get(tab.hostname) || [];
      list.push(tab);
      groups.set(tab.hostname, list);
    }
    return Array.from(groups.entries());
  }, [displayTabs, groupByDomain]);

  const dupCount = useMemo(() => {
    const seen = new Map<string, number>();
    for (const tab of recentTabs) {
      seen.set(tab.url, (seen.get(tab.url) || 0) + 1);
    }
    let count = 0;
    for (const c of seen.values()) {
      if (c > 1) count += c - 1;
    }
    return count;
  }, [recentTabs]);

  // 搜索词变化时重置键盘焦点
  useEffect(() => {
    setFocusIndex(-1);
  }, [query]);

  // 滚动聚焦行到可见区域
  useEffect(() => {
    if (focusIndex < 0 || !listRef.current) return;
    const rows = listRef.current.querySelectorAll(".popup-row");
    const row = rows[focusIndex] as HTMLElement | undefined;
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusIndex]);

  const isSearching = query.trim() !== "";
  const tabCountLabel = isSearching
    ? t("匹配 {matched} / 共 {total} 个", {
        matched: filteredTabs.length,
        total: recentTabs.length,
      })
    : t("全部 {count} 个标签页", { count: recentTabs.length });

  // ── 操作 ──
  const openNewTab = useCallback(() => {
    void createTab({ url: chrome.runtime.getURL("src/pages/newtab/index.html") });
    window.close();
  }, []);

  const archiveAll = useCallback(async () => {
    if (archivingRef.current) return;
    archivingRef.current = true;
    setArchiving(true);
    setArchiveError("");
    try {
      await archiveCurrentWindowTabs();
      window.close();
    } catch (err) {
      console.warn(`${BRAND.logTag}/popup archive failed`, err);
      setArchiveError(t("归档失败，请重试"));
      archivingRef.current = false;
    } finally {
      setArchiving(false);
    }
  }, [t]);

  const runWebSearch = useCallback(() => {
    const q = query.trim();
    if (q === "") return;
    void createTab({ url: buildSearchUrl(defaultEngine, q), active: true });
    window.close();
  }, [query, defaultEngine]);

  // ref 保持最新 runWebSearch，避免键盘 effect 依赖顺序问题
  useEffect(() => {
    runWebSearchRef.current = runWebSearch;
  }, [runWebSearch]);

  // 键盘导航 — 只注册一次，通过 ref 读取最新值
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tabs = displayTabsRef.current;
      if (tabs.length === 0) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "BUTTON" || tag === "A" || tag === "LI") return;
      const idx = focusIndexRef.current;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIndex((prev) => (prev + 1 >= tabs.length ? 0 : prev + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIndex((prev) => (prev <= 0 ? tabs.length - 1 : prev - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (idx >= 0) {
          const tab = tabs[idx];
          if (tab) void focusTab(tab).then(() => window.close());
        } else {
          runWebSearchRef.current();
        }
      } else if (e.key === "Escape") {
        setFocusIndex(-1);
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, []);

  const handleDedup = useCallback(async () => {
    if (dedupRunning || dupCount === 0) return;
    setDedupRunning(true);
    try {
      const seen = new Map<string, RecentTab>();
      const toClose: number[] = [];
      for (const tab of recentTabs) {
        const existing = seen.get(tab.url);
        if (existing) {
          if (tab.lastAccessed > existing.lastAccessed) {
            toClose.push(existing.id);
            seen.set(tab.url, tab);
          } else {
            toClose.push(tab.id);
          }
        } else {
          seen.set(tab.url, tab);
        }
      }
      for (const id of toClose) {
        try { await closeTab(id); } catch { /* ignore */ }
      }
      setRecentTabs((prev) => prev.filter((t) => !toClose.includes(t.id)));
      void refreshTabs();
      messageApi.success(t("已关闭 {count} 个重复标签页", { count: toClose.length }));
    } catch {
      messageApi.error(t("去重失败"));
    } finally {
      setDedupRunning(false);
    }
  }, [dedupRunning, dupCount, recentTabs, refreshTabs, messageApi]);

  const handleCloseOne = useCallback(
    async (tabId: number) => {
      try {
        await closeTab(tabId);
        setRecentTabs((list) => list.filter((t) => t.id !== tabId));
        void refreshTabs();
      } catch { /* ignore */ }
    },
    [refreshTabs],
  );

  const handleCloseAll = useCallback(async () => {
    const ids = recentTabs.map((t) => t.id);
    for (const id of ids) {
      try { await closeTab(id); } catch { /* ignore */ }
    }
    setRecentTabs([]);
    void refreshTabs();
    messageApi.success(t("已关闭全部标签页"));
  }, [recentTabs, refreshTabs, messageApi]);

  // ── Render ──
  return (
    <div className="popup-shell">
      {contextHolder}
      <Input
        autoFocus
        size="middle"
        allowClear
        className="popup-search"
        placeholder={t("搜索标签页或上网（回车）")}
        prefix={<Search size={ICON_SIZE.MEDIUM} className="popup-search-icon" />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="popup-meta">
        <Text type="secondary" className="popup-meta-text">
          {tabCountLabel}
        </Text>
        <div className="popup-toolbar">
          <Tooltip title={!hasAnyTab ? t("当前没有可归档的标签页") : ""} mouseEnterDelay={0.3}>
            <Button
              type="text"
              size="small"
              icon={<Save size={ICON_SIZE.SMALL} />}
              loading={archiving}
              disabled={!hasAnyTab || archiving}
              onClick={() => void archiveAll()}
              className="popup-toolbar-btn"
            >
              {t("归档")}
            </Button>
          </Tooltip>

          <span className="popup-toolbar-sep" />

          <Tooltip title={t("一键去重：保留最近访问的标签页，关闭重复项")}>
            <Button
              type="text"
              size="small"
              icon={<CopyX size={ICON_SIZE.SMALL} />}
              disabled={dupCount === 0 || dedupRunning}
              loading={dedupRunning}
              onClick={() => void handleDedup()}
              className="popup-toolbar-btn"
            >
              {dupCount > 0 ? `${t("去重")} ${dupCount}` : t("去重")}
            </Button>
          </Tooltip>

          <Dropdown
            trigger={["click"]}
            menu={{
              items: SORT_OPTIONS.map((opt) => ({
                key: opt.value,
                label: opt.label,
                icon:
                  sortMode === opt.value ? (
                    <span style={{ fontSize: 10 }}>●</span>
                  ) : undefined,
                onClick: () => setSortMode(opt.value),
              })),
            }}
          >
            <Button
              type="text"
              size="small"
              icon={<ArrowUpDown size={ICON_SIZE.SMALL} />}
              className="popup-toolbar-btn"
            >
              {SORT_OPTIONS.find((o) => o.value === sortMode)?.label ?? t("最近")}
            </Button>
          </Dropdown>

          <Tooltip title={sortAsc ? t("降序") : t("升序")}>
            <Button
              type="text"
              size="small"
              icon={
                sortAsc ? (
                  <ArrowUp size={ICON_SIZE.SMALL} />
                ) : (
                  <ArrowDown size={ICON_SIZE.SMALL} />
                )
              }
              onClick={() => setSortAsc((v) => !v)}
              className="popup-toolbar-btn"
            />
          </Tooltip>

          <span className="popup-toolbar-sep" />

          <Tooltip title={t("按域名分组显示")}>
            <Button
              type="text"
              size="small"
              icon={<FolderTree size={ICON_SIZE.SMALL} />}
              onClick={() => setGroupByDomain((v) => !v)}
              className={`popup-toolbar-btn ${groupByDomain ? "popup-toolbar-btn--active" : ""}`}
            />
          </Tooltip>

          <Tooltip title={overrideNewTab ? t("已接管新标签页") : t("已关闭接管，新标签页恢复默认")}>
            <Button
              type="text"
              size="small"
              icon={
                overrideNewTab ? (
                  <Monitor size={ICON_SIZE.SMALL} />
                ) : (
                  <MonitorOff size={ICON_SIZE.SMALL} />
                )
              }
              onClick={() => setOverrideNewTab((v) => !v)}
              className={`popup-toolbar-btn ${!overrideNewTab ? "popup-toolbar-btn--warning" : ""}`}
            />
          </Tooltip>

          <Popconfirm
            title={t("确定关闭全部标签页？")}
            onConfirm={() => void handleCloseAll()}
            okText={t("关闭")}
            cancelText={t("取消")}
            placement="bottomRight"
          >
            <Tooltip title={t("关闭全部标签页")}>
              <Button
                type="text"
                size="small"
                danger
                disabled={recentTabs.length === 0}
                icon={<Trash2 size={ICON_SIZE.SMALL} />}
                className="popup-toolbar-btn"
              />
            </Tooltip>
          </Popconfirm>
        </div>
      </div>

      <div className="popup-list" ref={listRef}>
        {displayTabs.length === 0 ? (
          <div className="popup-list-empty">
            {!loaded ? (
              <Text type="secondary" className="popup-empty-text">{t("加载中…")}</Text>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Text type="secondary" className="popup-empty-text">
                    {t("暂无最近标签")}
                  </Text>
                }
              />
            )}
          </div>
        ) : groupedTabs ? (() => {
            let idx = 0;
            return groupedTabs.map(([hostname, tabs]) => {
              const baseIdx = idx;
              idx += tabs.length;
              return (
                <PopupDomainGroup
                  key={hostname}
                  hostname={hostname}
                  tabs={tabs}
                  baseIndex={baseIdx}
                  focusIndex={focusIndex}
                  onFocusTab={(tab) => {
                    void focusTab(tab).then(() => window.close());
                  }}
                  onCloseTab={(tab) => { void handleCloseOne(tab.id); }}
            />
            );
          });
        })() : (
          displayTabs.map((tab, i) => (
            <RecentTabRow
              key={tab.id}
              tab={tab}
              focused={i === focusIndex}
              onClick={() => {
                void focusTab(tab).then(() => window.close());
              }}
              onClose={() => { void handleCloseOne(tab.id); }}
            />
          ))
        )}
      </div>

      <div className="popup-footer">
        <span className="popup-footer-brand">{BRAND.name}</span>
        <Button
          type="text"
          size="small"
          icon={<LayoutGrid size={ICON_SIZE.SMALL} />}
          onClick={openNewTab}
          className="popup-footer-btn"
        >
          {t("工作台")}
        </Button>
      </div>

      {archiveError !== "" && (
        <div className="popup-error">{archiveError}</div>
      )}
    </div>
  );
}
