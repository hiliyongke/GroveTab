/**
 * Canopy — 新标签页应用主入口（antd v6 版）
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

import { useEffect, useState, useCallback, useRef, lazy, Suspense } from 'react';
import {
  Layout,
  Input,
  Space,
  Typography,
  Tag,
  Button,
  Tooltip,
  Empty,
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
} from 'lucide-react';
import { theme as antdTheme } from 'antd';
import { iconColor } from '@/shared/utils/icon-colors';
import { useTabsStore, useSettingsStore, useUndoStore, useMetadataStore, useSelectionStore } from '@/store';
import { useSwBroadcast, useResolvedTheme } from '@/shared/hooks';
import { useKeybinding } from '@/shared/hooks/use-keybinding';
import { AntdThemeProvider } from '@/shared/ui/AntdThemeProvider';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { UndoToast } from '@/shared/ui/UndoToast';
import { I18nProvider, useT } from '@/shared/i18n';
import { DomainGroupView } from '@/features/tabs/DomainGroupView';
import { TidySuggestionBar } from '@/features/tabs/TidySuggestionBar';
import { BatchActionBar } from '@/features/tabs/BatchActionBar';
import { SelectionModeNotice } from '@/features/tabs/SelectionModeNotice';

/** 懒加载非默认视图——直接导入文件而非 barrel，确保每个视图独立拆 chunk */
const TimelineView = lazy(() => import('@/features/tabs/TimelineView').then((m) => ({ default: m.TimelineView })));
const CompactView = lazy(() => import('@/features/tabs/CompactView').then((m) => ({ default: m.CompactView })));
const GridView = lazy(() => import('@/features/tabs/GridView').then((m) => ({ default: m.GridView })));
const FrequencyView = lazy(() => import('@/features/tabs/FrequencyView').then((m) => ({ default: m.FrequencyView })));
const TabGroupView = lazy(() => import('@/features/tabs/TabGroupView').then((m) => ({ default: m.TabGroupView })));
const WindowView = lazy(() => import('@/features/tabs/WindowView').then((m) => ({ default: m.WindowView })));
const BookmarkView = lazy(() => import('@/features/tabs/BookmarkView').then((m) => ({ default: m.BookmarkView })));
import { OnboardingCard } from '@/features/sessions/OnboardingCard';
import { hasCompletedOnboarding } from '@/repositories';
import type { ArchivedSession } from '@/shared/types';
import { recordMetric } from '@/shared/utils/metrics';
import { getArchivedSessions, initArchiveStorage } from '@/services/archive-service';
import { resolveGradient } from '@/shared/theme/gradient-presets';
import { VIEW_CONFIGS, VALID_VIEWS, type ViewMode } from '@/shared/config/views';
import { registerViews, getViewComponentMap } from '@/shared/config/view-registry';
import { findDuplicates } from '@/shared/utils/dedupe';
import { detectIdleTabs } from '@/shared/utils/idle-detect';

/** 懒加载抽屉/面板——非首屏必需，直接导入文件确保独立拆 chunk */
const SearchBox = lazy(() => import('@/features/search/SearchBox').then((m) => ({ default: m.SearchBox })));
const ArchivePanel = lazy(() => import('@/features/sessions/ArchivePanel').then((m) => ({ default: m.ArchivePanel })));
const SettingsPanel = lazy(() => import('@/features/settings/SettingsPanel').then((m) => ({ default: m.SettingsPanel })));

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
  onArchive,
  onSettings,
  onOpenSearch,
}: {
  tabCount: number;
  domainCount: number;
  duplicateTabsCount: number;
  idleTabsCount: number;
  hasTidySuggestions: boolean;
  compactSearchVisible: boolean;
  onArchive: () => void;
  onSettings: () => void;
  onOpenSearch: () => void;
}) {
  const theme = useSettingsStore((s) => s.settings.theme);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const { t } = useT();
  const { token } = antdTheme.useToken();

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
      <Monitor key="sys" size={14} style={{ color: iconColor('theme', token) }} />
    ) : theme === 'dark' ? (
      <Moon key="dark" size={14} style={{ color: iconColor('theme', token) }} />
    ) : (
      <Sun key="light" size={14} style={{ color: iconColor('theme', token) }} />
    );

  return (
    <Header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        height: 'var(--canopy-header-height)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        background: 'var(--canopy-glass-bg)',
        borderBottom: '1px solid var(--canopy-hairline)',
        backdropFilter: 'var(--canopy-glass-filter)',
        WebkitBackdropFilter: 'var(--canopy-glass-filter)',
      }}
    >
      {/* 左侧：小 logo + 状态摘要 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 7,
            background: 'var(--canopy-logo-gradient)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: '-0.02em',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          C
        </div>
        {/* 状态徽标 */}
        <Tag
          color={hasTidySuggestions ? 'gold' : 'green'}
          style={{
            margin: 0,
            fontSize: 10.5,
            fontWeight: 500,
            borderRadius: 6,
            opacity: compactSearchVisible ? 0 : 1,
            transform: compactSearchVisible ? 'translateX(-4px)' : 'translateX(0)',
            transition: 'opacity 220ms ease, transform 220ms ease',
            pointerEvents: compactSearchVisible ? 'none' : 'auto',
          }}
        >
          {hasTidySuggestions ? t('dashboard.tidyReady') : t('dashboard.allClear')}
        </Tag>
        {/* 核心计数 —— 仅在吸附搜索未激活时显示 */}
        <span
          style={{
            fontSize: 12,
            color: token.colorTextSecondary,
            whiteSpace: 'nowrap',
            opacity: compactSearchVisible ? 0 : 1,
            transform: compactSearchVisible ? 'translateX(-4px)' : 'translateX(0)',
            transition: 'opacity 220ms ease, transform 220ms ease',
          }}
        >
          <span style={{ color: token.colorText, fontWeight: 500 }}>{tabCount}</span> {t('dashboard.tabsStat')}
          <span style={{ margin: '0 6px', color: token.colorBorder }}>·</span>
          <span style={{ color: token.colorText, fontWeight: 500 }}>{domainCount}</span> {t('dashboard.domainsStat')}
          {(duplicateTabsCount > 0 || idleTabsCount > 0) && (
            <>
              <span style={{ margin: '0 6px', color: token.colorBorder }}>·</span>
              <span style={{ color: hasTidySuggestions ? token.colorWarning : token.colorTextSecondary, fontWeight: 500 }}>
                {duplicateTabsCount + idleTabsCount}
              </span>{' '}
              {t('header.pending')}
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
      <div
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          minWidth: 0,
          paddingInline: 12,
        }}
      >
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label={t('search.placeholder')}
          className="canopy-compact-search"
          style={{
            all: 'unset',
            boxSizing: 'border-box',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            maxWidth: compactSearchVisible ? 420 : 0,
            height: 32,
            padding: compactSearchVisible ? '0 12px' : '0',
            borderRadius: 999,
            background: 'var(--ant-color-fill-tertiary)',
            border: '1px solid var(--ant-color-border-secondary)',
            color: 'var(--ant-color-text-tertiary)',
            fontSize: 13,
            opacity: compactSearchVisible ? 1 : 0,
            transform: compactSearchVisible ? 'translateY(0)' : 'translateY(-6px)',
            transition:
              'opacity 260ms ease, transform 260ms ease, max-width 300ms ease, padding 260ms ease, background 160ms ease, border-color 160ms ease',
            pointerEvents: compactSearchVisible ? 'auto' : 'none',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
        >
          <Search size={13} style={{ flexShrink: 0, color: iconColor('search', token) }} />
          <span
            style={{
              flex: 1,
              textAlign: 'left',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {t('search.placeholder')}
          </span>
          <span className="canopy-kbd" aria-hidden>
            ⌘K
          </span>
        </button>
      </div>

      <Space size={2} style={{ flexShrink: 0 }}>
        <Tooltip title={t('header.archiveTooltip')} placement="bottom">
          <Button type="text" icon={<Save size={14} style={{ color: iconColor('archive', token) }} />} onClick={onArchive} />
        </Tooltip>
        <Tooltip title={t(`theme.${theme}`)}>
          <Button
            type="text"
            icon={
              <span
                key={theme}
                style={{
                  display: 'inline-flex',
                  animation: 'canopy-theme-icon-spin 260ms ease-out',
                }}
              >
                {themeIcon}
              </span>
            }
            onClick={toggleTheme}
          />
        </Tooltip>
        <Tooltip title={t('header.settings')}>
          <Button type="text" icon={<Settings size={14} style={{ color: iconColor('settings', token) }} />} onClick={onSettings} />
        </Tooltip>
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
  showViewSwitcher,
}: {
  viewMode: ViewMode;
  onViewChange: (v: ViewMode) => void;
  onOpenSearch: () => void;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  showViewSwitcher: boolean;
}) {
  const { t } = useT();
  const { token } = antdTheme.useToken();

  return (
    <section
      style={{
        padding: '36px 0 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
      }}
    >
      {/* 品牌 Logo —— 居中展示，参考微软新标签页 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'var(--canopy-logo-gradient)',
            color: '#fff',
            fontWeight: 800,
            fontSize: 17,
            letterSpacing: '-0.03em',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--canopy-logo-glow)',
          }}
        >
          C
        </div>
        <span
          style={{
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            background: 'var(--canopy-logo-gradient)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Canopy
        </span>
      </div>

      {/* 搜索框 —— 超宽居中，大圆角 + 品牌辉光
          hover 态、transition 全部交给 .canopy-hero-search（CSS），
          避免在 React 里写 onMouseEnter/Leave 副作用。 */}
      <div ref={sentinelRef} style={{ width: '100%', maxWidth: 680 }}>
        <Input
          className="canopy-hero-search"
          size="large"
          readOnly
          placeholder={t('search.placeholder')}
          prefix={<Search size={17} style={{ color: token.colorPrimary }} />}
          suffix={<span className="canopy-kbd">⌘K</span>}
          onFocus={(e) => {
            e.currentTarget.blur();
            onOpenSearch();
          }}
          onClick={onOpenSearch}
          style={{
            borderRadius: 'var(--canopy-search-radius)',
            cursor: 'pointer',
            height: 'var(--canopy-search-height)',
            fontSize: 'var(--canopy-search-font-size)',
            background: token.colorBgContainer,
            border: `1px solid ${token.colorBorderSecondary}`,
            boxShadow: 'var(--canopy-shadow-brand-glow)',
          }}
        />
      </div>

      {/* 视图切换 —— 使用 antd 官方 Segmented，自动处理 hover/focus/键盘导航与选中态权重。
          label 只渲染图标 + 文案，其余视觉（选中态/hover）由 Segmented 主题 token 接管。 */}
      {showViewSwitcher && (
        <Segmented<ViewMode>
          value={viewMode}
          onChange={(v: ViewMode) => onViewChange(v)}
          options={VIEW_CONFIGS.map((v) => ({
            value: v.id,
            label: (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '1px 4px',
                  fontSize: 12.5,
                }}
              >
                <v.Icon size={14} />
                {t(v.labelKey)}
              </span>
            ),
          }))}
          size="middle"
          style={{ maxWidth: '100%' }}
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
  const [showSettings, setShowSettings] = useState(false);
  /** tidyExpandSignal 不再需要动态更新，固定值即可 */
  const tidyExpandSignal = 0;
  /** Hero 搜索框是否已滚出视野——用于驱动 Header 吸附搜索渐显 */
  const [compactSearchVisible, setCompactSearchVisible] = useState(false);
  const mountedRef = useRef(true);
  const heroSearchRef = useRef<HTMLDivElement>(null);
  const tidySectionRef = useRef<HTMLDivElement>(null);
  /**
   * viewMode 直接从 settings 派生 —— 这样「设置里修改默认视图」会即时反映到当前页面，
   * 不需要刷新。切视图时通过 updateSettings 写回 store，两个入口自动同步。
   */
  const defaultView = useSettingsStore((s) => s.settings.defaultView);
  const viewMode: ViewMode = VALID_VIEWS.includes(defaultView)
    ? (defaultView)
    : 'domain';

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

  /** 归档数据同步回调 —— ArchivePanel 变更后触发刷新 */
  const syncArchiveSummary = useCallback((_sessions: ArchivedSession[]) => {
    // 不再需要本地状态存储，保留回调签名以兼容 ArchivePanel
  }, []);

  const refreshArchiveSummary = useCallback(async () => {
    try {
      const sessions = await getArchivedSessions();
      syncArchiveSummary(sessions);
      return sessions;
    } catch (err) {
      console.warn('[Canopy] load archive summary failed', err);
      return [];
    }
  }, [syncArchiveSummary]);

  useSwBroadcast();

  /**
   * 全局快捷键通过 URL hash 传信号：#search → 自动聚焦搜索框
   * 首次渲染时检测 hash，后续不再监听（这是 one-shot 信号）
   *
   * 注：不用 useEffect + setShowSearch（react-hooks/set-state-in-effect 规则禁止），
   * 改为在初始化阶段同步读取 hash，若命中则将初始值设为 true。
   */
  const [searchFromHash] = useState(() => {
    if (typeof window === 'undefined') return false;
    const hash = window.location.hash;
    if (hash === '#search') {
      history.replaceState(null, '', window.location.pathname);
      return true;
    }
    return false;
  });
  const [showSearch, setShowSearch] = useState(searchFromHash);

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
          console.warn('[Canopy] initArchiveStorage failed', archiveSessionsResult.reason);
        }
        if (tabsResult.status === 'rejected') {
          console.warn('[Canopy] loadAllTabs failed', tabsResult.reason);
          if (!cancelled) {
            setInitError(t('tabs.loadFailed'));
          }
        }
        if (undoResult.status === 'rejected') {
          console.warn('[Canopy] loadUndoRecords failed', undoResult.reason);
        }
        if (metadataResult.status === 'rejected') {
          console.warn('[Canopy] loadMetadata failed', metadataResult.reason);
        }
        if (!cancelled) {
          if (onboardingResult.status === 'fulfilled') {
            setShowOnboarding(!onboardingResult.value);
          } else {
            console.warn('[Canopy] hasCompletedOnboarding failed', onboardingResult.reason);
            setShowOnboarding(true);
          }
        }
      } catch (err) {
        console.warn('[Canopy] app initialization failed', err);
        if (!cancelled) {
          setInitError(t('tabs.loadFailed'));
        }
      } finally {
        if (!cancelled) {
          setChecked(true);
        }
        void recordMetric('newtabOpens');
      }
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [initRunId, loadAllTabs, loadMetadata, loadSettings, loadUndoRecords, syncArchiveSummary, t]);

  /** 页面内快捷键：通过可配置的 useKeybinding hook 注册 */
  useKeybinding('search', useCallback(() => setShowSearch(true), []));

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
    // 切换视图仅写 settings；viewMode 从 settings 派生，会自动更新
    void useSettingsStore.getState().updateSettings({ defaultView: view });
  }, []);

  const handleOpenSearch = useCallback(() => {
    setShowSearch(true);
  }, []);

  const handleOpenArchive = useCallback(() => {
    setShowArchive(true);
  }, []);

  const handleArchivePanelOpenChange = useCallback((open: boolean) => {
    setShowArchive(open);
    if (!open) {
      void refreshArchiveSummary();
    }
  }, [refreshArchiveSummary]);

  const handleSelectAllTabs = useCallback(() => {
    selectAll(tabs.map((tab) => tab.id));
  }, [selectAll, tabs]);

  const selectedTabs = tabs.filter((tab) => selectedIds.has(tab.id));
  const tabCount = tabs.length;
  const domainCount = new Set(tabs.map((tab) => tab.hostname)).size;

  /** Workspace 统计摘要 —— 用于 Header 状态栏展示 */
  const dupGroups = findDuplicates(tabs);
  const idleTabsArr = detectIdleTabs(tabs);
  const duplicateTabsCount = dupGroups.reduce((sum, group) => sum + group.tabs.length - 1, 0);
  const idleTabsCount = idleTabsArr.length;
  const hasTidySuggestions = duplicateTabsCount > 0 || idleTabsCount > 0;

  if (!checked) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
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
  const layoutStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: layoutBackground,
    position: 'relative',
  };

  /** 如果有背景图，叠加在渐变之上 */
  if (backgroundImage?.url) {
    layoutStyle.backgroundImage = `url("${backgroundImage.url}")`;
    layoutStyle.backgroundSize = backgroundImage.fit === 'repeat' ? 'auto' : backgroundImage.fit;
    layoutStyle.backgroundRepeat = backgroundImage.fit === 'repeat' ? 'repeat' : 'no-repeat';
    layoutStyle.backgroundPosition = backgroundImage.position ?? 'center';
    layoutStyle.backgroundAttachment = 'fixed';
    /** 渐变作为 fallback */
    layoutStyle.backgroundColor = layoutBackground;
  }

  return (
    <Layout style={layoutStyle}>
      {/* 背景遮罩层：当 backgroundOverlay.enabled 时渲染 */}
      {backgroundOverlay?.enabled && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',
            background: resolvedDark ? backgroundOverlay.colorDark : backgroundOverlay.color,
            backdropFilter: backgroundOverlay.blur > 0 ? `blur(${backgroundOverlay.blur}px)` : undefined,
            WebkitBackdropFilter: backgroundOverlay.blur > 0 ? `blur(${backgroundOverlay.blur}px)` : undefined,
          }}
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
          onArchive={handleOpenArchive}
          onSettings={() => setShowSettings(true)}
          onOpenSearch={handleOpenSearch}
        />
      )}

      <Content data-canopy-content style={{ width: '100%', maxWidth: contentMaxWidth > 0 ? contentMaxWidth : undefined, margin: '0 auto', padding: '0 32px 64px', position: 'relative', zIndex: 1 }}>
        {uiVisibility?.heroSearch !== false && (
          <HeroBar
            viewMode={viewMode}
            onViewChange={handleViewChange}
            onOpenSearch={handleOpenSearch}
            sentinelRef={heroSearchRef}
            showViewSwitcher={uiVisibility?.viewSwitcher !== false}
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
            style={{ marginBottom: 16 }}
          />
        )}

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
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <Spin />
                <Text type="secondary">{t('tabs.loading')}</Text>
              </div>
            </div>
          ) : tabCount === 0 ? (
            <Empty
              description={
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ant-color-text)' }}>{t('tabs.empty')}</div>
                  <Text type="secondary" style={{ fontSize: 12.5 }}>
                    {t('tabs.emptyHint')}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12, marginTop: 2 }}>
                    {t('tabs.emptyRecoveryHint')}
                  </Text>
                </div>
              }
              style={{ padding: '80px 0' }}
            >
              <Space wrap style={{ marginTop: 4 }}>
                <Button type="primary" icon={<Save size={14} />} onClick={handleOpenArchive}>
                  {t('dashboard.openArchives')}
                </Button>
                <Button icon={<Settings size={14} />} onClick={() => setShowSettings(true)}>
                  {t('header.settings')}
                </Button>
              </Space>
            </Empty>
          ) : (() => {
            const ViewComponent = getViewComponentMap()[viewMode];
            return ViewComponent !== undefined
              ? (
                  <Suspense fallback={<div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>}>
                    <ViewComponent />
                  </Suspense>
                )
              : <DomainGroupView />;
          })()}
        </section>
      </Content>

      <UndoToast />

      <BatchActionBar />

      <Suspense fallback={null}>
        <SearchBox open={showSearch} onOpenChange={setShowSearch} />
        <ArchivePanel open={showArchive} onOpenChange={handleArchivePanelOpenChange} onSessionsChange={syncArchiveSummary} />
        <SettingsPanel open={showSettings} onOpenChange={setShowSettings} />
      </Suspense>
    </Layout>
  );
}

function App() {
  return (
    <I18nProvider>
      <AntdThemeProvider>
        <ErrorBoundary label="AppContent">
          <AppContent />
        </ErrorBoundary>
      </AntdThemeProvider>
    </I18nProvider>
  );
}

export default App;
