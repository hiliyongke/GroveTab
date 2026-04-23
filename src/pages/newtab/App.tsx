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
  Segmented,
  Space,
  Typography,
  Tag,
  Button,
  Tooltip,
  Empty,
  Spin,
  Alert,
} from 'antd';
import {
  SearchOutlined,
  SettingOutlined,
  SaveOutlined,
  SunOutlined,
  MoonFilled,
  DesktopOutlined,
} from '@ant-design/icons';
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

/** 懒加载非默认视图——直接导入文件而非 barrel，确保每个视图独立拆 chunk */
const TimelineView = lazy(() => import('@/features/tabs/TimelineView').then((m) => ({ default: m.TimelineView })));
const CompactView = lazy(() => import('@/features/tabs/CompactView').then((m) => ({ default: m.CompactView })));
const GridView = lazy(() => import('@/features/tabs/GridView').then((m) => ({ default: m.GridView })));
const FrequencyView = lazy(() => import('@/features/tabs/FrequencyView').then((m) => ({ default: m.FrequencyView })));
const TabGroupView = lazy(() => import('@/features/tabs/TabGroupView').then((m) => ({ default: m.TabGroupView })));
const WindowView = lazy(() => import('@/features/tabs/WindowView').then((m) => ({ default: m.WindowView })));
const BookmarkView = lazy(() => import('@/features/tabs/BookmarkView').then((m) => ({ default: m.BookmarkView })));
import { OnboardingCard } from '@/features/sessions/OnboardingCard';

/** 懒加载抽屉/面板——非首屏必需，直接导入文件确保独立拆 chunk */
const SearchBox = lazy(() => import('@/features/search/SearchBox').then((m) => ({ default: m.SearchBox })));
const ArchivePanel = lazy(() => import('@/features/sessions/ArchivePanel').then((m) => ({ default: m.ArchivePanel })));
const SettingsPanel = lazy(() => import('@/features/settings/SettingsPanel').then((m) => ({ default: m.SettingsPanel })));
import { hasCompletedOnboarding } from '@/repositories';
import { recordMetric } from '@/shared/utils/metrics';
import { initArchiveStorage } from '@/services/archive-service';
import { resolveGradient } from '@/shared/theme/gradient-presets';
import { VIEW_CONFIGS, VALID_VIEWS, type ViewMode } from '@/shared/config/views';
import { registerViews, getViewComponentMap } from '@/shared/config/view-registry';

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
 * 顶栏：品牌 + 次级操作（归档 / 明暗切换 / 设置）
 *
 * 滚动吸附搜索：
 *   - 上层通过 `compactSearchVisible` 告知「Hero 搜索框已滚出视野」
 *   - Header 中部会渐显一个 compact 搜索触发器（点击同样打开命令面板）
 *   - 使用 opacity + translateY + max-width 动画，避免出现/消失时导致 Header 其他元素跳动
 */
function AppHeader({
  tabCount,
  domainCount,
  compactSearchVisible,
  onArchive,
  onSettings,
  onOpenSearch,
}: {
  tabCount: number;
  domainCount: number;
  compactSearchVisible: boolean;
  onArchive: () => void;
  onSettings: () => void;
  onOpenSearch: () => void;
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
   *   - dark   → 月亮（实心）🌙
   *   - system → 显示器（跟随系统的视觉隐喻）🖥
   *
   * 原来的实现是 `BulbOutlined / BulbFilled`——两个图标都是灯泡，
   * 小尺寸按钮里肉眼几乎区分不出，用户感知「点了没反应」。
   */
  const themeIcon =
    theme === 'system' ? (
      <DesktopOutlined key="sys" />
    ) : theme === 'dark' ? (
      <MoonFilled key="dark" />
    ) : (
      <SunOutlined key="light" />
    );

  return (
    <Header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        height: 56,
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        background: 'var(--ant-color-bg-container)',
        borderBottom: '1px solid var(--ant-color-border-secondary)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <Space size={10} style={{ flexShrink: 0 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #1677ff, #69b1ff)',
            color: '#fff',
            fontWeight: 800,
            fontSize: 15,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          C
        </div>
        <Text strong style={{ fontSize: 15 }}>
          Canopy
        </Text>
        {/* 吸顶搜索显示时，计数 Tag 淡出让位，避免挤占中部空间 */}
        <Tag
          style={{
            fontSize: 11,
            marginInlineStart: 6,
            opacity: compactSearchVisible ? 0 : 1,
            transform: compactSearchVisible ? 'translateX(-4px)' : 'translateX(0)',
            transition: 'opacity 220ms ease, transform 220ms ease',
            pointerEvents: compactSearchVisible ? 'none' : 'auto',
          }}
        >
          {t('header.tabCount', { count: tabCount })} · {domainCount}{' '}
          {t('view.domain').toLowerCase()}
        </Tag>
      </Space>

      {/*
        中部吸附搜索触发器
        ---------------------------------
        · flex:1 占满中间空间，保持左右 Space 不挤压
        · max-width + opacity + transform 共同做 "渐入-滑下" 动画
        · 未激活时 max-width=0 且 pointerEvents=none，彻底不占点击位
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
          style={{
            all: 'unset',
            boxSizing: 'border-box',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            maxWidth: compactSearchVisible ? 420 : 0,
            height: 34,
            padding: compactSearchVisible ? '0 12px' : '0',
            borderRadius: 999,
            background: 'var(--ant-color-fill-tertiary)',
            border: '1px solid var(--ant-color-border-secondary)',
            color: 'var(--ant-color-text-tertiary)',
            fontSize: 13,
            opacity: compactSearchVisible ? 1 : 0,
            transform: compactSearchVisible ? 'translateY(0)' : 'translateY(-6px)',
            transition:
              'opacity 260ms ease, transform 260ms ease, max-width 300ms ease, padding 260ms ease, background 160ms ease',
            pointerEvents: compactSearchVisible ? 'auto' : 'none',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--ant-color-fill-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--ant-color-fill-tertiary)';
          }}
        >
          <SearchOutlined style={{ fontSize: 13, flexShrink: 0 }} />
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
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1px 6px',
              fontFamily: 'monospace',
              fontSize: 11,
              color: 'var(--ant-color-text-secondary)',
              background: 'var(--ant-color-bg-container)',
              border: '1px solid var(--ant-color-border-secondary)',
              borderRadius: 4,
              flexShrink: 0,
            }}
          >
            ⌘K
          </span>
        </button>
      </div>

      <Space size={4} style={{ flexShrink: 0 }}>
        <Tooltip title={t('header.archiveTooltip')} placement="bottom">
          <Button type="text" icon={<SaveOutlined />} onClick={onArchive}>
            {/* 按钮保留一个文字标签，避免用户光看 icon 猜不出功能 */}
            <span style={{ fontSize: 12, marginInlineStart: 4 }}>{t('header.archive')}</span>
          </Button>
        </Tooltip>
        <Tooltip title={t(`theme.${theme}`)}>
          <Button
            type="text"
            // key 跟随 theme 变化 → Button 内部 icon 节点被 React 替换，
            // 搭配下方 keyframes 动画，产生一个「翻转 + 渐入」的可感知切换反馈
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
          <Button type="text" icon={<SettingOutlined />} onClick={onSettings} />
        </Tooltip>
      </Space>
    </Header>
  );
}

/**
 * Hero 区：大号搜索触发器 + 视图切换 Segmented
 *
 * `sentinelRef` 挂在搜索框外层——上层通过 IntersectionObserver 观察该节点，
 * 当它完全滚出顶部视野时，Header 里的 compact 搜索框渐显吸顶。
 */
function HeroBar({
  viewMode,
  onViewChange,
  onOpenSearch,
  sentinelRef,
}: {
  viewMode: ViewMode;
  onViewChange: (v: ViewMode) => void;
  onOpenSearch: () => void;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { t } = useT();

  return (
    <section
      style={{
        padding: '28px 0 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* 第一行：搜索框 */}
      <div ref={sentinelRef}>
        <Input
          size="large"
          readOnly
          placeholder={t('search.placeholder')}
          prefix={<SearchOutlined style={{ color: 'var(--ant-color-text-tertiary)' }} />}
          suffix={
            <Tag style={{ fontFamily: 'monospace', margin: 0 }}>
              ⌘K
            </Tag>
          }
          onFocus={(e) => {
            e.currentTarget.blur();
            onOpenSearch();
          }}
          onClick={onOpenSearch}
          style={{ borderRadius: 999, cursor: 'pointer' }}
        />
      </div>

      {/* 第二行：视图切换 Segmented（预览图模式可通过设置面板切换） */}
      <Segmented<ViewMode>
        size="large"
        value={viewMode}
        onChange={onViewChange}
        options={VIEW_CONFIGS.map((v) => ({
          value: v.id,
          icon: <v.Icon />,
          label: t(v.labelKey),
        }))}
      />
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

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checked, setChecked] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [initRunId, setInitRunId] = useState(0);
  const [showArchive, setShowArchive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  /** Hero 搜索框是否已滚出视野——用于驱动 Header 吸附搜索渐显 */
  const [compactSearchVisible, setCompactSearchVisible] = useState(false);
  const heroSearchRef = useRef<HTMLDivElement>(null);
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
  const resolvedDark = useResolvedTheme() === 'dark';
  const layoutBackground = resolveGradient(gradientPreset, resolvedDark, customGradient);
  const { t } = useT();

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

    void (async () => {
      try {
        await loadSettings();

        const [archiveStorageResult, tabsResult, undoResult, metadataResult, onboardingResult] = await Promise.allSettled([
          initArchiveStorage(),
          loadAllTabs(),
          loadUndoRecords(),
          loadMetadata(),
          hasCompletedOnboarding(),
        ]);

        if (archiveStorageResult.status === 'rejected') {
          console.warn('[Canopy] initArchiveStorage failed', archiveStorageResult.reason);
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
    };
  }, [initRunId, loadAllTabs, loadMetadata, loadSettings, loadUndoRecords, t]);

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

  const tabCount = tabs.length;
  const domainCount = new Set(tabs.map((tab) => tab.hostname)).size;

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

  return (
    <Layout style={{ minHeight: '100vh', background: layoutBackground }}>
      <AppHeader
        tabCount={tabCount}
        domainCount={domainCount}
        compactSearchVisible={compactSearchVisible}
        onArchive={() => setShowArchive(true)}
        onSettings={() => setShowSettings(true)}
        onOpenSearch={() => setShowSearch(true)}
      />

      <Content style={{ width: '100%', padding: '0 24px 48px' }}>
        <HeroBar
          viewMode={viewMode}
          onViewChange={handleViewChange}
          onOpenSearch={() => setShowSearch(true)}
          sentinelRef={heroSearchRef}
        />

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

        <TidySuggestionBar />

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
                <div>
                  <div style={{ fontWeight: 500 }}>{t('tabs.empty')}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t('tabs.emptyHint')}
                  </Text>
                </div>
              }
              style={{ padding: '80px 0' }}
            />
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
        <ArchivePanel open={showArchive} onOpenChange={setShowArchive} />
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
