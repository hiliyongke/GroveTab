import { useEffect, useState, useCallback, useMemo, useRef, lazy, Suspense, type CSSProperties } from 'react';
import {
  Layout,
  Spin,
  Typography,
  Flex,
} from 'antd';
import { useTabsStore, useSettingsStore, useSelectionStore } from '@/store';
import { useShallow } from 'zustand/shallow';
import { useSwBroadcast, useResolvedTheme, useAppInitialization } from '@/shared/hooks';
import { useT } from '@/shared/i18n';
import { useKeybinding } from '@/shared/hooks/use-keybinding';
import { AntdThemeProvider } from '@/shared/ui/AntdThemeProvider';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { PanelErrorBoundary } from '@/shared/ui/PanelErrorBoundary';
import { UndoToast } from '@/shared/ui/UndoToast';
import { I18nProvider } from '@/shared/i18n';
import { BatchActionBar } from '@/features/tabs/BatchActionBar';
import { AppWorkspace } from '@/features/workspace/AppWorkspace';
import InsightsPanel from '@/features/insights/InsightsPanel';
import { QuickStartLayer } from '@/features/quick-start/QuickStartLayer';
import { TidySuggestionBar } from '@/features/tabs/TidySuggestionBar';
import { AppHeader } from '@/features/workspace/AppHeader';
import { HeroBar } from '@/features/workspace/HeroBar';
import { ViewSidebar } from '@/features/workspace/ViewSidebar';
import { ViewBottomBar } from '@/features/workspace/ViewBottomBar';
import { isValidViewMode } from '@/features/workspace/view-catalog';
import { track } from '@/shared/utils/metrics';
import { resolveGradient } from '@/shared/theme/gradient-presets';
import { cssVars } from '@/shared/utils/css-vars';
import type { NewtabPageMode, ViewMode } from '@/shared/types';
import { findDuplicates } from '@/shared/utils/dedupe';
import { detectIdleTabs } from '@/shared/utils/idle-detect';

 
const TrendingPage = lazy(() => import('@/features/trending/TrendingPage').then((m) => ({ default: m.TrendingPage })));
 
const DeveloperToolsPage = lazy(() => import('@/features/developer-tools/DeveloperToolsPage').then((m) => ({ default: m.DeveloperToolsPage })));

 
const SearchBox = lazy(() => import('@/features/search/SearchBox').then((m) => ({ default: m.SearchBox })));
 
const SettingsPanel = lazy(() => import('@/features/settings/SettingsPanel').then((m) => ({ default: m.SettingsPanel })));
 
const HistoryPanel = lazy(() => import('@/features/history/HistoryPanel').then((m) => ({ default: m.HistoryPanel })));
/** 点击动效 Canvas 图层，默认 off 时不拉取 chunk */
 
const ClickEffectLayer = lazy(() => import('@/features/effects/ClickEffectLayer').then((m) => ({ default: m.ClickEffectLayer })));
/** 视频背景层，zIndex:-1；默认 none 时不拉取 chunk */
 
const VideoBackground = lazy(() => import('@/features/effects/VideoBackground').then((m) => ({ default: m.VideoBackground })));

const { Content } = Layout;
const { Text } = Typography;


/**
 * AppContent —— 新标签页主内容组件
 *
 * 组合所有功能模块（搜索、设置、历史、整理建议等），
 * 通过 useAppInitialization 管理初始化状态，
 * 根据设置渲染不同的页面模式（workspace/trending/devtools）。
 *
 * @returns 新标签页主界面 JSX
 */
function AppContent() {
  const [initialSettingsTab, setInitialSettingsTab] = useState<'appearance' | 'about'>('appearance');
  const [openSettingsFromHash, setOpenSettingsFromHash] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (hash === '#about') {
      setInitialSettingsTab('about');
    }
    if (hash === '#settings') {
      setOpenSettingsFromHash(true);
    }
  }, []);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash === '#about' || hash === '#settings') {
        history.replaceState(null, '', window.location.pathname);
      }
    }
  }, [initialSettingsTab, openSettingsFromHash]);
  const [showSettings, setShowSettings] = useState(false);
  useEffect(() => {
    if (initialSettingsTab === 'about' || openSettingsFromHash) {
      setShowSettings(true);
    }
  }, [initialSettingsTab, openSettingsFromHash]);
  const [showInsights, setShowInsights] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  /** tidyExpandSignal 对 TidySuggestionBar：默认为 0，点 "一键整理" 时 +1 触发展开 */
  const [tidyExpandSignal, setTidyExpandSignal] = useState(0);
  const tidySectionRef = useRef<HTMLDivElement>(null);
  /** initRunId —— 初始化失败时递增此值，触发 useEffect 重新执行 */
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

  /** 全局禁止浏览器原生右键菜单，打造纯 App 体验 */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handler);
    return () => {
      document.removeEventListener('contextmenu', handler);
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
  } = useSettingsStore(useShallow((s) => ({
    gradientPreset: s.settings.gradientPreset,
    customGradient: s.settings.customGradient,
    backgroundImage: s.settings.backgroundImage,
    backgroundOverlay: s.settings.backgroundOverlay,
    contentMaxWidth: s.settings.contentMaxWidth ?? 0,
    defaultView: s.settings.defaultView,
    newtabPageMode: s.settings.newtabPageMode ?? 'workspace',
    viewTabPosition: s.settings.viewTabPosition ?? 'top',
    uiVisibility: s.settings.uiVisibility,
    dedupStrictness: s.settings.dedupStrictness ?? 'loose',
    idleThresholdMinutes: s.settings.idleThresholdMinutes ?? 1440,
  })));
  const pageMode: NewtabPageMode = newtabPageMode;

  const resolvedDark = useResolvedTheme() === 'dark';
  const showViewSwitcher = uiVisibility?.viewSwitcher !== false;
  const showHeroBar = (uiVisibility?.heroLogo !== false
    || uiVisibility?.heroTitle !== false
    || uiVisibility?.heroSlogan !== false
    || uiVisibility?.heroSearch !== false);
  const showHeroLogo = uiVisibility?.heroLogo !== false;
  const showHeroTitle = uiVisibility?.heroTitle !== false;
  const showHeroSlogan = uiVisibility?.heroSlogan !== false;
  const showHeroSearch = uiVisibility?.heroSearch !== false;
  const viewMode: ViewMode = isValidViewMode(defaultView as string) ? defaultView : 'domain';
  const layoutBackground = resolveGradient(gradientPreset, resolvedDark, customGradient);

  /** searchFromHash 触发搜索框显示 */
  const [showSearch, setShowSearch] = useState(false);
  useEffect(() => {
    if (searchFromHash) {
      setShowSearch(true);
    }
  }, [searchFromHash]);

  /** 页面内快捷键：通过可配置的 useKeybinding hook 注册 */
  const handleViewChange = useCallback((view: ViewMode) => {
    const prev = useSettingsStore.getState().settings.defaultView;
    // 切换视图仅写 settings；viewMode 从 settings 派生，会自动更新
    void useSettingsStore.getState().updateSettings({ defaultView: view });
    void track('view_switch', { from: prev, to: view });
  }, []);

  useKeybinding('search', useCallback(() => setShowSearch((v) => !v), []));

  /**
   * 打开「历史记录」面板的全局快捷键。
   * 默认 ChromeCommands 注册为 `Alt+H`（sw 供作业系统级快捷），页内额外增加 Cmd/Ctrl+⌫ H
   * 以该快捷与现有 useKeybinding 机制一致。这里临时需要代码中手动增加 listener：
   */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.shiftKey && (e.key === 'H' || e.key === 'h')) {
        e.preventDefault();
        setShowHistory((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    /** 同时响应来自 sw 的「operation:open-history」广播（可选接入），
     *  如果以后要进一步接管 chrome.commands。
     * @param msg
     * @param msg.type
     */
    const onMessage = (msg: { type?: string }) => {
      if (msg.type === 'open-history') {
        setShowHistory(true);
      }
    };
    chrome.runtime?.onMessage?.addListener?.(onMessage);
    return () => {
      window.removeEventListener('keydown', handler);
      chrome.runtime?.onMessage?.removeListener?.(onMessage);
    };
  }, []);

  /**
   * 多选快捷键
   *   - Escape：退出多选模式
   *   - Ctrl/Cmd+A：全选当前视图所有标签
   */
  useKeybinding('exitSelection', useCallback(() => {
    const selectionStore = useSelectionStore.getState();
    if (selectionStore.selectionMode) {
      selectionStore.exitSelectionMode();
    }
  }, []));

  useKeybinding('selectAll', useCallback(() => {
    const selectionStore = useSelectionStore.getState();
    if (selectionStore.selectionMode) {
      const allIds = useTabsStore.getState().tabs.map((t) => t.id);
      selectionStore.selectAll(allIds);
    }
  }, []));

  const handlePageModeChange = useCallback((mode: NewtabPageMode) => {
    const prev = useSettingsStore.getState().settings.newtabPageMode ?? 'workspace';
    void useSettingsStore.getState().updateSettings({ newtabPageMode: mode });
    setShowSearch(false);
    setShowSettings(false);
    setShowInsights(false);
    void track('newtab_page_mode_switch', { from: prev, to: mode });
  }, []);

  const handleOpenSearch = useCallback(() => {
    setShowSearch(true);
    setShowSettings(false);
    setShowInsights(false);
  }, []);

  const handleOpenArchive = useCallback(() => {
    // 切换到 workspace + archive 视图 Tab
    const currentMode = useSettingsStore.getState().settings.newtabPageMode;
    if (currentMode !== 'workspace') {
      void useSettingsStore.getState().updateSettings({ newtabPageMode: 'workspace' });
    }
    void useSettingsStore.getState().updateSettings({ defaultView: 'archive' });
    setShowSearch(false);
    setShowSettings(false);
    setShowInsights(false);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setShowSettings(true);
    setShowSearch(false);
    setShowInsights(false);
  }, []);

  const handleOpenInsights = useCallback(() => {
    setShowInsights(true);
    setShowSearch(false);
    setShowSettings(false);
  }, []);

  const handleOpenHistory = useCallback(() => {
    setShowHistory(true);
    setShowSearch(false);
    setShowSettings(false);
    setShowInsights(false);
  }, []);

  const handleTidy = useCallback(() => {
    setTidyExpandSignal((s) => s + 1);
    tidySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleRetryInit = useCallback(() => {
    retryInit();
    setInitRunId((value) => value + 1);
  }, [retryInit]);

  /** Workspace 统计摘要 —— 计算 tabCount、domainCount 等 */
  const tabs = useTabsStore((s) => s.tabs);
  const tabCount = useMemo(() => tabs.length, [tabs]);
  const domainCount = useMemo(() => new Set(tabs.map((tab) => tab.hostname)).size, [tabs]);
  /** dupGroups / idleTabsArr 计算开销较大，用 useMemo 避免无关渲染时重复执行 */
  const dupGroups = useMemo(() => findDuplicates(tabs, dedupStrictness), [tabs, dedupStrictness]);
  const idleTabsArr = useMemo(() => detectIdleTabs(tabs, idleThresholdMinutes), [tabs, idleThresholdMinutes]);
  const duplicateTabsCount = dupGroups.reduce((sum, group) => sum + group.tabs.length - 1, 0);
  const idleTabsCount = idleTabsArr.length;
  const hasTidySuggestions = duplicateTabsCount > 0 || idleTabsCount > 0;

  /**
   * 构建 Layout 背景样式（useMemo 缓存，避免每次渲染重建对象）：
   *   - 基础层：渐变背景
   *   - 图片层：backgroundImage.url（如有）
   *   - 遮罩层：通过 ::after 伪元素实现（在 index.css 中）
   */
  const layoutStyle = useMemo<CSSProperties>(() => {
    const style: CSSProperties = {
      minHeight: '100vh',
      background: layoutBackground,
      position: 'relative',
    };

    /** 如果有背景图，叠加在渐变之上 */
    if (backgroundImage?.url) {
      const isEmbeddedImage = backgroundImage.url.startsWith('data:') || backgroundImage.url.startsWith('blob:');
      style.backgroundImage = `url("${backgroundImage.url}")`;
      style.backgroundSize = backgroundImage.fit === 'repeat' ? 'auto' : backgroundImage.fit;
      style.backgroundRepeat = backgroundImage.fit === 'repeat' ? 'repeat' : 'no-repeat';
      style.backgroundPosition = backgroundImage.position ?? 'center';
      style.backgroundAttachment = isEmbeddedImage ? 'scroll' : 'fixed';
      /** 渐变作为 fallback */
      style.backgroundColor = layoutBackground;
    }

    return style;
  }, [layoutBackground, backgroundImage]);

  const overlayBlur = Math.min(Math.max(backgroundOverlay?.blur ?? 0, 0), 12);
  const overlayStyle = useMemo<CSSProperties | undefined>(() =>
    backgroundOverlay?.enabled
      ? cssVars({
          '--app-background-overlay-bg': resolvedDark ? backgroundOverlay.colorDark : backgroundOverlay.color,
          '--app-background-overlay-filter': overlayBlur > 0 ? `blur(${overlayBlur}px)` : 'none',
        })
      : undefined,
    [backgroundOverlay, resolvedDark, overlayBlur],
  );
  const contentShellClassName = contentMaxWidth > 0
    ? 'app-content-shell app-content-shell--bounded'
    : 'app-content-shell';
  const contentShellStyle = useMemo<CSSProperties | undefined>(() =>
    contentMaxWidth > 0
      ? cssVars({ '--app-content-max-width': `${contentMaxWidth}px` })
      : undefined,
    [contentMaxWidth],
  );

  // --- 所有 hooks 必须在以上结束；以下开始进入 JSX ---

  if (!checked) {
    return (
      <Flex className="app-page-loading" justify="center" align="center">
        <Flex vertical align="center" gap={12}>
          <Spin />
          <Text type="secondary">{t('tabs.loading')}</Text>
        </Flex>
      </Flex>
    );
  }

  return (
    <Layout
      className={`app-layout-shell${pageMode === 'workspace' && showViewSwitcher && viewTabPosition === 'bottom' ? ' app-layout-shell--view-bottom' : ''}`}
      style={layoutStyle}
    >
      {/* 背景遮罩层：当 backgroundOverlay.enabled 时渲染 */}
      {backgroundOverlay?.enabled && (
        <div
          className="app-background-overlay"
          style={overlayStyle}
        />
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
      <Flex className="app-main-body" flex={1} style={{ minHeight: 0 }}>
        {pageMode === 'workspace' && showViewSwitcher && viewTabPosition === 'left' && (
          <ViewSidebar
            viewMode={viewMode}
            onViewChange={handleViewChange}
            position="left"
          />
        )}

      <Content
        data-app-content
        className={contentShellClassName}
        style={contentShellStyle}
      >
        {pageMode === 'workspace' && showHeroBar && (
          <HeroBar
            viewMode={viewMode}
            onViewChange={handleViewChange}
            onOpenSearch={handleOpenSearch}
            sentinelRef={heroSearchRef}
            showLogo={showHeroLogo}
            showTitle={showHeroTitle}
            showSlogan={showHeroSlogan}
            showSearch={showHeroSearch}
            showViewSwitcher={showViewSwitcher}
            viewTabPosition={viewTabPosition}
          />
        )}

        {pageMode === 'workspace' && viewMode !== 'archive' && uiVisibility?.tidySuggestion !== false && (
          <div ref={tidySectionRef}>
            <TidySuggestionBar expandSignal={tidyExpandSignal} />
          </div>
        )}

        {pageMode === 'workspace' && <QuickStartLayer />}

        {/* workspace 内容区：使用 AppWorkspace 子组件渲染 */}
        {pageMode === 'trending' && (
          <Suspense fallback={
            <Flex justify="center" align="center" style={{ padding: '40px 0' }}>
              <Spin />
            </Flex>
          }>
            <TrendingPage />
          </Suspense>
        )}
        {pageMode === 'devtools' && (
          <Suspense fallback={
            <Flex justify="center" align="center" style={{ padding: '40px 0' }}>
              <Spin />
            </Flex>
          }>
            <DeveloperToolsPage />
          </Suspense>
        )}
        {pageMode === 'workspace' && (
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

        {pageMode === 'workspace' && showViewSwitcher && viewTabPosition === 'right' && (
          <ViewSidebar
            viewMode={viewMode}
            onViewChange={handleViewChange}
            position="right"
          />
        )}
      </Flex>

      {pageMode === 'workspace' && showViewSwitcher && viewTabPosition === 'bottom' && (
        <ViewBottomBar
          viewMode={viewMode}
          onViewChange={handleViewChange}
        />
      )}

      <UndoToast />

      {viewMode !== 'archive' && <BatchActionBar />}

      <Suspense fallback={null}>
        <SearchBox open={showSearch} onOpenChange={setShowSearch} onOpenHistory={handleOpenHistory} />
        <PanelErrorBoundary label="Settings">
          <SettingsPanel open={showSettings} onOpenChange={(open: boolean) => { if (!open) setShowSettings(false); }} defaultActiveTab={initialSettingsTab} />
        </PanelErrorBoundary>
        <PanelErrorBoundary label="Insights">
          <InsightsPanel open={showInsights} onClose={() => setShowInsights(false)} />
        </PanelErrorBoundary>
        <PanelErrorBoundary label="History">
          <HistoryPanel open={showHistory} onClose={() => setShowHistory(false)} />
        </PanelErrorBoundary>
      </Suspense>
    </Layout>
  );
}

/**
 * App —— 新标签页根组件
 *
 * 包裹 I18nProvider 与 AntdThemeProvider，
 * 渲染 VideoBackground、AppContent 与 ClickEffectLayer。
 *
 * @returns 新标签页根节点 JSX
 */
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
