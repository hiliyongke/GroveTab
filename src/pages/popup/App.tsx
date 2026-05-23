/**
 * Popup 工具栏轻量版（F-26）
 *
 * 360×520 四区：
 *   · 顶部：全局搜索框（懒加载搜索核心）
 *   · 中部：全部已打开 Tab 列表（按 lastAccessed 倒序）
 *   · 底部：归档当前窗口（大按钮，复用 archiveCurrentWindowTabs）
 *   · 底部：打开工作台（切到扩展新标签页）
 *
 * 首屏 ≤ 200ms：不进行重的懒加载，SearchBox 以 React.lazy 延迟加载。
 * 无 Tab 时归档按钮置灰 + 提示。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input, Tooltip, Typography, Empty } from "antd";
import { AntdThemeProvider } from "@/shared/ui/AntdThemeProvider";
import { LayoutGrid, Save, Search, ExternalLink, X, Settings } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { archiveCurrentWindowTabs } from "@/services";
import { BRAND } from "@/shared/config/brand";
import { buildSearchUrl } from "@/shared/config/search-engines";
import type { SearchEngineId } from "@/shared/types";
import { getSettings } from "@/repositories";
import {
  activateTab,
  closeTab,
  createTab,
  getFaviconUrl,
  queryAllTabs,
  extractHostname,
} from "@/chrome";
import { I18nProvider, useT } from "@/shared/i18n";
import styles from "./styles/index.module.less";

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

/**
 * 打开一个 Tab：激活该 Tab 并聚焦其窗口
 *
 * 若目标 Tab 不存在（已关闭），兜底新开该 URL。
 *
 * @param tab 最近标签页对象
 * @returns 无返回值（异步操作）
 */
async function focusTab(tab: RecentTab): Promise<void> {
  try {
    await activateTab(tab.id, tab.windowId);
  } catch {
    // 若目标 Tab 不存在（已关闭），兜底：新开该 URL
    try {
      await createTab({ url: tab.url, active: true });
    } catch (err) {
      console.warn("[Popup] focusTab: createTab failed", err);
    }
  }
}

/**
 * PopupContent —— 弹出窗口主内容组件
 *
 * 360×520 四区布局：
 *   - 顶部：全局搜索框
 *   - 中部：最近打开的标签页列表
 *   - 底部：归档当前窗口按钮 + 打开工作台按钮
 *
 * @returns 弹出窗口主界面 JSX
 */
function PopupContent() {
  const [query, setQuery] = useState("");
  const [recentTabs, setRecentTabs] = useState<RecentTab[]>([]);
  const [hasAnyTab, setHasAnyTab] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  /** 从用户设置读默认搜索引擎；暂以 Google 兑底 */
  const [defaultEngine, setDefaultEngine] = useState<SearchEngineId>("google");
  const { t } = useT();

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
    let alive = true;
    void (async () => {
      try {
        const all = await queryAllTabs();
        if (!alive) return;
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
    })();
    return () => {
      alive = false;
    };
  }, []);

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
    ? t("popup.matchingTabs", { matched: filteredTabs.length, total: recentTabs.length })
    : t("popup.allTabs", { count: recentTabs.length });

  const openNewTab = useCallback(() => {
    void createTab({ url: chrome.runtime.getURL("src/pages/newtab/index.html") });
    window.close();
  }, []);

  const archiveAll = useCallback(async () => {
    if (archiving) return;
    setArchiving(true);
    setArchiveError("");
    try {
      await archiveCurrentWindowTabs();
      window.close();
    } catch (err) {
      console.warn(`${BRAND.logTag}/popup archive failed`, err);
      setArchiveError(t("popup.archiveFailed"));
    } finally {
      setArchiving(false);
    }
  }, [archiving, t]);

  /** 快速走全网搜索（回车时触发）—— 使用用户默认引擎 */
  const runWebSearch = useCallback(() => {
    const q = query.trim();
    if (q === "") return;
    void createTab({ url: buildSearchUrl(defaultEngine, q), active: true });
    window.close();
  }, [query, defaultEngine]);

  return (
    <div className={styles.popupShell}>
      {/* 顶部品牌 */}
      <div className={styles.popupBrand}>
        <div className={styles.popupBrandMark}>{BRAND.shortName}</div>
        <Text strong className={styles.popupBrandName}>
          {BRAND.name}
        </Text>
      </div>

      {/* 顶部搜索框 */}
      <Input
        autoFocus
        size="middle"
        allowClear
        className={styles.popupSearch}
        placeholder={t("popup.searchPlaceholder")}
        prefix={<Search size={ICON_SIZE.MEDIUM} className={styles.popupSearchIcon} />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onPressEnter={runWebSearch}
      />

      <div className={styles.popupMeta}>
        <Text type="secondary" className={styles.popupMetaText}>
          {tabCountLabel}
        </Text>
        {filteredTabs.length > 0 && (
          <Text type="secondary" className={styles.popupMetaHint}>
            {t("popup.scrollHint")}
          </Text>
        )}
      </div>

      {/* 中部：全部 Tab 列表 */}
      <div className={styles.popupList}>
        {filteredTabs.length === 0 ? (
          <div className={styles.popupListEmpty}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Text type="secondary" className={styles.popupEmptyText}>
                  {t("popup.noRecentTabs")}
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
      <div className={styles.popupActions}>
        {/* 主操作：归档 —— 独占整行 */}
        <Tooltip title={!hasAnyTab ? t("popup.noTabsToArchive") : ""} mouseEnterDelay={0.3}>
          <Button
            type="primary"
            icon={<Save size={ICON_SIZE.MEDIUM} />}
            block
            loading={archiving}
            disabled={!hasAnyTab || archiving}
            onClick={() => {
              void archiveAll();
            }}
            className={styles.popupActionsPrimary}
          >
            {t("popup.archiveWindow")}
          </Button>
        </Tooltip>
        {/* 次要操作：打开工作台 + 设置 —— 并排 */}
        <div className={styles.popupActionsSecondary}>
          <Button icon={<LayoutGrid size={ICON_SIZE.MEDIUM} />} block onClick={openNewTab}>
            {t("popup.openWorkspace")}
            <ExternalLink size={ICON_SIZE.MICRO} className={styles.popupExternalIcon} />
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
            {t("header.settings")}
          </Button>
        </div>
      </div>

      {/* 底部"关于"链接：跳转 newtab 并自动切到 About Tab */}
      <div className={styles.popupAbout}>
        <button
          type="button"
          onClick={() => {
            void createTab({
              url: chrome.runtime.getURL("src/pages/newtab/index.html") + "#about",
            });
            window.close();
          }}
          className={styles.popupAboutLink}
        >
          {t("popup.aboutGroveTab", { brand: BRAND.name })}
        </button>
      </div>

      {archiveError !== "" && <div className={styles.popupError}>{archiveError}</div>}
    </div>
  );
}

/**
 * 单行最近 Tab 行组件
 *
 * 展示单个标签页的 favicon、标题、域名，
 * 支持点击激活和关闭操作。
 *
 * @param tab 最近标签页对象
 * @param tab.tab
 * @param onClick 点击行回调
 * @param tab.onClick
 * @param onClose 关闭按钮回调
 * @param tab.onClose
 * @returns 单行最近 Tab JSX
 */
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
    <div className={`${styles.popupRow} app-hover-reveal-host`}>
      <button
        type="button"
        onClick={onClick}
        aria-label={t("popup.openTab", { title: tab.title })}
        className={styles.popupRowMain}
      >
        <img
          src={tab.favIconUrl}
          alt=""
          width={14}
          height={14}
          referrerPolicy="no-referrer"
          className={styles.popupRowFavicon}
          onError={(e) => {
            e.currentTarget.style.visibility = "hidden";
          }}
        />
        <div className={styles.popupRowContent}>
          <span className={styles.popupRowTitle}>{tab.title}</span>
          <span className={styles.popupRowHost}>{tab.hostname}</span>
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label={t("popup.closeTab", { title: tab.title })}
        className={`${styles.popupRowClose} app-hover-reveal`}
      >
        <X size={ICON_SIZE.SMALL} />
      </button>
    </div>
  );
}

/**
 * App —— 弹出窗口根组件
 *
 * 包裹 AntdThemeProvider 与 I18nProvider，
 * 渲染 PopupContent 主内容。
 *
 * @returns 弹出窗口根节点 JSX
 */
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
