/**
 * SearchBox — 全局搜索浮层（antd 版，Raycast / Spotlight 风）
 *
 * 实现要点：
 *   - 使用 antd Modal 的 centered=false + 自定义 top，实现顶部浮层
 *   - 内部结构：Input（大号圆角搜索框）+ 结果 List + 底部状态栏
 *   - 按键导航保持不变（↑/↓ 选中、Enter 跳转、Esc 清空 → 再 Esc 关闭）
 */

import { useState, useMemo, useRef, useCallback } from 'react';
import { Modal, Input, theme, Empty } from 'antd';
import type { InputRef } from 'antd';
import {
  SearchOutlined,
  EnterOutlined,
} from '@ant-design/icons';
import MiniSearch from 'minisearch';
import type { LiveTab } from '@/shared/types';
import { useTabsStore } from '@/store';
import { useT } from '@/shared/i18n';
import { pinyinMatch } from '@/shared/utils/pinyin';

interface SearchBoxProps {
  /** 受控：是否打开 */
  open: boolean;
  /** 受控：开关切换回调 */
  onOpenChange: (open: boolean) => void;
}

/**
 * 构建 MiniSearch 索引
 */
function buildSearchIndex(tabs: LiveTab[]) {
  const ms = new MiniSearch({
    /** 搜索范围：标题 + 域名 + URL。URL 字段权重较低，避免域名噪音盖过标题匹配 */
    fields: ['title', 'hostname', 'url'],
    storeFields: ['id'],
    searchOptions: { fuzzy: 0.2, prefix: true },
  });
  if (tabs.length > 0) {
    ms.addAll(tabs.map((t) => ({ id: t.id, title: t.title, hostname: t.hostname, url: t.url })));
  }
  return ms;
}

/**
 * 小键盘提示胶囊
 */
function Kbd({ children }: { children: React.ReactNode }) {
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

  const searchIndex = useMemo(() => buildSearchIndex(tabs), [tabs]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    try {
      const miniResults = searchIndex.search(query);
      if (miniResults.length > 0) {
        const byId = new Map(tabs.map((tb) => [tb.id, tb]));
        return miniResults
          .map((r) => byId.get(r.id as number))
          .filter((x): x is LiveTab => !!x);
      }
    } catch {
      /* fallback */
    }
    return tabs.filter(
      (tab) => pinyinMatch(tab.title, query) || pinyinMatch(tab.hostname, query) || tab.url.toLowerCase().includes(query.toLowerCase()),
    );
  }, [query, searchIndex, tabs]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  /**
   * 由 Modal 的 afterOpenChange 驱动「打开时重置状态 + 聚焦」，
   * 这是一次真实的 UI 事件回调，避免在 useEffect 里同步 setState 触发 React 19
   * 的级联渲染告警，并且保证焦点发生在 Modal 真正挂载完成之后，体验更稳。
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
      jumpToTab(tab.id, tab.windowId);
      close();
    },
    [jumpToTab, close]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (query) {
          e.preventDefault();
          e.stopPropagation();
          setQuery('');
          setActiveIndex(0);
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
    [query, results, activeIndex, handleJump]
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
            {results.map((tab, idx) => {
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
