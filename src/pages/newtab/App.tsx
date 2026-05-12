/**
 * 新标签页应用主入口（antd v6 版）
 *
 * 布局结构：
 *   ┌─ Layout.Header（sticky，毛玻璃，品牌 + 次级操作）
 *   └─ Layout.Content（最大 1280，居中）
 *        · Hero：大搜索框 + Segmented 视图切换
 *        · OnboardingCard（首次）
 *        · DedupInfoBar（有重复时）
 *        · 主视图：Domain / Timeline / Compact / Grid / Frequency
 *
 * 所有 UI 组件一律走 antd；不再依赖 Tailwind / 自写原子组件。
 */

import { useEffect, useState, useCallback, useMemo, useRef, lazy, Suspense, type CSSProperties, type RefObject } from 'react';
import {
  Layout,
  Input,
  Space,
  Typography,
  Tag,
  Button,
  Tooltip,
  Spin,
  Alert,
  Segmented,
} from 'antd';
import {
  Search,
  Settings,
  Save,
  Sun,
  Moon,
  Monitor,
  BarChart3,
  Globe,
} from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useTabsStore, useSettingsStore, useUndoStore, useMetadataStore, useSelectionStore } from '@/store';
import { useSwBroadcast, useResolvedTheme } from '@/shared/hooks';
import { useKeybinding } from '@/shared/hooks/use-keybinding';
import { AntdThemeProvider } from '@/shared/ui/AntdThemeProvider';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { UndoToast } from '@/shared/ui/UndoToast';
import { FeatureEmptyState } from '@/shared/ui/FeatureEmptyState';
import '@/shared/ui/FeatureEmptyState.css';
import { I18nProvider, useT } from '@/shared/i18n';
import { DomainGroupView } from '@/features/tabs/DomainGroupView';
import { TidySuggestionBar } from '@/features/tabs/TidySuggestionBar';
import { BatchActionBar } from '@/features/tabs/BatchActionBar';
import { SelectionModeNotice } from '@/features/tabs/SelectionModeNotice';
import { BRAND, getBrandDisplayName, getBrandSlogan } from '@/shared/config/brand';

const TrendingPage = lazy(() => import('@/features/trending/TrendingPage').then((m) => ({ default: m.TrendingPage })));
const DeveloperToolsPage = lazy(() => import('@/features/developer-tools/DeveloperToolsPage').then((m) => ({ default: m.DeveloperToolsPage })));

/** 懒加载非默认视图——直接导入文件而非 barrel，确保每个视图独立拆 chunk */
const TimelineView = lazy(() => import('@/features/tabs/TimelineView').then((m) => ({ default: m.TimelineView })));
const CompactView = lazy(() => import('@/features/tabs/CompactView').then((m) => ({ default: m.CompactView })));
const GridView = lazy(() => import('@/features/tabs/GridView').then((m) => ({ default: m.GridView })));
const FrequencyView = lazy(() => import('@/features/tabs/FrequencyView').then((m) => ({ default: m.FrequencyView })));
const TabGroupView = lazy(() => import('@/features/tabs/TabGroupView').then((m) => ({ default: m.TabGroupView })));
const WindowView = lazy(() => import('@/features/tabs/WindowView').then((m) => ({ default: m.WindowView })));
const BookmarkView = lazy(() => import('@/features/tabs/BookmarkView').then((m) => ({ default: m.BookmarkView })));
const KanbanView = lazy(() => import('@/features/tabs/KanbanView').then((m) => ({ default: m.KanbanView })));
import { OnboardingCard } from '@/features/sessions/OnboardingCard';
import { hasCompletedOnboarding } from '@/repositories';
import type { ArchivedSession, NewtabPageMode } from '@/shared/types';
import { recordMetric, recordFcpOnce, recordFpsSampleOnce, track } from '@/shared/utils/metrics';
import { getArchivedSessions, initArchiveStorage } from '@/services/archive-service';
import { APP_EVENTS } from '@/shared/config/storage-keys';
import { resolveGradient } from '@/shared/theme/gradient-presets';
import { VIEW_CONFIGS, VALID_VIEWS, type ViewMode } from '@/shared/config/views';
import { registerViews, getViewComponentMap } from '@/shared/config/view-registry';
import { findDuplicates } from '@/shared/utils/dedupe';
import { detectIdleTabs } from '@/shared/utils/idle-detect';
import { WorkspaceSwitcher } from '@/features/workspace/WorkspaceSwitcher';
const InsightsPanel = lazy(() => import('@/features/insights/InsightsPanel'));

/** 懒加载抽屉/面板——非首屏必需，直接导入文件确保独立拆 chunk */
const SearchBox = lazy(() => import('@/features/search/SearchBox').then((m) => ({ default: m.SearchBox })));
const ArchivePanel = lazy(() => import('@/features/sessions/ArchivePanel').then((m) => ({ default: m.ArchivePanel })));
const SettingsPanel = lazy(() => import('@/features/settings/SettingsPanel').then((m) => ({ default: m.SettingsPanel })));
// ClickEffectLayer —— 点击动效 Canvas 图层，默认 off 时不拉取 chunk。
const ClickEffectLayer = lazy(() => import('@/features/effects/ClickEffectLayer').then((m) => ({ default: m.ClickEffectLayer })));
// VideoBackground —— 视频背景层，zIndex:-1；默认 none 时不拉取 chunk。
const VideoBackground = lazy(() => import('@/features/effects/VideoBackground').then((m) => ({ default: m.VideoBackground })));

/** 注册所有视图到 ViewRegistry —— 新增视图只需在此添加一条 */
registerViews([
  { id: 'domain', component: DomainGroupView, order: 1 },
  { id: 'tabgroup', component: TabGroupView, order: 2 },
  { id: 'window', component: WindowView, order: 3 },
  { id: 'bookmarks', component: BookmarkView, order: 4 },
  { id: 'timeline', component: TimelineView, order: 5 },
  { id: 'compact', component: CompactView, order: 6 },
  { id: 'grid', component: GridView, order: 7 },
  { id: 'frequency', component: FrequencyView, order: 8 },
  { id: 'kanban', component: KanbanView, order: 9 },
]);

const { Header, Content } = Layout;
const { Text } = Typography;



/**
 * 顶栏：轻量工具条（标签计数 + 吸附搜索 + 操作按钮）
 *
 * 设计策略：
 *   - 不再放品牌 logo（已移到 HeroBar 居中展示），Header 仅作功能栏
 *   - 左侧：小型 logo 图标 + 标签计数，紧凑不抢视觉
 *   - 中部：滚动吸附搜索触发器（Hero 搜索框滚出视野时渐显）
 *   - 右侧：归档 / 明暗切换 / 设置
 *   - 整体更薄更轻，把视觉重心让给 Hero 区的品牌 + 搜索
 */
function AppHeader({
  tabCount,
  domainCount,
  duplicateTabsCount,
  idleTabsCount,
  hasTidySuggestions,
  compactSearchVisible,
  pageMode,
  onPageModeChange,
  onArchive,
  onSettings,
  onOpenSearch,
  onInsights,
  onTidy,
}: {
  tabCount: number;
  domainCount: number;
  duplicateTabsCount: number;
  idleTabsCount: number;
  hasTidySuggestions: boolean;
  compactSearchVisible: boolean;
  pageMode: NewtabPageMode;
  onPageModeChange: (mode: NewtabPageMode) => void;
  onArchive: () => void;
  onSettings: () => void;
  onOpenSearch: () => void;
  onInsights?: () => void;
  /** 一键整理回调 */
  onTidy?: () => void;
}) {
  const theme = useSettingsStore((s) => s.settings.theme);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const { t } = useT();
  /** 循环切换 light → dark → system */
  const toggleTheme = useCallback(() => {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    void updateSettings({ theme: next });
  }, [theme, updateSettings]);

  /**
   * 主题图标：三态分别用差异化强烈的图形，避免「点了看不出变化」
   *   - light  → 太阳 ☀
   *   - dark   → 月亮 🌙
   *   - system → 显示器 🖥
   */
  const themeIcon =
    theme === 'system' ? (
      <Monitor key="sys" size={ICON_SIZE.MEDIUM} className="app-icon app-icon--theme" />
    ) : theme === 'dark' ? (
      <Moon key="dark" size={ICON_SIZE.MEDIUM} className="app-icon app-icon--theme" />
    ) : (
      <Sun key="light" size={ICON_SIZE.MEDIUM} className="app-icon app-icon--theme" />
    );

  return (
    <Header className="app-header-shell">
      {/* 左侧：小 logo + 状态摘要 */}
      <div className="app-header-left">
        <img
          src="/icons/logo.png"
          alt={BRAND.name}
          className="app-header-logo"
        />
        {/* 状态徽标 */}
        <Tag
          color={hasTidySuggestions ? 'gold' : 'green'}
          className={`app-header-status-tag${compactSearchVisible ? ' is-hidden' : ''}`}
        >
          {hasTidySuggestions ? t('dashboard.tidyReady') : t('dashboard.allClear')}
        </Tag>
        {/* 核心计数 —— 仅在吸附搜索未激活时显示 */}
        <span
          className={`app-header-metrics${compactSearchVisible ? ' is-hidden' : ''}`}
        >
          <span className="app-header-metric-strong">{tabCount}</span> {t('dashboard.tabsStat')}
          <span className="app-header-dot">·</span>
          <span className="app-header-metric-strong">{domainCount}</span> {t('dashboard.domainsStat')}
          {(duplicateTabsCount > 0 || idleTabsCount > 0) && (
            <>
              <span className="app-header-dot">·</span>
              <span
                className={`app-header-metric-warning${hasTidySuggestions ? ' is-warning' : ''}`}
              >
                {duplicateTabsCount + idleTabsCount}
              </span>{' '}
              {t('header.pending')}
              {onTidy && (
                <button
                  type="button"
                  className="app-header-tidy-link"
                  onClick={onTidy}
                >
                  {t('dashboard.tidyAction')}
                </button>
              )}
            </>
          )}
        </span>
      </div>

      {/*
        中部吸附搜索触发器
        ---------------------------------
        · flex:1 占满中间空间
        · Hero 搜索框在视野内时隐藏，滚出后渐显
      */}
      <div className="app-header-center">
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label={t('search.placeholder')}
          className={`app-compact-search app-header-search-trigger${compactSearchVisible ? ' is-visible' : ''}`}
        >
          <Search size={ICON_SIZE.DEFAULT} className="app-icon app-icon--search app-header-search-icon" />
          <span className="app-header-search-trigger-text">
            {t('search.placeholder')}
          </span>
          <span className="app-kbd" aria-hidden>
            ⌘K
          </span>
        </button>
      </div>

      <Space size={8} className="app-header-actions">
        <Segmented<NewtabPageMode>
          size="small"
          value={pageMode}
          onChange={(value) => onPageModeChange(value)}
          options={[
            { value: 'workspace', label: t('pageMode.workspace') },
            { value: 'trending', label: t('pageMode.trending') },
            { value: 'devtools', label: t('pageMode.devtools') },
          ]}
        />
        <WorkspaceSwitcher />
        <Tooltip title={t('header.archiveTooltip')} placement="bottom">
          <Button
            type="text"
            icon={<Save size={ICON_SIZE.MEDIUM} className="app-icon app-icon--archive" />}
            onClick={onArchive}
            aria-label={t('header.archiveTooltip')}
          />
        </Tooltip>
        <Tooltip title={t(`theme.${theme}`)}>
          <Button
            type="text"
            icon={
              <span
                key={theme}
                className="app-theme-icon"
              >
                {themeIcon}
              </span>
            }
            onClick={toggleTheme}
            aria-label={t(`theme.${theme}`)}
          />
        </Tooltip>
        <Tooltip title={t('header.settings')}>
          <Button
            type="text"
            icon={<Settings size={ICON_SIZE.MEDIUM} className="app-icon app-icon--settings" />}
            onClick={onSettings}
            aria-label={t('header.settings')}
          />
        </Tooltip>
        {onInsights && (
          <Tooltip title={t('insights.title')}>
            <Button
              type="text"
              icon={<BarChart3 size={ICON_SIZE.MEDIUM} className="app-icon app-icon--insights" />}
              onClick={onInsights}
              aria-label={t('insights.title')}
            />
          </Tooltip>
        )}
      </Space>
    </Header>
  );
}

/**
 * Hero 区：品牌 Logo + 搜索框 + 视图切换
 *
 * 排版策略（参考微软新标签页）：
 *   - 品牌 Logo 居中展示，搜索框紧随其下——形成视觉重心
 *   - Logo 不做太大，保持精致感；品牌名用渐变文字
 *   - 搜索框居中、超宽、带辉光阴影——第一视觉焦点
 *   - 视图切换在搜索框下方，紧凑 Tab 行
 *   - 整体垂直节奏：logo → 搜索 → 视图，间距递减
 */
function HeroBar({
  viewMode,
  onViewChange,
  onOpenSearch,
  sentinelRef,
  showLogo,
  showTitle,
  showSlogan,
  showSearch,
  showViewSwitcher,
}: {
  viewMode: ViewMode;
  onViewChange: (v: ViewMode) => void;
  onOpenSearch: () => void;
  sentinelRef: RefObject<HTMLDivElement | null>;
  showLogo: boolean;
  showTitle: boolean;
  showSlogan: boolean;
  showSearch: boolean;
  showViewSwitcher: boolean;
}) {
  const { t, locale } = useT();
  /** 品牌身份：名称 + slogan 均来自 BRAND 配置层，切换品牌无需改此处 */
  const brandName = getBrandDisplayName(locale);
  const brandSlogan = getBrandSlogan(locale);
  const shouldShowBrandRow = showLogo || showTitle;
  const shouldShowSlogan = showSlogan && brandSlogan !== '';

  /**
   * Segmented 视图切换 options。
   *
   * 之前这里每次 AppHeader 渲染都会调用 VIEW_CONFIGS.map 重建整个数组与 label JSX，
   * 导致 antd Segmented 内部判等失败、无意义地重新布局。此处用 useMemo 缓存，
   * 依赖 t——i18n 语言切换时自动刷新标签文案。
   */
  const viewSegmentedOptions = useMemo(
    () =>
      VIEW_CONFIGS.map((v) => ({
        value: v.id,
        label: (
          <span className="app-view-option">
            <v.Icon size={ICON_SIZE.MEDIUM} />
            {t(v.labelKey)}
          </span>
        ),
      })),
    [t],
  );

  return (
    <section className="app-hero">
      {/* 品牌 Logo —— 居中展示，参考微软新标签页
          所有内容通过 BRAND 配置层读取，切换品牌预设即可整站换装 */}
      {(shouldShowBrandRow || shouldShowSlogan) && (
        <div
          className="app-hero-brand"
        >
          {shouldShowBrandRow && (
            <div className="app-hero-brand-row">
              {showLogo && (
                <img
                  src="/icons/logo.png"
                  alt={BRAND.name}
                  className="app-hero-logo"
                />
              )}
              {showTitle && (
                <span className="app-hero-title">
                  {brandName}
                </span>
              )}
            </div>
          )}
          {/* Slogan —— 低调次级展示，字号控制在 12px，避免喧宾夺主 */}
          {shouldShowSlogan && (
            <span className="app-hero-slogan">
              {brandSlogan}
            </span>
          )}
        </div>
      )}

      {/* 搜索框 —— 超宽居中，大圆角 + 品牌辉光
          hover 态、transition 全部交给 .app-hero-search（CSS），
          避免在 React 里写 onMouseEnter/Leave 副作用。 */}
      {showSearch && (
        <div ref={sentinelRef} className="app-hero-search-wrap">
          <Input
            className="app-hero-search"
            size="large"
            readOnly
            placeholder={t('search.placeholder')}
            prefix={<Search size={ICON_SIZE.XXL} className="app-icon app-icon--search app-hero-search-icon" />}
            suffix={<span className="app-kbd">⌘K</span>}
            onFocus={(e) => {
              e.currentTarget.blur();
              onOpenSearch();
            }}
            onClick={onOpenSearch}
          />
        </div>
      )}

      {/* 视图切换 —— 使用 antd 官方 Segmented，自动处理 hover/focus/键盘导航与选中态权重。
          label 只渲染图标 + 文案，其余视觉（选中态/hover）由 Segmented 主题 token 接管。 */}
      {showViewSwitcher && (
        <Segmented<ViewMode>
          value={viewMode}
          onChange={(v: ViewMode) => onViewChange(v)}
          options={viewSegmentedOptions}
          size="middle"
          className="app-view-switcher"
        />
      )}
    </section>
  );
}

function AppContent() {
  const loadAllTabs = useTabsStore((s) => s.loadAllTabs);
  const loading = useTabsStore((s) => s.loading);
  const tabs = useTabsStore((s) => s.tabs);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadUndoRecords = useUndoStore((s) => s.loadRecords);
  const loadMetadata = useMetadataStore((s) => s.loadMetadata);
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const selectionMode = useSelectionStore((s) => s.selectionMode);
  const selectAll = useSelectionStore((s) => s.selectAll);
  const clearSelection = useSelectionStore((s) => s.clearSelection);
  const exitSelectionMode = useSelectionStore((s) => s.exitSelectionMode);

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checked, setChecked] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [initRunId, setInitRunId] = useState(0);
  const [showArchive, setShowArchive] = useState(false);
  /**
   * 若 URL hash 为 #about，则初始直接打开 Settings 抽屉并切到 About Tab。
   * 使用 useEffect 读取 hash，避免严格模式下 useState 初始化函数执行两次导致的问题。
   */
  const [initialSettingsTab, setInitialSettingsTab] = useState<'appearance' | 'about'>('appearance');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash === '#about') {
      setInitialSettingsTab('about');
    }
  }, []);
  useEffect(() => {
    if (initialSettingsTab === 'about' && typeof window !== 'undefined' && window.location.hash === '#about') {
      history.replaceState(null, '', window.location.pathname);
    }
  }, [initialSettingsTab]);
  const [showSettings, setShowSettings] = useState(false);
  useEffect(() => {
    if (initialSettingsTab === 'about') {
      setShowSettings(true);
    }
  }, [initialSettingsTab]);
  const [showInsights, setShowInsights] = useState(false);
  /** tidyExpandSignal 对 TidySuggestionBar：默认为 0，点 "一键整理" 时 +1 触发展开 */
  const [tidyExpandSignal, setTidyExpandSignal] = useState(0);
  /** Hero 搜索框是否已滚出视野——用于驱动 Header 吸附搜索渐显 */
  const [compactSearchVisible, setCompactSearchVisible] = useState(false);
  const mountedRef = useRef(true);
  const heroSearchRef = useRef<HTMLDivElement>(null);
  const tidySectionRef = useRef<HTMLDivElement>(null);
  /**
   * viewMode 直接从 settings 派生 —— 这样「设置里修改默认视图」会即时反映到当前页面，
   * 不需要刷新。切视图时通过 updateSettings 写回 store，两个入口自动同步。
   */
  const pageMode = useSettingsStore((s) => s.settings.newtabPageMode ?? 'workspace');
  const defaultView = useSettingsStore((s) => s.settings.defaultView);
  const viewMode: ViewMode = VALID_VIEWS.includes(defaultView) ? defaultView : 'domain';

  /** 背景预设 → CSS gradient，统一走 resolveGradient 消灭硬编码 */
  const gradientPreset = useSettingsStore((s) => s.settings.gradientPreset);
  const customGradient = useSettingsStore((s) => s.settings.customGradient);
  const backgroundImage = useSettingsStore((s) => s.settings.backgroundImage);
  const backgroundOverlay = useSettingsStore((s) => s.settings.backgroundOverlay);
  const contentMaxWidth = useSettingsStore((s) => s.settings.contentMaxWidth ?? 1360);
  const uiVisibility = useSettingsStore((s) => s.settings.uiVisibility);
  const resolvedDark = useResolvedTheme() === 'dark';
  const layoutBackground = resolveGradient(gradientPreset, resolvedDark, customGradient);
  const { t } = useT();

  /** 归档数据同步回调（ArchivePanel 变更后触发） */
  const syncArchiveSummary = useCallback((_sessions: ArchivedSession[]) => {
    // 保留回调签名供 ArchivePanel onSessionsChange 使用
    // DashboardOverview 已移除，不再需要追踪 latestArchive
  }, []);

  const refreshArchiveSummary = useCallback(async () => {
    try {
      const sessions = await getArchivedSessions();
      syncArchiveSummary(sessions);
      return sessions;
    } catch (err) {
      console.warn(`${BRAND.logTag} load archive summary failed`, err);
      return [];
    }
  }, [syncArchiveSummary]);

  useSwBroadcast();

  /**
   * 监听全局自定义事件 `app:open-archive`（由 UndoToast / ActivityStrip 派发），
   * 统一打开 ArchivePanel。
   */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ sessionId?: string }>).detail;
      setShowArchive(true);
      if (detail?.sessionId !== undefined) {
        // 预留：将 sessionId 广播给 ArchivePanel 做高亮
        window.dispatchEvent(new CustomEvent('app:highlight-session', { detail }));
      }
    };
    window.addEventListener(APP_EVENTS.openArchive, handler);
    return () => window.removeEventListener(APP_EVENTS.openArchive, handler);
  }, []);

  /**
   * 全局快捷键通过 URL hash 传信号：#search → 自动聚焦搜索框
   * 首次渲染时检测 hash，后续不再监听（这是 one-shot 信号）
   */
  const [searchFromHash, setSearchFromHash] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (hash === '#search') {
      setSearchFromHash(true);
    }
  }, []);
  useEffect(() => {
    if (searchFromHash && typeof window !== 'undefined' && window.location.hash === '#search') {
      history.replaceState(null, '', window.location.pathname);
    }
  }, [searchFromHash]);
  const [showSearch, setShowSearch] = useState(false);
  useEffect(() => {
    if (searchFromHash) {
      setShowSearch(true);
    }
  }, [searchFromHash]);

  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;

    void (async () => {
      try {
        await loadSettings();

        const [archiveSessionsResult, tabsResult, undoResult, metadataResult, onboardingResult] = await Promise.allSettled([
          (async () => {
            await initArchiveStorage();
            return getArchivedSessions();
          })(),
          loadAllTabs(),
          loadUndoRecords(),
          loadMetadata(),
          hasCompletedOnboarding(),
        ]);

        if (archiveSessionsResult.status === 'fulfilled') {
          syncArchiveSummary(archiveSessionsResult.value);
        } else {
          console.warn(`${BRAND.logTag} initArchiveStorage failed`, archiveSessionsResult.reason);
        }
        if (tabsResult.status === 'rejected') {
          console.warn(`${BRAND.logTag} loadAllTabs failed`, tabsResult.reason);
          if (!cancelled) {
            setInitError(t('tabs.loadFailed'));
          }
        }
        if (undoResult.status === 'rejected') {
          console.warn(`${BRAND.logTag} loadUndoRecords failed`, undoResult.reason);
        }
        if (metadataResult.status === 'rejected') {
          console.warn(`${BRAND.logTag} loadMetadata failed`, metadataResult.reason);
        }
        if (!cancelled) {
          if (onboardingResult.status === 'fulfilled') {
            setShowOnboarding(!onboardingResult.value);
          } else {
            console.warn(`${BRAND.logTag} hasCompletedOnboarding failed`, onboardingResult.reason);
            setShowOnboarding(true);
          }
        }
      } catch (err) {
        console.warn(`${BRAND.logTag} app initialization failed`, err);
        if (!cancelled) {
          setInitError(t('tabs.loadFailed'));
        }
      } finally {
        if (!cancelled) {
          setChecked(true);
        }
        void recordMetric('newtabOpens');
        // v1.0 封板：首屏性能采样
        recordFcpOnce();
        recordFpsSampleOnce();
      }
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [initRunId, loadAllTabs, loadMetadata, loadSettings, loadUndoRecords, syncArchiveSummary, t]);

  /** 页面内快捷键：通过可配置的 useKeybinding hook 注册 */
  useKeybinding('search', useCallback(() => setShowSearch((v) => !v), []));

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

  /**
   * 滚动吸附搜索
   * ---------------------------------
   * 使用 IntersectionObserver 观察 Hero 搜索框是否离开视野。
   * - rootMargin top 设为 `-64px` 让「刚被 56px Header 盖住时」就认定离开，
   *   避免搜索框被 Header 半遮挡时显示异常。
   * - 仅依赖 intersecting 一个信号，避免 scroll 事件高频 re-render。
   * - `checked` 之前节点尚未挂载，放在 checked 之后订阅即可。
   */
  useEffect(() => {
    if (!checked) return;
    const node = heroSearchRef.current;
    if (node === null || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setCompactSearchVisible(!entry.isIntersecting);
      },
      { rootMargin: '-64px 0px 0px 0px', threshold: 0 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [checked]);

  const handleViewChange = useCallback((view: ViewMode) => {
    const prev = useSettingsStore.getState().settings.defaultView;
    // 切换视图仅写 settings；viewMode 从 settings 派生，会自动更新
    void useSettingsStore.getState().updateSettings({ defaultView: view });
    void track('view_switch', { from: prev, to: view });
  }, []);

  const handlePageModeChange = useCallback((mode: NewtabPageMode) => {
    const prev = useSettingsStore.getState().settings.newtabPageMode ?? 'workspace';
    void useSettingsStore.getState().updateSettings({ newtabPageMode: mode });
    setShowSearch(false);
    setShowArchive(false);
    setShowSettings(false);
    setShowInsights(false);
    void track('newtab_page_mode_switch', { from: prev, to: mode });
  }, []);

  const handleOpenSearch = useCallback(() => {
    setShowSearch(true);
    setShowArchive(false);
    setShowSettings(false);
    setShowInsights(false);
  }, []);

  const handleOpenArchive = useCallback(() => {
    setShowArchive(true);
    setShowSearch(false);
    setShowSettings(false);
    setShowInsights(false);
  }, []);

  const handleArchivePanelOpenChange = useCallback((open: boolean) => {
    setShowArchive(open);
    if (!open) {
      void refreshArchiveSummary();
    }
  }, [refreshArchiveSummary]);

  const handleOpenSettings = useCallback(() => {
    setShowSettings(true);
    setShowSearch(false);
    setShowArchive(false);
    setShowInsights(false);
  }, []);

  const handleOpenInsights = useCallback(() => {
    setShowInsights(true);
    setShowSearch(false);
    setShowArchive(false);
    setShowSettings(false);
  }, []);

  const handleSelectAllTabs = useCallback(() => {
    selectAll(tabs.map((tab) => tab.id));
  }, [selectAll, tabs]);

  const selectedTabs = tabs.filter((tab) => selectedIds.has(tab.id));
  const tabCount = tabs.length;
  const domainCount = new Set(tabs.map((tab) => tab.hostname)).size;

  /** 使用 useMemo 缓存视图组件，替换 IIFE */
  const ViewComponent = useMemo(() => {
    const Comp = getViewComponentMap()[viewMode];
    return Comp !== undefined ? Comp : null;
  }, [viewMode]);

  /** Workspace 统计摘要 —— 用于 Header 状态栏展示 */
  const dedupStrictness = useSettingsStore((s) => s.settings.dedupStrictness ?? 'loose');
  const idleThresholdMinutes = useSettingsStore((s) => s.settings.idleThresholdMinutes ?? 1440);
  /** dupGroups / idleTabsArr 计算开销较大，用 useMemo 避免无关渲染时重复执行 */
  const dupGroups = useMemo(() => findDuplicates(tabs, dedupStrictness), [tabs, dedupStrictness]);
  const idleTabsArr = useMemo(() => detectIdleTabs(tabs, idleThresholdMinutes), [tabs, idleThresholdMinutes]);
  const duplicateTabsCount = dupGroups.reduce((sum, group) => sum + group.tabs.length - 1, 0);
  const idleTabsCount = idleTabsArr.length;
  const hasTidySuggestions = duplicateTabsCount > 0 || idleTabsCount > 0;
  const showHeroLogo = uiVisibility?.heroLogo !== false;
  const showHeroTitle = uiVisibility?.heroTitle !== false;
  const showHeroSlogan = uiVisibility?.heroSlogan !== false;
  const showHeroSearch = uiVisibility?.heroSearch !== false;
  const showViewSwitcher = uiVisibility?.viewSwitcher !== false;
  const showHeroBar = showHeroLogo || showHeroTitle || showHeroSlogan || showHeroSearch || showViewSwitcher;

  if (!checked) {
    return (
      <div className="app-page-loading">
        <div className="app-page-loading-inner">
          <Spin />
          <Text type="secondary">{t('tabs.loading')}</Text>
        </div>
      </div>
    );
  }

  /**
   * 构建 Layout 背景样式：
   *   - 基础层：渐变背景
   *   - 图片层：backgroundImage.url（如有）
   *   - 遮罩层：通过 ::after 伪元素实现（在 index.css 中）
   */
  const layoutStyle: CSSProperties = {
    minHeight: '100vh',
    background: layoutBackground,
    position: 'relative',
  };

  /** 如果有背景图，叠加在渐变之上 */
  if (backgroundImage?.url) {
    const isEmbeddedImage = backgroundImage.url.startsWith('data:') || backgroundImage.url.startsWith('blob:');
    layoutStyle.backgroundImage = `url("${backgroundImage.url}")`;
    layoutStyle.backgroundSize = backgroundImage.fit === 'repeat' ? 'auto' : backgroundImage.fit;
    layoutStyle.backgroundRepeat = backgroundImage.fit === 'repeat' ? 'repeat' : 'no-repeat';
    layoutStyle.backgroundPosition = backgroundImage.position ?? 'center';
    layoutStyle.backgroundAttachment = isEmbeddedImage ? 'scroll' : 'fixed';
    /** 渐变作为 fallback */
    layoutStyle.backgroundColor = layoutBackground;
  }

  const overlayBlur = Math.min(Math.max(backgroundOverlay?.blur ?? 0, 0), 12);
  const overlayStyle = backgroundOverlay?.enabled
    ? ({
        ['--app-background-overlay-bg' as string]: resolvedDark ? backgroundOverlay.colorDark : backgroundOverlay.color,
        ['--app-background-overlay-filter' as string]: overlayBlur > 0 ? `blur(${overlayBlur}px)` : 'none',
      } as CSSProperties)
    : undefined;
  const contentShellClassName = contentMaxWidth > 0
    ? 'app-content-shell app-content-shell--bounded'
    : 'app-content-shell';
  const contentShellStyle = contentMaxWidth > 0
    ? ({ ['--app-content-max-width' as string]: `${contentMaxWidth}px` } as CSSProperties)
    : undefined;

  return (
    <Layout className="app-layout-shell" style={layoutStyle}>
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
          onArchive={handleOpenArchive}
          onSettings={handleOpenSettings}
          onOpenSearch={handleOpenSearch}
          onInsights={handleOpenInsights}
          onTidy={() => {
            setTidyExpandSignal((s) => s + 1);
            tidySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
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
          />
        )}

        {initError !== null && (
          <Alert
            showIcon
            type="warning"
            description={initError}
            action={(
              <Button
                size="small"
                onClick={() => {
                  setInitError(null);
                  setChecked(false);
                  setInitRunId((value) => value + 1);
                }}
              >
                {t('context.retry')}
              </Button>
            )}
            className="app-init-alert"
          />
        )}

        {pageMode === 'trending' && (
          <Suspense fallback={<div className="app-suspense-fallback"><Spin /></div>}>
            <TrendingPage />
          </Suspense>
        )}
        {pageMode === 'devtools' && (
          <Suspense fallback={<div className="app-suspense-fallback"><Spin /></div>}>
            <DeveloperToolsPage />
          </Suspense>
        )}
        {pageMode === 'workspace' && (
          <>
            {showOnboarding && <OnboardingCard onDismiss={() => setShowOnboarding(false)} />}

        {selectionMode && (
          <SelectionModeNotice
            selectedTabs={selectedTabs}
            onSelectAll={handleSelectAllTabs}
            onClearSelection={clearSelection}
            onExitSelectionMode={exitSelectionMode}
          />
        )}

        {uiVisibility?.tidySuggestion !== false && (
          <div ref={tidySectionRef}>
            <TidySuggestionBar expandSignal={tidyExpandSignal} />
          </div>
        )}

        <section>
          {loading ? (
            <div className="app-workspace-loading">
              <div className="app-workspace-loading-inner">
                <Spin />
                <Text type="secondary">{t('tabs.loading')}</Text>
              </div>
            </div>
          ) : tabCount === 0 ? (
            <FeatureEmptyState
              title={t('tabs.empty')}
              description={t('tabs.emptyHint')}
              icon={<Globe size={ICON_SIZE.XXLARGE} />}
              hints={[
                t('tabs.emptyHint1'),
                t('tabs.emptyHint2'),
                t('tabs.emptyHint3'),
              ]}
              actions={[
                { text: t('dashboard.openArchives'), onClick: handleOpenArchive, type: 'primary' },
                { text: t('header.settings'), onClick: handleOpenSettings, type: 'default' },
              ]}
            />
          ) : ViewComponent !== null ? (
            <Suspense fallback={<div className="app-suspense-fallback"><Spin /></div>}>
              <ViewComponent />
            </Suspense>
          ) : <DomainGroupView />}
        </section>
          </>
        )}
      </Content>

      <UndoToast />

      <BatchActionBar />

      <Suspense fallback={null}>
        <SearchBox open={showSearch} onOpenChange={setShowSearch} />
        <ArchivePanel open={showArchive} onOpenChange={handleArchivePanelOpenChange} onSessionsChange={syncArchiveSummary} />
          <SettingsPanel open={showSettings} onOpenChange={(open: boolean) => { if (!open) setShowSettings(false); }} defaultActiveTab={initialSettingsTab} />
        <InsightsPanel open={showInsights} onClose={() => setShowInsights(false)} />
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
