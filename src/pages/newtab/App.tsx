import { useEffect, useState, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import { Layout, Spin, Typography, FloatButton, Flex, Segmented } from "antd";
import { useTabsStore, useSettingsStore, useSelectionStore } from "@/store";
import { useShallow } from "zustand/shallow";
import { useSwBroadcast, useResolvedTheme, useAppInitialization } from "@/shared/hooks";
import { useT } from "@/shared/i18n";
import { useKeybinding } from "@/shared/hooks/use-keybinding";
import { AntdThemeProvider } from "@/shared/ui/AntdThemeProvider";
import { ErrorBoundary } from "@/shared/ui/ErrorBoundary";
import { UndoToast } from "@/shared/ui/UndoToast";
import { I18nProvider } from "@/shared/i18n";
import { BatchActionBar } from "@/features/tabs/BatchActionBar";
import { AppWorkspace } from "@/features/workspace/AppWorkspace";
import InsightsPanel from "@/features/insights/InsightsPanel";
import { QuickStartLayer } from "@/features/quick-start/QuickStartLayer";
import { TidySuggestionBar } from "@/features/tabs/TidySuggestionBar";
import { AppHeader } from "@/features/workspace/AppHeader";
import { HeroBar } from "@/features/workspace/HeroBar";
import { ViewSidebar } from "@/features/workspace/ViewSidebar";
import { ViewBottomBar } from "@/features/workspace/ViewBottomBar";
import { DomainGroupView } from "@/features/tabs/DomainGroupView";
import { track } from "@/shared/utils/metrics";
import type { NewtabPageMode } from "@/shared/types";
import { VALID_VIEWS, VIEW_CONFIGS, type ViewMode } from "@/shared/config/views";
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
  import("@/features/tabs/TimelineView").then((m) => ({ default: m.TimelineView })),
);
const CompactView = lazy(() =>
  import("@/features/tabs/CompactView").then((m) => ({ default: m.CompactView })),
);
const GridView = lazy(() =>
  import("@/features/tabs/GridView").then((m) => ({ default: m.GridView })),
);
const FrequencyView = lazy(() =>
  import("@/features/tabs/FrequencyView").then((m) => ({ default: m.FrequencyView })),
);
const TabGroupView = lazy(() =>
  import("@/features/tabs/TabGroupView").then((m) => ({ default: m.TabGroupView })),
);
const WindowView = lazy(() =>
  import("@/features/tabs/WindowView").then((m) => ({ default: m.WindowView })),
);
const BookmarkView = lazy(() =>
  import("@/features/tabs/BookmarkView").then((m) => ({ default: m.BookmarkView })),
);
const KanbanView = lazy(() =>
  import("@/features/tabs/KanbanView").then((m) => ({ default: m.KanbanView })),
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
  { id: "domain", component: DomainGroupView, order: 1 },
  { id: "compact", component: CompactView, order: 2 },
  { id: "timeline", component: TimelineView, order: 3 },
  { id: "tabgroup", component: TabGroupView, order: 4 },
  { id: "window", component: WindowView, order: 5 },
  { id: "kanban", component: KanbanView, order: 6 },
  { id: "bookmarks", component: BookmarkView, order: 7 },
  { id: "frequency", component: FrequencyView, order: 8 },
  { id: "grid", component: GridView, order: 9 },
  { id: "archive", component: ArchiveView, order: 10 },
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
  const viewMode: ViewMode = VALID_VIEWS.includes(defaultView) ? defaultView : "domain";

  // ── 面板状态管理 ───────────────────────────────────────────────────────────
  const {
    showSearch,
    showSettings,
    showInsights,
    showHistory,
    setShowSearch,
    setShowSettings,
    setShowInsights,
    setShowHistory,
    handleOpenSearch,
    handleOpenSettings,
    handleOpenInsights,
    handleOpenHistory,
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

  /** 同时响应来自 sw 的「operation:open-history」广播（chrome.commands 接入点） */
  useEffect(() => {
    const onMessage = (msg: { type?: string }) => {
      if (msg.type === "open-history") {
        setShowHistory(true);
      }
    };
    chrome.runtime?.onMessage?.addListener?.(onMessage);
    return () => {
      chrome.runtime?.onMessage?.removeListener?.(onMessage);
    };
  }, [setShowHistory]);

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
      if (selectionStore.selectionMode) {
        const allIds = useTabsStore.getState().tabs.map((t) => t.id);
        selectionStore.selectAll(allIds);
      }
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
      <Flex align="center" justify="center" style={{ minHeight: "100vh" }}>
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
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 0,
              pointerEvents: "none",
              background: resolvedDark ? "#000" : "rgba(0,0,0,0.6)",
              opacity: `var(--app-background-overlay-opacity, 0)`,
              transition: "opacity 0.1s ease-out",
            }}
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
          onTidy={handleTidy}
        />
      )}

      {/* 主体区：侧边栏 + 内容 */}
      <Flex flex={1} style={{ minHeight: 0 }}>
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
                <Flex align="center" justify="center" style={{ padding: "40px 0" }}>
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
                <Flex align="center" justify="center" style={{ padding: "40px 0" }}>
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
        style={{ right: 32, bottom: 32 }}
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
