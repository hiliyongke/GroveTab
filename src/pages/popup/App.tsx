/**
 * Popup 工具栏轻量版（F-26）
 *
 * 400×600 三区：
 *   · 顶部：全局搜索框
 *   · 中部：全部已打开 Tab 列表（按 lastAccessed 倒序）
 *   · 底部：归档、工作台、设置等轻量操作
 *
 * 首屏 ≤ 200ms：只加载 popup 必需能力。
 * 无 Tab 时归档按钮置灰 + 提示。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, Tooltip, Typography, Empty } from "antd";
import { AntdThemeProvider } from "@/shared/ui/AntdThemeProvider";
import { LayoutGrid, Save, Search, ExternalLink, X, Settings } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { archiveCurrentWindowTabs } from "@/services";
import { BRAND } from "@/shared/config/brand";
import { buildSearchUrl } from "@/shared/config/search-engines";
import type { SearchEngineId } from "@/shared/types";
import { getSettings } from "@/repositories";
import { activateTab, closeTab, createTab, getFaviconUrl, queryAllTabs } from "@/chrome";
import { I18nProvider, useT } from "@/shared/i18n";

const { Text } = Typography;

interface RecentTab {
  id: number;
  windowId: number;
  title: string;
  url: string;
  favIconUrl: string;
  hostname: string;
  lastAccessed: number;
}

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/** 打开一个 Tab：激活该 Tab 并聚焦其窗口 */
async function focusTab(tab: RecentTab): Promise<void> {
  try {
    await activateTab(tab.id, tab.windowId);
  } catch {
    // 若目标 Tab 不存在（已关闭），兜底：新开该 URL
    if (tab.url && !tab.url.startsWith("chrome://") && !tab.url.startsWith("chrome-extension://")) {
      try {
        await createTab({ url: tab.url, active: true });
      } catch (err) {
        console.warn("[Popup] focusTab: createTab failed", err);
      }
    }
  }
}

function PopupContent() {
  const [query, setQuery] = useState("");
  const [recentTabs, setRecentTabs] = useState<RecentTab[]>([]);
  const [hasAnyTab, setHasAnyTab] = useState(true);
  const archivingRef = useRef(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  /** 从用户设置读默认搜索引擎；暂以 Google 兑底 */
  const [defaultEngine, setDefaultEngine] = useState<SearchEngineId>("google");
  const { t } = useT();

  const refreshTabs = useCallback(async () => {
    try {
      const all = await queryAllTabs();
      setHasAnyTab(all.length > 0);
      const list: RecentTab[] = all
        .filter((tab) => tab.id !== undefined && tab.url !== undefined && tab.url !== "")
        .map((tab) => {
          const url = tab.url ?? "";
          const extensionFavicon = getFaviconUrl(url);
          return {
            id: tab.id!,
            windowId: tab.windowId,
            title: tab.title ?? url,
            url,
            favIconUrl: extensionFavicon !== "" ? extensionFavicon : (tab.favIconUrl ?? ""),
            hostname: extractHostname(url),
            lastAccessed: tab.lastAccessed ?? 0,
          };
        })
        .sort((a, b) => b.lastAccessed - a.lastAccessed);
      setRecentTabs(list);
    } catch (err) {
      console.warn(`${BRAND.logTag}/popup query tabs failed`, err);
    }
  }, []);

  // 读设置同步默认引擎
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const settings = await getSettings();
        if (alive && settings.searchDefaultEngine) {
          setDefaultEngine(settings.searchDefaultEngine);
        }
      } catch {
        /* 兑底 google */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const requestTabsRefresh = () => {
      void refreshTabs();
    };

    requestTabsRefresh();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestTabsRefresh();
      }
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

  const filteredTabs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return recentTabs;
    return recentTabs.filter(
      (tab) =>
        tab.title.toLowerCase().includes(q) ||
        tab.url.toLowerCase().includes(q) ||
        tab.hostname.toLowerCase().includes(q),
    );
  }, [recentTabs, query]);
  const isSearching = query.trim() !== "";
  const tabCountLabel = isSearching
    ? t("匹配 {matched} / 共 {total} 个", {
        matched: filteredTabs.length,
        total: recentTabs.length,
      })
    : t("全部 {count} 个标签页", { count: recentTabs.length });

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

  /** 快速走全网搜索（回车时触发）—— 使用用户默认引擎 */
  const runWebSearch = useCallback(() => {
    const q = query.trim();
    if (q === "") return;
    void createTab({ url: buildSearchUrl(defaultEngine, q), active: true });
    window.close();
  }, [query, defaultEngine]);

  return (
    <div className="popup-shell">
      {/* 顶部搜索框 */}
      <Input
        autoFocus
        size="middle"
        allowClear
        className="popup-search"
        placeholder={t("搜索标签页或上网（回车）")}
        prefix={<Search size={ICON_SIZE.MEDIUM} className="popup-search-icon" />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onPressEnter={runWebSearch}
      />

      <div className="popup-meta">
        <Text type="secondary" className="popup-meta-text">
          {tabCountLabel}
        </Text>
        {filteredTabs.length > 0 && (
          <Text type="secondary" className="popup-meta-hint">
            {t("滚动查看全部")}
          </Text>
        )}
      </div>

      {/* 中部：全部 Tab 列表 */}
      <div className="popup-list">
        {filteredTabs.length === 0 ? (
          <div className="popup-list-empty">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Text type="secondary" className="popup-empty-text">
                  {t("暂无最近标签")}
                </Text>
              }
            />
          </div>
        ) : (
          filteredTabs.map((tab) => (
            <RecentTabRow
              key={tab.id}
              tab={tab}
              onClick={() => {
                void focusTab(tab).then(() => window.close());
              }}
              onClose={() => {
                void (async () => {
                  try {
                    await closeTab(tab.id);
                    setRecentTabs((list) => list.filter((t) => t.id !== tab.id));
                    void refreshTabs();
                  } catch {
                    /* 关闭失败静默 */
                  }
                })();
              }}
            />
          ))
        )}
      </div>

      {/* 底部：操作按钮区 */}
      <div className="popup-actions">
        {/* 主操作：归档 —— 独占整行 */}
        <Tooltip title={!hasAnyTab ? t("当前没有可归档的标签页") : ""} mouseEnterDelay={0.3}>
          <Button
            type="primary"
            icon={<Save size={ICON_SIZE.MEDIUM} />}
            block
            loading={archiving}
            disabled={!hasAnyTab || archiving}
            onClick={() => {
              void archiveAll();
            }}
            className="popup-actions__primary"
          >
            {t("归档当前窗口")}
          </Button>
        </Tooltip>
        {/* 次要操作：打开工作台 + 设置 —— 并排 */}
        <div className="popup-actions__secondary">
          <Button icon={<LayoutGrid size={ICON_SIZE.MEDIUM} />} block onClick={openNewTab}>
            {t("打开工作台")}
            <ExternalLink size={ICON_SIZE.MICRO} className="popup-external-icon" />
          </Button>
          <Button
            icon={<Settings size={ICON_SIZE.MEDIUM} />}
            block
            onClick={() => {
              void createTab({
                url: chrome.runtime.getURL("src/pages/newtab/index.html") + "#settings",
              });
              window.close();
            }}
          >
            {t("设置")}
          </Button>
        </div>
      </div>

      {/* 底部"关于"链接：跳转 newtab 并自动切到 About Tab */}
      <div className="popup-about">
        <Button
          type="text"
          onClick={() => {
            void createTab({
              url: chrome.runtime.getURL("src/pages/newtab/index.html") + "#about",
            });
            window.close();
          }}
          className="popup-about-link"
        >
          {t("关于 {brand}", { brand: BRAND.name })}
        </Button>
      </div>

      {archiveError !== "" && <div className="popup-error">{archiveError}</div>}
    </div>
  );
}

/** 单行最近 Tab */
function RecentTabRow({
  tab,
  onClick,
  onClose,
}: {
  tab: RecentTab;
  onClick: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  return (
    <div className="popup-row app-hover-reveal-host">
      <Button
        type="text"
        onClick={onClick}
        aria-label={t("打开 {title}", { title: tab.title })}
        className="popup-row-main"
      >
        <img
          src={tab.favIconUrl}
          alt=""
          width={14}
          height={14}
          referrerPolicy="no-referrer"
          className="popup-row-favicon"
          onError={(e) => {
            e.currentTarget.style.visibility = "hidden";
          }}
        />
        <div className="popup-row-content">
          <span className="popup-row-title">{tab.title}</span>
          <span className="popup-row-host">{tab.hostname}</span>
        </div>
      </Button>
      <Button
        type="text"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label={t("关闭标签页 {title}", { title: tab.title })}
        className="popup-row-close app-hover-reveal"
      >
        <X size={ICON_SIZE.SMALL} />
      </Button>
    </div>
  );
}

function App() {
  return (
    <AntdThemeProvider>
      <I18nProvider>
        <PopupContent />
      </I18nProvider>
    </AntdThemeProvider>
  );
}

export default App;
