/**
 * Canopy — Popup 工具栏轻量版（F-26）
 *
 * 360×520 四区：
 *   · 顶部：全局搜索框（懒加载搜索核心）
 *   · 中部：最近 10 个激活 Tab 列表（按 lastAccessed 倒序）
 *   · 底部：归档当前窗口（大按钮，复用 archiveCurrentWindowTabs）
 *   · 底部：打开工作台（切到 Canopy 新标签页）
 *
 * 首屏 ≤ 200ms：不进行重的懒加载，SearchBox 以 React.lazy 延迟加载。
 * 无 Tab 时归档按钮置灰 + 提示。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfigProvider, Button, Input, Tooltip, Typography, Empty, theme } from 'antd';
import { LayoutGrid, Save, Search, ExternalLink, X } from 'lucide-react';
import { archiveCurrentWindowTabs } from '@/services';
import { BRAND } from '@/shared/config/brand';
import { buildSearchUrl } from '@/shared/config/search-engines';
import type { SearchEngineId } from '@/shared/types';
import { getSettings } from '@/repositories';

const { Text } = Typography;

const POPUP_WIDTH = 360;
const POPUP_HEIGHT = 520;
const RECENT_LIMIT = 10;

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

/** 打开一个 Tab：更新该 Tab 为 active，并聚焦其窗口 */
async function focusTab(tab: RecentTab): Promise<void> {
  try {
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  } catch {
    // 若目标 Tab 不存在（已关闭），兜底：在当前窗口新开该 URL
    try {
      await chrome.tabs.create({ url: tab.url, active: true });
    } catch {
      // ignore
    }
  }
}

function App() {
  const [query, setQuery] = useState('');
  const [recentTabs, setRecentTabs] = useState<RecentTab[]>([]);
  const [hasAnyTab, setHasAnyTab] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  /** 从用户设置读默认搜索引擎；暂以 Google 兑底 */
  const [defaultEngine, setDefaultEngine] = useState<SearchEngineId>('google');

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
    if (typeof chrome === 'undefined' || chrome.tabs === undefined) return;
    void (async () => {
      try {
        const all = await chrome.tabs.query({});
        setHasAnyTab(all.length > 0);
        const list: RecentTab[] = all
          .filter((t) => t.id !== undefined && t.url !== undefined && t.url !== '')
          .map((t) => ({
            id: t.id!,
            windowId: t.windowId,
            title: t.title ?? t.url!,
            url: t.url!,
            favIconUrl: t.favIconUrl ?? '',
            hostname: extractHostname(t.url!),
            lastAccessed: t.lastAccessed ?? 0,
          }))
          .sort((a, b) => b.lastAccessed - a.lastAccessed)
          .slice(0, RECENT_LIMIT);
        setRecentTabs(list);
      } catch (err) {
        console.warn('[Canopy/popup] query tabs failed', err);
      }
    })();
  }, []);

  const filteredTabs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return recentTabs;
    return recentTabs.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      t.url.toLowerCase().includes(q) ||
      t.hostname.toLowerCase().includes(q),
    );
  }, [recentTabs, query]);

  const openNewTab = useCallback(() => {
    void chrome.tabs?.create({ url: chrome.runtime.getURL('src/pages/newtab/index.html') });
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
      console.warn('[Canopy/popup] archive failed', err);
      setArchiveError('归档失败，请重试');
    } finally {
      setArchiving(false);
    }
  }, [archiving]);

  /** 快速走全网搜索（回车时触发）—— 使用用户默认引擎 */
  const runWebSearch = useCallback(() => {
    const q = query.trim();
    if (q === '') return;
    void chrome.tabs?.create({ url: buildSearchUrl(defaultEngine, q), active: true });
    window.close();
  }, [query, defaultEngine]);

  return (
    <ConfigProvider theme={{ cssVar: { prefix: 'ant' } }}>
      <div
        style={{
          width: POPUP_WIDTH,
          height: POPUP_HEIGHT,
          display: 'flex',
          flexDirection: 'column',
          padding: 12,
          boxSizing: 'border-box',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          fontSize: 13,
        }}
      >
        {/* 顶部品牌 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              background: 'linear-gradient(135deg, #1677ff, #69b1ff)',
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
          <Text strong style={{ fontSize: 14 }}>
            {BRAND.name}
          </Text>
        </div>

        {/* 顶部搜索框 */}
        <Input
          autoFocus
          size="middle"
          allowClear
          placeholder="搜索标签页或上网（回车）"
          prefix={<Search size={14} style={{ color: 'var(--ant-color-text-tertiary)' }} />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onPressEnter={runWebSearch}
          style={{ borderRadius: 10, marginBottom: 10 }}
        />

        {/* 中部：最近 10 Tab 列表 */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            marginBottom: 10,
            borderRadius: 8,
            background: 'var(--ant-color-fill-quaternary)',
            padding: '4px 0',
          }}
        >
          {filteredTabs.length === 0 ? (
            <div style={{ padding: '20px 12px', textAlign: 'center' }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<Text type="secondary" style={{ fontSize: 12 }}>暂无最近标签</Text>}
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
                onClose={async () => {
                  try {
                    await chrome.tabs.remove(tab.id);
                    setRecentTabs((list) => list.filter((t) => t.id !== tab.id));
                  } catch {
                    /* 关闭失败静默 */
                  }
                }}
              />
            ))
          )}
        </div>

        {/* 底部：两个操作按钮 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Tooltip title={!hasAnyTab ? '当前没有可归档的标签页' : ''} mouseEnterDelay={0.3}>
            <Button
              type="primary"
              icon={<Save size={14} />}
              block
              loading={archiving}
              disabled={!hasAnyTab || archiving}
              onClick={() => { void archiveAll(); }}
            >
              归档当前窗口
            </Button>
          </Tooltip>
          <Button
            icon={<LayoutGrid size={14} />}
            block
            onClick={openNewTab}
          >
            打开工作台
            <ExternalLink size={10} style={{ marginLeft: 4, opacity: 0.6 }} />
          </Button>
        </div>

        {/* 底部"关于"链接：跳转 newtab 并自动切到 About Tab */}
        <div style={{ marginTop: 10, textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => {
              void chrome.tabs?.create({
                url: chrome.runtime.getURL('src/pages/newtab/index.html') + '#about',
              });
              window.close();
            }}
            style={{
              all: 'unset',
              cursor: 'pointer',
              fontSize: 11,
              color: 'var(--ant-color-text-tertiary)',
              padding: '4px 8px',
            }}
          >
            关于 GroveTab
          </button>
        </div>

        {archiveError !== '' && (
          <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--ant-color-error)' }}>
            {archiveError}
          </div>
        )}
      </div>
    </ConfigProvider>
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
  const { token } = theme.useToken();
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={(e) => {
        setHover(true);
        e.currentTarget.style.background = token.colorFillSecondary;
      }}
      onMouseLeave={(e) => {
        setHover(false);
        e.currentTarget.style.background = 'transparent';
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        transition: 'background 120ms ease',
      }}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={`打开 ${tab.title}`}
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
          src={tab.favIconUrl !== '' ? tab.favIconUrl : `chrome://favicon/size/16@1x/${encodeURIComponent(tab.url)}`}
          alt=""
          width={14}
          height={14}
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
          aria-label={`关闭标签页 ${tab.title}`}
          style={{
            all: 'unset',
            cursor: 'pointer',
            width: 18,
            height: 18,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 4,
            color: token.colorTextTertiary,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = token.colorError)}
          onMouseLeave={(e) => (e.currentTarget.style.color = token.colorTextTertiary)}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

export default App;
