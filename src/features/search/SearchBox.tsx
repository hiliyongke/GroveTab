/**
 * SearchBox — 全局搜索浮层（antd 版，Raycast / Spotlight 风）
 *
 * 实现要点：
 *   - 使用 antd Modal 的 centered=false + 自定义 top，实现顶部浮层
 *   - 内部结构：Input（大号圆角搜索框）+ 结果 List + 底部状态栏
 *   - 按键导航保持不变（↑/↓ 选中、Enter 跳转、Esc 清空 → 再 Esc 关闭）
 *   - 搜索范围、拼音开关、排序方式均从 UserSettings 读取
 *   - MiniSearch 和拼音模块懒加载，避免首屏 bundle 体积过大
 */

import { useState, useMemo, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { Modal, Input, theme, Empty } from 'antd';
import type { InputRef } from 'antd';
import {
  SearchOutlined,
  EnterOutlined,
} from '@ant-design/icons';
import type { LiveTab } from '@/shared/types';
import { useTabsStore, useSettingsStore } from '@/store';
import { useT } from '@/shared/i18n';

/** 搜索范围字段的默认值 */
const DEFAULT_SEARCH_SCOPE = ['title', 'hostname', 'url'] as const;

interface SearchBoxProps {
  /** 受控：是否打开 */
  open: boolean;
  /** 受控：开关切换回调 */
  onOpenChange: (open: boolean) => void;
}

type PinyinMatchFn = (text: string, query: string) => boolean;

/**
 * 小键盘提示胶囊
 */
function Kbd({ children }: { children: ReactNode }) {
  const { token } = theme.useToken();
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        fontSize: 10.5,
        fontFamily: 'var(--font-family-mono, monospace)',
        color: token.colorTextSecondary,
        background: token.colorFillTertiary,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 4,
        lineHeight: 1,
      }}
    >
      {children}
    </span>
  );
}

/**
 * 全局搜索浮层
 */
export function SearchBox({ open, onOpenChange }: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<InputRef>(null);
  const tabs = useTabsStore((s) => s.tabs);
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const { t } = useT();
  const { token } = theme.useToken();

  /**
   * 读取搜索配置。
   *
   * 注意：selector 里不能用 `?? []` 这类会创建新引用的兜底值；
   * 在 React 19 + Zustand 的 useSyncExternalStore 机制下，这会让 React 误判 snapshot
   * 每次都变了，从而触发无限重渲染（React error #185）。
   */
  const rawSearchScope = useSettingsStore((s) => s.settings.searchScope);
  const searchScope = rawSearchScope ?? DEFAULT_SEARCH_SCOPE;
  const enablePinyin = useSettingsStore((s) => s.settings.searchEnablePinyin ?? true);
  const searchSortBy = useSettingsStore((s) => s.settings.searchSortBy ?? 'relevance');

  /**
   * MiniSearch 索引（异步构建）
   */
  const [searchIndex, setSearchIndex] = useState<any>(null);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { default: MS } = await import('minisearch');
      if (cancelled) return;
      const fields: string[] =
        (searchScope as string[]).length > 0
          ? [...searchScope as string[]]
          : ['title'];
      const ms = new MS({
        fields,
        storeFields: ['id'],
        searchOptions: { fuzzy: 0.2, prefix: true },
      });
      if (tabs.length > 0) {
        ms.addAll(
          tabs.map((t: LiveTab) => ({
            id: t.id,
            title: t.title,
            hostname: t.hostname,
            url: t.url,
          })),
        );
      }
      if (!cancelled) setSearchIndex(ms);
    })();
    return () => { cancelled = true; };
  }, [open, tabs, searchScope]);

  /**
   * 拼音匹配函数（异步预加载）
   */
  const [pinyinMatchFn, setPinyinMatchFn] = useState<PinyinMatchFn | null>(null);
  useEffect(() => {
    if (!enablePinyin) { setPinyinMatchFn(null); return; }
    (async () => {
      const { pinyinMatch } = await import('@/shared/utils/pinyin');
      setPinyinMatchFn(() => pinyinMatch);
    })();
  }, [enablePinyin]);

  /**
   * 搜索结果 memo
   */
  const results = useMemo(() => {
    if (!query.trim()) return [] as LiveTab[];

    const scopeSet = new Set(searchScope as string[]);
    const matchTitle = scopeSet.has('title');
    const matchHostname = scopeSet.has('hostname');
    const matchUrl = scopeSet.has('url');

    try {
      const miniResults: Array<{ id: number }> = searchIndex?.search(query) ?? [];
      if (miniResults.length > 0) {
        const byId = new Map(tabs.map((tb: LiveTab) => [tb.id, tb] as [number, LiveTab]));
        let matched: LiveTab[] = miniResults
          .map((r: { id: number }) => byId.get(r.id))
          .filter((x: LiveTab | undefined): x is LiveTab => !!x);

        /** 拼音补充搜索 */
        if (enablePinyin && pinyinMatchFn) {
          const existingIds = new Set(matched.map((t: LiveTab) => t.id));
          const pinyinExtras = tabs.filter((tab: LiveTab) => {
            if (existingIds.has(tab.id)) return false;
            const mt = matchTitle && pinyinMatchFn(tab.title, query);
            const mh = matchHostname && pinyinMatchFn(tab.hostname, query);
            return mt || mh;
          });
          matched = [...matched, ...pinyinExtras];
        }

        /** 排序：按配置决定 */
        if (searchSortBy === 'recentAccess') {
          matched.sort((a: LiveTab, b: LiveTab) =>
            (b.lastAccessed || 0) - (a.lastAccessed || 0),
          );
        }

        return matched;
      }
    } catch {
      /* MiniSearch 解析异常 */
    }

    /** MiniSearch 未命中时，用拼音 + 字符串匹配兜底 */
    let fallback = tabs.filter((tab: LiveTab) => {
      if (matchTitle) {
        let matchedByPinyin = false;
        if (enablePinyin && pinyinMatchFn) {
          if (pinyinMatchFn(tab.title, query)) matchedByPinyin = true;
        }
        if (matchedByPinyin) return true;
        if (tab.title.toLowerCase().includes(query.toLowerCase())) return true;
      }
      if (matchHostname && tab.hostname.toLowerCase().includes(query.toLowerCase())) return true;
      if (matchUrl && tab.url.toLowerCase().includes(query.toLowerCase())) return true;
      return false;
    });

    if (searchSortBy === 'recentAccess') {
      fallback.sort((a: LiveTab, b: LiveTab) =>
        (b.lastAccessed || 0) - (a.lastAccessed || 0),
      );
    }

    return fallback;
  }, [query, searchIndex, pinyinMatchFn, tabs, searchScope, enablePinyin, searchSortBy]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  /**
   * Modal 打开时重置状态 + 聚焦
   */
  const handleAfterOpenChange = useCallback((visible: boolean) => {
    if (visible) {
      setQuery('');
      setActiveIndex(0);
      inputRef.current?.focus();
    }
  }, []);

  const handleJump = useCallback(
    (tab: LiveTab) => {
      void jumpToTab(tab.id, tab.windowId);
      close();
    },
    [jumpToTab, close],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (query) {
          e.preventDefault();
          e.stopPropagation();
          setQuery('');
          setActiveIndex(0);
          return;
        }
        // 没有 query 时交给 Modal 默认关闭行为
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const tab = results[activeIndex];
        if (tab) handleJump(tab);
        return;
      }
    },
    [query, results, activeIndex, handleJump],
  );

  return (
    <Modal
      open={open}
      onCancel={close}
      afterOpenChange={handleAfterOpenChange}
      footer={null}
      closable={false}
      destroyOnHidden
      maskClosable
      width={640}
      centered={false}
      styles={{
        mask: { backdropFilter: 'blur(8px)' },
        body: { padding: 0 },
      }}
      style={{ top: '15vh' }}
    >
      {/* 搜索输入行 */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Input
          ref={inputRef}
          size="large"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder={t('search.placeholder')}
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          allowClear
          variant="borderless"
          style={{ fontSize: 15 }}
        />
      </div>

      {/* 结果列表 */}
      <div style={{ maxHeight: '50vh', overflowY: 'auto', padding: '4px 0' }}>
        {results.length === 0 ? (
          <div style={{ padding: '32px 24px' }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span style={{ fontSize: 13, color: token.colorTextSecondary }}>
                  {query ? t('search.noResults') : t('search.hint')}
                </span>
              }
            />
            {query && (
              <div
                style={{
                  marginTop: 8,
                  textAlign: 'center',
                  fontSize: 12,
                  color: token.colorTextTertiary,
                }}
              >
                {t('search.tryOther')}
              </div>
            )}
          </div>
        ) : (
          <ul
            role="listbox"
            style={{
              listStyle: 'none',
              margin: 0,
              padding: '4px 0',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {results.map((tab: LiveTab, idx: number) => {
              const active = idx === activeIndex;
              return (
                <li
                  key={tab.id}
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => handleJump(tab)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    margin: '0 6px',
                    padding: '10px 12px',
                    borderRadius: token.borderRadius,
                    cursor: 'pointer',
                    background: active ? token.colorFillSecondary : 'transparent',
                    transition: `background ${token.motionDurationFast}`,
                  }}
                >
                  {tab.favIconUrl ? (
                    <img
                      src={tab.favIconUrl}
                      alt=""
                      style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0 }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        background: token.colorFillSecondary,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 500,
                        color: token.colorText,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: 1.3,
                      }}
                    >
                      {tab.title}
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: token.colorTextTertiary,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginTop: 2,
                        lineHeight: 1.3,
                      }}
                    >
                      {tab.hostname}
                    </div>
                  </div>
                  {active && (
                    <EnterOutlined
                      style={{ fontSize: 12, color: token.colorTextTertiary, flexShrink: 0 }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 底部状态栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          height: 40,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorFillQuaternary,
          fontSize: 11.5,
          color: token.colorTextTertiary,
        }}
      >
        <span>{results.length > 0 ? t('search.results', { count: results.length }) : ' '}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            <span>{t('search.navigate')}</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Kbd>↵</Kbd>
            <span>{t('search.open')}</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Kbd>esc</Kbd>
            <span>{t('search.close')}</span>
          </span>
        </div>
      </div>
    </Modal>
  );
}
