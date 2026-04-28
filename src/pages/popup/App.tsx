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

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Button, Input, Tooltip, Typography, Empty, theme } from 'antd';
import { AntdThemeProvider } from '@/shared/ui/AntdThemeProvider';
import { LayoutGrid, Save, Search, ExternalLink, X } from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { archiveCurrentWindowTabs } from '@/services';
import { BRAND } from '@/shared/config/brand';
import { buildSearchUrl } from '@/shared/config/search-engines';
import type { SearchEngineId } from '@/shared/types';
import { getSettings } from '@/repositories';
import { activateTab, closeTab, createTab, getFaviconUrl, queryAllTabs } from '@/chrome';
import { I18nProvider, useT } from '@/shared/i18n';

const { Text } = Typography;

const POPUP_WIDTH = 380;
const POPUP_HEIGHT = 600;

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
    return '';
  }
}

/** 打开一个 Tab：激活该 Tab 并聚焦其窗口 */
async function focusTab(tab: RecentTab): Promise<void> {
  try {
    await activateTab(tab.id, tab.windowId);
  } catch {
    // 若目标 Tab 不存在（已关闭），兜底：新开该 URL
    try {
      await createTab({ url: tab.url, active: true });
    } catch {
      // ignore
    }
  }
}

function PopupContent() {
  const [query, setQuery] = useState('');
  const [recentTabs, setRecentTabs] = useState<RecentTab[]>([]);
  const [hasAnyTab, setHasAnyTab] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  /** 从用户设置读默认搜索引擎；暂以 Google 兑底 */
  const [defaultEngine, setDefaultEngine] = useState<SearchEngineId>('google');
  const { t } = useT();
  const { token } = theme.useToken();

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
          .filter((tab) => tab.id !== undefined && tab.url !== undefined && tab.url !== '')
          .map((tab) => {
            const url = tab.url ?? '';
            const extensionFavicon = getFaviconUrl(url);
            return {
              id: tab.id!,
              windowId: tab.windowId,
              title: tab.title ?? url,
              url,
              favIconUrl: extensionFavicon !== '' ? extensionFavicon : (tab.favIconUrl ?? ''),
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
    if (q === '') return recentTabs;
    return recentTabs.filter((tab) =>
      tab.title.toLowerCase().includes(q) ||
      tab.url.toLowerCase().includes(q) ||
      tab.hostname.toLowerCase().includes(q),
    );
  }, [recentTabs, query]);
  const isSearching = query.trim() !== '';
  const tabCountLabel = isSearching
    ? t('popup.matchingTabs', { matched: filteredTabs.length, total: recentTabs.length })
    : t('popup.allTabs', { count: recentTabs.length });

  const openNewTab = useCallback(() => {
    void createTab({ url: chrome.runtime.getURL('src/pages/newtab/index.html') });
    window.close();
  }, []);

  const archiveAll = useCallback(async () => {
    if (archiving) return;
    setArchiving(true);
    setArchiveError('');
    try {
      await archiveCurrentWindowTabs();
      window.close();
    } catch (err) {
      console.warn(`${BRAND.logTag}/popup archive failed`, err);
      setArchiveError(t('popup.archiveFailed'));
    } finally {
      setArchiving(false);
    }
  }, [archiving, t]);

  /** 快速走全网搜索（回车时触发）—— 使用用户默认引擎 */
  const runWebSearch = useCallback(() => {
    const q = query.trim();
    if (q === '') return;
    void createTab({ url: buildSearchUrl(defaultEngine, q), active: true });
    window.close();
  }, [query, defaultEngine]);

  return (
    <div
      style={{
        width: POPUP_WIDTH,
        height: POPUP_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        padding: token.paddingSM,
        boxSizing: 'border-box',
        fontFamily: token.fontFamily,
        fontSize: token.fontSizeSM,
        color: token.colorText,
        background: token.colorBgLayout,
      }}
    >
      {/* 顶部品牌 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: token.borderRadius,
            background: 'var(--app-logo-gradient)',
            color: '#fff',
            fontWeight: 800,
            fontSize: 12,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {BRAND.shortName}
        </div>
        <Text strong style={{ fontSize: 14, color: token.colorText }}>
          {BRAND.name}
        </Text>
      </div>

      {/* 顶部搜索框 */}
      <Input
        autoFocus
        size="middle"
        allowClear
        placeholder={t('popup.searchPlaceholder')}
        prefix={<Search size={ICON_SIZE.MEDIUM} style={{ color: token.colorTextTertiary }} />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onPressEnter={runWebSearch}
        style={{ borderRadius: token.borderRadiusLG, marginBottom: token.marginXS * 2, background: token.colorBgContainer }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 6,
          padding: '0 2px',
        }}
      >
        <Text type="secondary" style={{ fontSize: 11.5 }}>{tabCountLabel}</Text>
        {filteredTabs.length > 0 && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            {t('popup.scrollHint')}
          </Text>
        )}
      </div>

      {/* 中部：全部 Tab 列表 */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          scrollbarGutter: 'stable',
          marginBottom: token.marginSM,
          borderRadius: token.borderRadiusLG,
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorderSecondary}`,
          padding: 4,
        }}
      >
        {filteredTabs.length === 0 ? (
          <div style={{ padding: '20px 12px', textAlign: 'center' }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<Text type="secondary" style={{ fontSize: 12 }}>{t('popup.noRecentTabs')}</Text>}
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

      {/* 底部：两个操作按钮 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Tooltip title={!hasAnyTab ? t('popup.noTabsToArchive') : ''} mouseEnterDelay={0.3}>
          <Button
            type="primary"
            icon={<Save size={ICON_SIZE.MEDIUM} />}
            block
            loading={archiving}
            disabled={!hasAnyTab || archiving}
            onClick={() => { void archiveAll(); }}
          >
            {t('popup.archiveWindow')}
          </Button>
        </Tooltip>
        <Button
          icon={<LayoutGrid size={ICON_SIZE.MEDIUM} />}
          block
          onClick={openNewTab}
        >
          {t('popup.openWorkspace')}
          <ExternalLink size={ICON_SIZE.MICRO} style={{ marginLeft: 4, opacity: 0.6 }} />
        </Button>
      </div>

      {/* 底部"关于"链接：跳转 newtab 并自动切到 About Tab */}
      <div style={{ marginTop: 10, textAlign: 'center' }}>
        <button
          type="button"
          onClick={() => {
            void createTab({
              url: chrome.runtime.getURL('src/pages/newtab/index.html') + '#about',
            });
            window.close();
          }}
          style={{
            all: 'unset',
            cursor: 'pointer',
            fontSize: 11,
            color: token.colorTextTertiary,
            padding: '4px 8px',
          }}
        >
          {t('popup.aboutGroveTab', { brand: BRAND.name })}
        </button>
      </div>

      {archiveError !== '' && (
        <div style={{ marginTop: 6, fontSize: 11.5, color: token.colorError }}>
          {archiveError}
        </div>
      )}
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
  const { token } = theme.useToken();
  const [hover, setHover] = useState(false);
  return (
    <div
      className="app-row-hover"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={
        {
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 8px',
          borderRadius: token.borderRadius,
          transition: 'background-color var(--app-motion-duration-fast, 0.12s) ease',
          ['--app-row-hover-bg' as string]: token.colorFillSecondary,
        } as CSSProperties
      }
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={t('popup.openTab', { title: tab.title })}
        style={{
          all: 'unset',
          cursor: 'pointer',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minWidth: 0,
        }}
      >
        <img
          src={tab.favIconUrl}
          alt=""
          width={14}
          height={14}
          referrerPolicy="no-referrer"
          style={{ borderRadius: 3, flexShrink: 0 }}
          onError={(e) => {
            e.currentTarget.style.visibility = 'hidden';
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontSize: 12.5,
              color: token.colorText,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.title}
          </span>
          <span
            style={{
              fontSize: 11,
              color: token.colorTextTertiary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.hostname}
          </span>
        </div>
      </button>
      {hover && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label={t('popup.closeTab', { title: tab.title })}
          style={{
            all: 'unset',
            cursor: 'pointer',
            width: 18,
            height: 18,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: token.borderRadiusSM,
            color: token.colorError,
          }}
        >
          <X size={ICON_SIZE.SMALL} />
        </button>
      )}
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
