import { useEffect, useState, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import { Layout, Spin, Typography, FloatButton, Flex } from "antd";
import styles from "./App.module.less";
import { useTabsStore, useSettingsStore, useSelectionStore } from "@/store";
import { useShallow } from "zustand/shallow";
import {
  useSwBroadcast,
  useAppInitialization,
  useAutoCleanup,
} from "@/shared/hooks";
import { useT } from "@/shared/i18n";
import { useKeybinding } from "@/shared/hooks/use-keybinding";
import { useKeyboardShortcuts } from "@/shared/hooks/use-keyboard-shortcuts";
import { useStatusBarStore } from "@/shared/store/status-bar-slice";
import { AntdThemeProvider } from "@/shared/ui/AntdThemeProvider";
import { ErrorBoundary } from "@/shared/ui/ErrorBoundary";
import { UndoToast } from "@/shared/ui/UndoToast";
import { I18nProvider } from "@/shared/i18n";
import { BatchActionBar } from "@/features/tabs/selection/BatchActionBar";
import { AppWorkspace } from "@/features/workspace/AppWorkspace";
const InsightsView = lazy(() =>
  import("@/features/insights/InsightsView").then((m) => ({ default: m.default })),
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
import { ViewTabs } from "@/features/workspace/ViewTabs";
import { track } from "@/shared/utils/metrics";
import { VALID_VIEWS, LEGACY_VIEW_MAP, type ViewMode } from "@/shared/config/views";
import { TabsView } from "@/features/tabs/views/TabsView";
import { registerViews } from "@/shared/config/view-registry";
import { findDuplicates } from "@/shared/utils/dedupe";
import { detectIdleTabs } from "@/shared/utils/idle-detect";
import { removeSessionString } from "@/shared/utils/storage-array";
import { LOCAL_CACHE_KEYS } from "@/shared/config/storage-keys";
import { useUrlSync } from "@/shared/routing";
import { usePanelStack } from "@/shared/panels";
import {
  CommandPalette,
  registerCommands,
  createViewCommands,
  createPanelCommands,
  createSettingsCommands,
} from "@/features/command-palette";
import { createTemplateCommands } from "@/features/workspace/quick-actions/SaveAsTemplateAction";
import { useLayoutStyle } from "./hooks/use-layout-style";
import { useMemoryGovernance } from "@/shared/hooks/use-memory-governance";
import { StatusBar } from "@/shared/ui/StatusBar/StatusBar";


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
const BookmarkView = lazy(() =>
  import("@/features/bookmarks/BookmarkView").then((m) => ({ default: m.BookmarkView })),
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
const HistoryView = lazy(() =>
  import("@/features/history/HistoryView").then((m) => ({ default: m.HistoryView })),
);
const TrashView = lazy(() =>
  import("@/features/sessions/TrashView").then((m) => ({ default: m.TrashView })),
);
const TrendingView = lazy(() =>
  import("@/features/trending/TrendingView").then((m) => ({ default: m.TrendingView })),
);
const DevToolsView = lazy(() =>
  import("@/features/developer-tools/DevToolsView").then((m) => ({
    default: m.DevToolsView,
  })),
);
/** 点击动效 Canvas 图层，默认 off 时不拉取 chunk */
const ClickEffectLayer = lazy(() =>
  import("@/features/effects/ClickEffectLayer").then((m) => ({ default: m.ClickEffectLayer })),
);
/** 视频背景层，zIndex:-1；默认 none 时不拉取 chunk */
const VideoBackground = lazy(() =>
  import("@/features/effects/VideoBackground").then((m) => ({ default: m.VideoBackground })),
);

/** 注册所有视图到 ViewRegistry —— 顺序决定 TabBar 展示和 ⌘1-⌘9 快捷键 */
registerViews([
  { id: "tabs", component: TabsView, order: 1 },
  { id: "tabgroup", component: TabGroupView, order: 2 },
  { id: "window", component: WindowView, order: 3 },
  { id: "timeline", component: TimelineView, order: 4 },
  { id: "kanban", component: KanbanView, order: 5 },
  { id: "bookmarks", component: BookmarkView, order: 6 },
  { id: "frequency", component: FrequencyView, order: 7 },
  { id: "history", component: HistoryView, order: 8 },
  { id: "archive", component: ArchiveView, order: 9 },
  { id: "trash", component: TrashView, order: 10 },
  { id: "insights", component: InsightsView, order: 11 },
  { id: "trending", component: TrendingView, order: 12 },
  { id: "devtools", component: DevToolsView, order: 13 },
]);

const { Content } = Layout;
const { Text } = Typography;

function AppContent() {
  // ── URL Hash 路由 ──────────────────────────────────────────────────────────
  const { route, switchView } = useUrlSync();

  // ── 面板栈 ─────────────────────────────────────────────────────────────────
  const panelStack = usePanelStack();

  // ── CommandPalette 命令注册 ──────────────────────────────────────────────
  useEffect(() => {
    registerCommands([
      ...createViewCommands(switchView),
      ...createPanelCommands((panelId) => panelStack.push({ id: panelId })),
      ...createSettingsCommands((subId) => panelStack.openSettings(subId)),
      ...createTemplateCommands(),
    ]);
  }, [switchView, panelStack]);

  const [tidyExpandSignal, setTidyExpandSignal] = useState(0);
  const tidySectionRef = useRef<HTMLDivElement>(null);
  const [initRunId, setInitRunId] = useState(0);

  const {
    checked,
    initError,
    showOnboarding,
    compactSearchVisible,
    heroSearchRef,
    retry: retryInit,
    dismissOnboarding,
  } = useAppInitialization(initRunId);

  useSwBroadcast();
  useMemoryGovernance();
  useAutoCleanup();

  /** 旧版视图设置自动迁移（domain/compact/grid → tabs + tabsLayout），仅执行一次 */
  useEffect(() => {
    const settings = useSettingsStore.getState().settings;
    const legacy = LEGACY_VIEW_MAP[settings.defaultView];
    if (legacy) {
      if (import.meta.env.DEV) {
        console.info(
          `[LEGACY_MIGRATION] defaultView "${settings.defaultView}" → view: "${legacy.view}", layout: "${legacy.layout}"`,
        );
      }
      void useSettingsStore.getState().updateSettings({
        defaultView: legacy.view,
        tabsLayout: legacy.layout,
      });
    }
  }, []);

  const { t } = useT();

  /** 合并单个 useSettingsStore 订阅，避免独立订阅导致重复渲染 */
  const {
    contentMaxWidth,
    defaultView,
    viewTabPosition,
    uiVisibility,
    dedupStrictness,
    idleThresholdMinutes,
  } = useSettingsStore(
    useShallow((s) => ({
      contentMaxWidth: s.settings.contentMaxWidth ?? 0,
      defaultView: s.settings.defaultView,
      viewTabPosition: s.settings.viewTabPosition ?? "top",
      uiVisibility: s.settings.uiVisibility,
      dedupStrictness: s.settings.dedupStrictness ?? "loose",
      idleThresholdMinutes: s.settings.idleThresholdMinutes ?? 1440,
    })),
  );
  // 路由驱动显示：URL hash → viewMode；无 hash 时 fallback 到用户设置
  const viewMode: ViewMode =
    route.viewId ??
    (VALID_VIEWS.includes(defaultView as ViewMode) ? (defaultView as ViewMode) : "tabs");

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

  // ── 背景 / 布局样式 ────────────────────────────────────────────────────────
  const { layoutStyle, contentShellStyle } = useLayoutStyle({
    contentMaxWidth,
  });

  // ── 快捷键 ─────────────────────────────────────────────────────────────────
  const handleViewChange = useCallback(
    (view: ViewMode) => {
      switchView(view);
      void track("view_switch", { to: view });
    },
    [switchView],
  );

  const handleToggleSearch = useCallback(() => {
    if (panelStack.isOpen("search")) {
      panelStack.close("search");
    } else {
      panelStack.openSearch();
    }
  }, [panelStack]);

  const handleToggleHistory = useCallback(() => {
    switchView("history");
  }, [switchView]);

  useKeybinding("search", handleToggleSearch);
  useKeybinding("openHistory", handleToggleHistory);
  useKeybinding(
    "commandPalette",
    useCallback(() => {
      if (panelStack.isOpen("commandPalette")) {
        panelStack.close("commandPalette");
      } else {
        panelStack.openCommandPalette();
      }
    }, [panelStack]),
  );

  /** 同时响应来自 sw 的「toggle-search」广播（chrome.commands 接入点） */
  useEffect(() => {
    const onMessage = (msg: { type?: string }) => {
      if (msg.type === "toggle-search") {
        handleToggleSearch();
      }
      if (msg.type === "open-history") {
        switchView("history");
      }
    };
    chrome.runtime?.onMessage?.addListener?.(onMessage);
    return () => {
      chrome.runtime?.onMessage?.removeListener?.(onMessage);
    };
  }, [handleToggleSearch, panelStack]);

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

  // ⌘1–7：按 VIEW_CONFIGS 顺序全局切换视图（输入框内仍生效——与 macOS 系统级一致）。
  // Esc 交给 useKeybinding("exitSelection") 处理，这里不重复注册。
  useKeyboardShortcuts({
    activeView: viewMode,
    onSwitchView: handleViewChange,
  });

  const handleTidy = useCallback(() => {
    // 预清除 dismissed 标记，确保 TidySuggestionBar 能正确渲染并展开
    removeSessionString(LOCAL_CACHE_KEYS.tidyDismissed);
    setTidyExpandSignal((s) => s + 1);
    // 使用 setTimeout 确保 TidySuggestionBar 重新渲染后再滚动
    window.setTimeout(() => {
      tidySectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, []);

  const handleRetryInit = useCallback(() => {
    retryInit();
    setInitRunId((value) => value + 1);
  }, [retryInit]);

  // ── 统计摘要 ───────────────────────────────────────────────────────────────
  // 使用 shallow 比较避免大数组引用变化导致的不必要渲染
  const tabs = useTabsStore(useShallow((s) => s.tabs));
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

  // ── StatusBar 数据连接 ─────────────────────────────────────────────────────
  const selectionMode = useSelectionStore((s) => s.selectionMode);
  const selectedCount = useSelectionStore((s) => s.selectedIds.size);

  // 选择模式 → StatusBar 持久消息
  useEffect(() => {
    const sb = useStatusBarStore.getState();
    if (selectionMode && selectedCount > 0) {
      sb.pushMessage({
        content: t("已选 {count} 个标签页", { count: selectedCount }),
        type: "info",
        action: {
          label: t("退出多选"),
          onClick: () => useSelectionStore.getState().exitSelectionMode(),
        },
      });
    }
    // 清理：退出选择模式时移除消息
    return () => {
      // StatusBar 消息会自行管理生命周期
    };
  }, [selectionMode, selectedCount, t]);

  // 整理建议 → StatusBar 持久消息（仅 workspace 空间下）
  useEffect(() => {
    const sb = useStatusBarStore.getState();
    if (hasTidySuggestions && !selectionMode) {
      sb.pushMessage({
        content: t("{count} 个待处理标签", { count: duplicateTabsCount + idleTabsCount }),
        type: "warning",
        action: {
          label: t("一键整理"),
          onClick: handleTidy,
        },
      });
    }
  }, [
    hasTidySuggestions,
    selectionMode,
    duplicateTabsCount,
    idleTabsCount,
    handleTidy,
    t,
  ]);


  // ── 内容区 className ───────────────────────────────────────────────────────
  const contentShellClassName = [
    "app-content-shell",
    contentMaxWidth > 0 ? "app-content-shell--bounded" : "",
    viewTabPosition === "left"
      ? "app-content-shell--tabs-left"
      : viewTabPosition === "right"
        ? "app-content-shell--tabs-right"
        : "",
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
      className="app-layout-shell"
      style={layoutStyle}
    >
      {uiVisibility?.header !== false && (
        <AppHeader
          tabCount={tabCount}
          domainCount={domainCount}
          duplicateTabsCount={duplicateTabsCount}
          idleTabsCount={idleTabsCount}
          hasTidySuggestions={hasTidySuggestions}
          compactSearchVisible={compactSearchVisible}
          onSettings={() => panelStack.openSettings()}
          onOpenSearch={() => panelStack.openSearch()}
          onTidy={handleTidy}
        />
      )}

      {/* 主体区：左侧 ViewTabs（垂直）+ 内容 */}
      <Flex flex={1} className={styles["app-content-fill"]}>
        {showViewSwitcher && viewTabPosition === "left" && (
          <ViewTabs activeView={viewMode} onChange={handleViewChange} />
        )}

        <Content
          data-app-content
          className={contentShellClassName}
          style={contentShellStyle}
        >
          {showHeroBar && (
            <HeroBar
              onOpenSearch={() => panelStack.openSearch()}
              sentinelRef={heroSearchRef}
              showLogo={showHeroLogo}
              showTitle={showHeroTitle}
              showSlogan={showHeroSlogan}
              showSearch={showHeroSearch}
            />
          )}

          {viewMode !== "archive" &&
            uiVisibility?.tidySuggestion !== false && (
              <div ref={tidySectionRef}>
                <TidySuggestionBar expandSignal={tidyExpandSignal} />
              </div>
            )}

          <QuickStartLayer onOpenSettings={() => panelStack.openSettings()} />

          {showViewSwitcher && viewTabPosition === "top" && (
            <div className="app-view-switcher-wrap">
              <ViewTabs activeView={viewMode} onChange={handleViewChange} />
            </div>
          )}

          <AppWorkspace
            checked={checked}
            initError={initError}
            showOnboarding={showOnboarding}
            viewMode={viewMode}
            onDismissOnboarding={dismissOnboarding}
            onRetryInit={handleRetryInit}
            onOpenArchive={() => switchView("archive")}
            onOpenSettings={() => panelStack.openSettings()}
          />
        </Content>

        {showViewSwitcher && viewTabPosition === "right" && (
          <ViewTabs activeView={viewMode} onChange={handleViewChange} />
        )}
      </Flex>

      <FloatButton.BackTop
        target={() => document.querySelector(".app-content-shell") as HTMLElement}
        visibilityHeight={400}
        className="app-back-top-override"
      />

      <UndoToast />

      {viewMode !== "archive" && <BatchActionBar />}

      <Suspense fallback={null}>
        <CommandPalette />
        <SearchBox
          open={panelStack.isOpen("search")}
          onOpenChange={(open) => {
            if (!open) panelStack.close("search");
          }}
          onOpenHistory={() => switchView("history")}
        />
        <SettingsPanel
          open={panelStack.isOpen("settings")}
          onOpenChange={(open: boolean) => {
            if (!open) panelStack.close("settings");
          }}
          defaultActiveTab={route.subId === "about" ? "about" : "appearance"}
        />
      </Suspense>
      <StatusBar />
      {/* ARIA live region for dynamic content announcements (screen readers) */}
      <div className="app-live-region" aria-live="polite" aria-atomic="true" />
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
