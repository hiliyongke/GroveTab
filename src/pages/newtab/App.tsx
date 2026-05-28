import { useEffect, useState, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import { Layout, Spin, Typography, FloatButton, Flex, Segmented, Drawer } from "antd";
import styles from "./App.module.less";
import { useTabsStore, useSettingsStore, useSelectionStore } from "@/store";
import { useShallow } from "zustand/shallow";
import {
  useSwBroadcast,
  useResolvedTheme,
  useAppInitialization,
  useAutoCleanup,
} from "@/shared/hooks";
import { useT } from "@/shared/i18n";
import { useKeybinding } from "@/shared/hooks/use-keybinding";
import { AntdThemeProvider } from "@/shared/ui/AntdThemeProvider";
import { ErrorBoundary } from "@/shared/ui/ErrorBoundary";
import { UndoToast } from "@/shared/ui/UndoToast";
import { I18nProvider } from "@/shared/i18n";
import { BatchActionBar } from "@/features/tabs/selection/BatchActionBar";
import { AppWorkspace } from "@/features/workspace/AppWorkspace";
const InsightsPanel = lazy(() =>
  import("@/features/insights/InsightsPanel").then((m) => ({ default: m.default })),
);
import { QuickStartLayer } from "@/features/quick-start/QuickStartLayer";
const TidySuggestionBar = lazy(() =>
  import("@/features/tabs/components/TidySuggestionBar").then((m) => ({
    default: m.TidySuggestionBar,
  })),
);
const AppHeader = lazy(() =>
  import("@/features/workspace/AppHeader").then((m) => ({ default: m.AppHeader })),
);
const HeroBar = lazy(() =>
  import("@/features/workspace/HeroBar").then((m) => ({ default: m.HeroBar })),
);
import { ViewSidebar } from "@/features/workspace/ViewSidebar";
import { ViewBottomBar } from "@/features/workspace/ViewBottomBar";
import { track } from "@/shared/utils/metrics";
import type { NewtabPageMode } from "@/shared/types";
import { VALID_VIEWS, VIEW_CONFIGS, LEGACY_VIEW_MAP, type ViewMode } from "@/shared/config/views";
import { TabsView } from "@/features/tabs/views/TabsView";
import { registerViews } from "@/shared/config/view-registry";
import { findDuplicates } from "@/shared/utils/dedupe";
import { detectIdleTabs } from "@/shared/utils/idle-detect";
import { useHashNavigation } from "./hooks/use-hash-navigation";
import { useLayoutStyle } from "./hooks/use-layout-style";
import { usePanelState } from "./hooks/use-panel-state";
import { useMemoryGovernance } from "@/shared/hooks/use-memory-governance";

const TrendingPage = lazy(() =>
  import("@/features/trending/TrendingPage").then((m) => ({ default: m.TrendingPage })),
);
const DeveloperToolsPage = lazy(() =>
  import("@/features/developer-tools/DeveloperToolsPage").then((m) => ({
    default: m.DeveloperToolsPage,
  })),
);

/** 懒加载非默认视图——直接导入文件而非 barrel，确保每个视图独立拆 chunk */
const TimelineView = lazy(() =>
  import("@/features/tabs/views/TimelineView").then((m) => ({ default: m.TimelineView })),
);
const FrequencyView = lazy(() =>
  import("@/features/tabs/views/FrequencyView").then((m) => ({ default: m.FrequencyView })),
);
const TabGroupView = lazy(() =>
  import("@/features/tabs/views/TabGroupView").then((m) => ({ default: m.TabGroupView })),
);
const WindowView = lazy(() =>
  import("@/features/tabs/views/WindowView").then((m) => ({ default: m.WindowView })),
);
const KanbanView = lazy(() =>
  import("@/features/tabs/views/KanbanView").then((m) => ({ default: m.KanbanView })),
);
const ArchiveView = lazy(() =>
  import("@/features/sessions/ArchiveView").then((m) => ({ default: m.ArchiveView })),
);

const SearchBox = lazy(() =>
  import("@/features/search/SearchBox").then((m) => ({ default: m.SearchBox })),
);
const SettingsPanel = lazy(() =>
  import("@/features/settings/SettingsPanel").then((m) => ({ default: m.SettingsPanel })),
);
const HistoryPanel = lazy(() =>
  import("@/features/history/HistoryPanel").then((m) => ({ default: m.HistoryPanel })),
);
const TrashView = lazy(() =>
  import("@/features/sessions/TrashView").then((m) => ({ default: m.TrashView })),
);
/** 点击动效 Canvas 图层，默认 off 时不拉取 chunk */
const ClickEffectLayer = lazy(() =>
  import("@/features/effects/ClickEffectLayer").then((m) => ({ default: m.ClickEffectLayer })),
);
/** 视频背景层，zIndex:-1；默认 none 时不拉取 chunk */
const VideoBackground = lazy(() =>
  import("@/features/effects/VideoBackground").then((m) => ({ default: m.VideoBackground })),
);

/** 注册所有视图到 ViewRegistry —— 新增视图只需在此添加一条 */
registerViews([
  { id: "tabs", component: TabsView, order: 1 },
  { id: "timeline", component: TimelineView, order: 2 },
  { id: "tabgroup", component: TabGroupView, order: 3 },
  { id: "window", component: WindowView, order: 4 },
  { id: "kanban", component: KanbanView, order: 5 },
  { id: "frequency", component: FrequencyView, order: 6 },
  // archive 作为隐藏视图，不在 ViewDock 显示，但可通过程序切换
  { id: "archive", component: ArchiveView, order: 99 },
]);

const { Content } = Layout;
const { Text } = Typography;

function AppContent() {
  // ── hash 路由处理 ──────────────────────────────────────────────────────────
  const { initialSettingsTab, openSettingsFromHash } = useHashNavigation();

  const [tidyExpandSignal, setTidyExpandSignal] = useState(0);
  const tidySectionRef = useRef<HTMLDivElement>(null);
  const [initRunId, setInitRunId] = useState(0);

  const {
    checked,
    initError,
    showOnboarding,
    searchFromHash,
    compactSearchVisible,
    heroSearchRef,
    retry: retryInit,
    dismissOnboarding,
  } = useAppInitialization(initRunId);

  useSwBroadcast();
  // 内存治理（任务7）：监听内存压力，按策略自动 discard 或提示
  useMemoryGovernance();
  // 存储自动清理：使用率超过阈值时清理非核心数据
  useAutoCleanup();

  /** 旧版视图设置自动迁移（domain/compact/grid → tabs + tabsLayout），仅执行一次 */
  useEffect(() => {
    const settings = useSettingsStore.getState().settings;
    const legacy = LEGACY_VIEW_MAP[settings.defaultView];
    if (legacy) {
      void useSettingsStore.getState().updateSettings({
        defaultView: legacy.view,
        tabsLayout: legacy.layout,
      });
    }
  }, []);

  /** 全局禁止浏览器原生右键菜单，打造纯 App 体验 */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener("contextmenu", handler);
    return () => {
      document.removeEventListener("contextmenu", handler);
    };
  }, []);

  const { t } = useT();

  /** 合并单个 useSettingsStore 订阅，避免独立订阅导致重复渲染 */
  const {
    gradientPreset,
    customGradient,
    backgroundImage,
    backgroundOverlay,
    contentMaxWidth,
    defaultView,
    newtabPageMode,
    viewTabPosition,
    uiVisibility,
    dedupStrictness,
    idleThresholdMinutes,
  } = useSettingsStore(
    useShallow((s) => ({
      gradientPreset: s.settings.gradientPreset,
      customGradient: s.settings.customGradient,
      backgroundImage: s.settings.backgroundImage,
      backgroundOverlay: s.settings.backgroundOverlay,
      contentMaxWidth: s.settings.contentMaxWidth ?? 0,
      defaultView: s.settings.defaultView,
      newtabPageMode: s.settings.newtabPageMode ?? "workspace",
      viewTabPosition: s.settings.viewTabPosition ?? "top",
      uiVisibility: s.settings.uiVisibility,
      dedupStrictness: s.settings.dedupStrictness ?? "loose",
      idleThresholdMinutes: s.settings.idleThresholdMinutes ?? 1440,
    })),
  );
  const pageMode: NewtabPageMode = newtabPageMode;

  const resolvedDark = useResolvedTheme() === "dark";
  const showViewSwitcher = uiVisibility?.viewSwitcher !== false;
  const showHeroBar =
    uiVisibility?.heroLogo !== false ||
    uiVisibility?.heroTitle !== false ||
    uiVisibility?.heroSlogan !== false ||
    uiVisibility?.heroSearch !== false;
  const showHeroLogo = uiVisibility?.heroLogo !== false;
  const showHeroTitle = uiVisibility?.heroTitle !== false;
  const showHeroSlogan = uiVisibility?.heroSlogan !== false;
  const showHeroSearch = uiVisibility?.heroSearch !== false;
  const viewMode: ViewMode = useMemo(() => {
    if (VALID_VIEWS.includes(defaultView as ViewMode)) return defaultView as ViewMode;
    return LEGACY_VIEW_MAP[defaultView]?.view ?? "tabs";
  }, [defaultView]);

  // ── 面板状态管理 ───────────────────────────────────────────────────────────
  const {
    showSearch,
    showSettings,
    showInsights,
    showHistory,
    showTrash,
    setShowSearch,
    setShowSettings,
    setShowInsights,
    setShowHistory,
    setShowTrash,
    handleOpenSearch,
    handleOpenSettings,
    handleOpenInsights,
    handleOpenHistory,
    handleOpenTrash,
    handlePageModeChange,
    handleOpenArchive,
  } = usePanelState({ openSettingsFromHash, initialSettingsTab, searchFromHash });

  // ── 背景 / 布局样式 ────────────────────────────────────────────────────────
  const { layoutStyle, overlayStyle, contentShellStyle, setScrollProgress } = useLayoutStyle({
    gradientPreset,
    customGradient,
    backgroundImage,
    backgroundOverlay,
    contentMaxWidth,
  });

  // ── 快捷键 ─────────────────────────────────────────────────────────────────
  const handleViewChange = useCallback((view: ViewMode) => {
    const prev = useSettingsStore.getState().settings.defaultView;
    void useSettingsStore.getState().updateSettings({ defaultView: view });
    void track("view_switch", { from: prev, to: view });
  }, []);

  const handleToggleSearch = useCallback(() => setShowSearch((v) => !v), [setShowSearch]);
  const handleToggleHistory = useCallback(() => setShowHistory((v) => !v), [setShowHistory]);

  useKeybinding("search", handleToggleSearch);
  useKeybinding("openHistory", handleToggleHistory);

  /** 同时响应来自 sw 的「toggle-search」广播（chrome.commands 接入点） */
  useEffect(() => {
    const onMessage = (msg: { type?: string }) => {
      if (msg.type === "toggle-search") {
        setShowSearch((v) => !v);
      }
      if (msg.type === "open-history") {
        setShowHistory(true);
      }
    };
    chrome.runtime?.onMessage?.addListener?.(onMessage);
    return () => {
      chrome.runtime?.onMessage?.removeListener?.(onMessage);
    };
  }, [setShowSearch, setShowHistory]);

  useKeybinding(
    "exitSelection",
    useCallback(() => {
      const selectionStore = useSelectionStore.getState();
      if (selectionStore.selectionMode) {
        selectionStore.exitSelectionMode();
      }
    }, []),
  );

  useKeybinding(
    "selectAll",
    useCallback(() => {
      const selectionStore = useSelectionStore.getState();
      // 无论是否已进入多选模式，Ctrl+A 都全选当前所有标签
      const allIds = useTabsStore.getState().tabs.map((t) => t.id);
      selectionStore.selectAll(allIds);
    }, []),
  );

  const handleTidy = useCallback(() => {
    setTidyExpandSignal((s) => s + 1);
    tidySectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleRetryInit = useCallback(() => {
    retryInit();
    setInitRunId((value) => value + 1);
  }, [retryInit]);

  // ── 统计摘要 ───────────────────────────────────────────────────────────────
  const tabs = useTabsStore((s) => s.tabs);
  const tabCount = useMemo(() => tabs.length, [tabs]);
  const domainCount = useMemo(() => new Set(tabs.map((tab) => tab.hostname)).size, [tabs]);
  const dupGroups = useMemo(() => findDuplicates(tabs, dedupStrictness), [tabs, dedupStrictness]);
  const idleTabsArr = useMemo(
    () => detectIdleTabs(tabs, idleThresholdMinutes),
    [tabs, idleThresholdMinutes],
  );
  const duplicateTabsCount = dupGroups.reduce((sum, group) => sum + group.tabs.length - 1, 0);
  const idleTabsCount = idleTabsArr.length;
  const hasTidySuggestions = duplicateTabsCount > 0 || idleTabsCount > 0;

  const viewSegmentedOptions = useMemo(
    () =>
      VIEW_CONFIGS.map((view) => ({
        value: view.id,
        label: <span className="app-view-option">{t(view.labelKey)}</span>,
      })),
    [t],
  );

  // ── 内容区 className ───────────────────────────────────────────────────────
  const contentShellClassName = [
    "app-content-shell",
    contentMaxWidth > 0 ? "app-content-shell--bounded" : "",
    pageMode === "devtools" ? "app-content-shell--no-scroll" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // --- 所有 hooks 必须在以上结束；以下开始进入 JSX ---

  if (!checked) {
    return (
      <Flex align="center" justify="center" className="app-page-loading">
        <Flex vertical align="center" gap={12}>
          <Spin />
          <Text type="secondary">{t("加载标签页中...")}</Text>
        </Flex>
      </Flex>
    );
  }

  return (
    <Layout
      className={`app-layout-shell${pageMode === "workspace" && showViewSwitcher && viewTabPosition === "bottom" ? " app-layout-shell--view-bottom" : ""}`}
      style={layoutStyle}
    >
      {/* 背景遮罩层：当 backgroundOverlay.enabled 时渲染 */}
      {backgroundOverlay?.enabled && (
        <>
          <div className="app-background-overlay" style={overlayStyle} />
          {/* 滚动时叠加的动态暗化层 */}
          <div
            className="app-background-overlay-dimmer"
            style={
              {
                "--app-overlay-dimmer-bg": resolvedDark ? "#000" : "rgba(0,0,0,0.6)",
              } as React.CSSProperties
            }
          />
        </>
      )}

      {uiVisibility?.header !== false && (
        <AppHeader
          tabCount={tabCount}
          domainCount={domainCount}
          duplicateTabsCount={duplicateTabsCount}
          idleTabsCount={idleTabsCount}
          hasTidySuggestions={hasTidySuggestions}
          compactSearchVisible={compactSearchVisible}
          pageMode={pageMode}
          onPageModeChange={handlePageModeChange}
          onSettings={handleOpenSettings}
          onOpenSearch={handleOpenSearch}
          onInsights={handleOpenInsights}
          onOpenHistory={handleOpenHistory}
          onOpenTrash={handleOpenTrash}
          onTidy={handleTidy}
        />
      )}

      {/* 主体区：侧边栏 + 内容 */}
      <Flex flex={1} className={styles["app-content-fill"]}>
        {pageMode === "workspace" && showViewSwitcher && viewTabPosition === "left" && (
          <ViewSidebar viewMode={viewMode} onViewChange={handleViewChange} position="left" />
        )}

        <Content
          data-app-content
          className={contentShellClassName}
          style={contentShellStyle}
          onScroll={(e) => {
            const target = e.currentTarget as HTMLElement;
            const progress = Math.min(1, Math.max(0, target.scrollTop / 300));
            setScrollProgress(progress);
          }}
        >
          {pageMode === "workspace" && showHeroBar && (
            <HeroBar
              onOpenSearch={handleOpenSearch}
              sentinelRef={heroSearchRef}
              showLogo={showHeroLogo}
              showTitle={showHeroTitle}
              showSlogan={showHeroSlogan}
              showSearch={showHeroSearch}
            />
          )}

          {pageMode === "workspace" &&
            viewMode !== "archive" &&
            uiVisibility?.tidySuggestion !== false && (
              <div ref={tidySectionRef}>
                <TidySuggestionBar expandSignal={tidyExpandSignal} />
              </div>
            )}

          {pageMode === "workspace" && <QuickStartLayer onOpenSettings={handleOpenSettings} />}

          {pageMode === "workspace" && showViewSwitcher && viewTabPosition === "top" && (
            <div className="app-view-switcher-wrap">
              <Segmented<ViewMode>
                value={viewMode}
                onChange={(v: ViewMode) => handleViewChange(v)}
                options={viewSegmentedOptions}
                size="middle"
                className="app-view-switcher"
                classNames={{ item: "app-view-switcher__item" }}
              />
            </div>
          )}

          {pageMode === "trending" && (
            <Suspense
              fallback={
                <Flex align="center" justify="center" className="app-suspense-fallback-wrap">
                  <Spin />
                </Flex>
              }
            >
              <TrendingPage />
            </Suspense>
          )}
          {pageMode === "devtools" && (
            <Suspense
              fallback={
                <Flex align="center" justify="center" className="app-suspense-fallback-wrap">
                  <Spin />
                </Flex>
              }
            >
              <DeveloperToolsPage />
            </Suspense>
          )}
          {pageMode === "workspace" && (
            <AppWorkspace
              checked={checked}
              initError={initError}
              showOnboarding={showOnboarding}
              viewMode={viewMode}
              onDismissOnboarding={dismissOnboarding}
              onRetryInit={handleRetryInit}
              onOpenArchive={handleOpenArchive}
              onOpenSettings={handleOpenSettings}
            />
          )}
        </Content>

        {pageMode === "workspace" && showViewSwitcher && viewTabPosition === "right" && (
          <ViewSidebar viewMode={viewMode} onViewChange={handleViewChange} position="right" />
        )}
      </Flex>

      {pageMode === "workspace" && showViewSwitcher && viewTabPosition === "bottom" && (
        <ViewBottomBar viewMode={viewMode} onViewChange={handleViewChange} />
      )}

      <FloatButton.BackTop
        target={() => document.querySelector(".app-content-shell") as HTMLElement}
        visibilityHeight={400}
        className="app-back-top-override"
      />

      <UndoToast />

      {viewMode !== "archive" && <BatchActionBar />}

      <Suspense fallback={null}>
        <SearchBox
          open={showSearch}
          onOpenChange={setShowSearch}
          onOpenHistory={handleOpenHistory}
        />
        <SettingsPanel
          open={showSettings}
          onOpenChange={(open: boolean) => {
            if (!open) setShowSettings(false as boolean);
          }}
          defaultActiveTab={initialSettingsTab}
        />
        {}
        <InsightsPanel open={showInsights} onClose={() => setShowInsights(false as boolean)} />
        <HistoryPanel open={showHistory} onClose={() => setShowHistory(false)} />
        <Drawer
          title={t("回收站")}
          open={showTrash}
          onClose={() => setShowTrash(false)}
          width={560}
          destroyOnClose
        >
          <TrashView />
        </Drawer>
      </Suspense>
    </Layout>
  );
}

function App() {
  return (
    <I18nProvider>
      <AntdThemeProvider>
        {/* 视频背景层：zIndex:-1，位于最底；不影响其它交互 */}
        <Suspense fallback={null}>
          <VideoBackground />
        </Suspense>
        <ErrorBoundary label="AppContent">
          <AppContent />
        </ErrorBoundary>
        {/* 全局点击动效层：lazy 按需加载，默认关闭时不渲染 Canvas */}
        <Suspense fallback={null}>
          <ClickEffectLayer />
        </Suspense>
      </AntdThemeProvider>
    </I18nProvider>
  );
}

export default App;
