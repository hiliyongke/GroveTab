/**
 * DailyQuote —— GroveTab 每日金句 Widget
 *
 * 布局：
 *   独立一行，在 HeroWidgets 三联之下，HeroBar 之上。
 *   结构：
 *     ┌─────────────────────────────────────────────────────────┐
 *     │  "金句文本……"                          ♥  ⧉  ↻          │
 *     │   —— 作者·出处                                            │
 *     └─────────────────────────────────────────────────────────┘
 *
 * 交互：
 *   - ♥  ：收藏 / 取消收藏（已收藏高亮填充）
 *   - ⧉  ：复制到剪贴板（带轻量 Toast）
 *   - ↻  ：切换下一条（按当前分类集合内顺序 step）
 *
 * 渲染策略：
 *   - 使用 React.lazy 隔离 chunk（约 15KB gz 的 200+ 条金句数据仅按需加载）
 *   - 默认开启：settings.dailyQuote.enabled 默认 true
 *   - 设置允许：分类多选、字号、是否显示作者
 */

import { useCallback, useEffect, useState } from 'react';
import { App, Tooltip, theme } from 'antd';
import { Heart, Copy, RefreshCw } from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useT } from '@/shared/i18n';
import { useSettingsStore } from '@/store';
import { getTodayQuote, toggleFavorite, isFavorite } from './quote-service';
import type { Quote, QuoteCategory } from './quotes-data';

/** 默认分类（用户未配置时）——四类全开。 */
const DEFAULT_CATEGORIES: QuoteCategory[] = ['aphorism', 'renmin', 'poetry', 'essay'];

export function DailyQuote() {
  const { token } = theme.useToken();
  const { t } = useT();
  const { message } = App.useApp();

  const conf = useSettingsStore((s) => s.settings.dailyQuote);
  const enabled = conf?.enabled !== false; // 默认开
  const categories = conf?.categories ?? DEFAULT_CATEGORIES;
  const fontSize = conf?.fontSize ?? 15;
  const showSource = conf?.showSource !== false;

  /** offset：0 = 今日金句；>0 = 手动切换过几次。 */
  const [offset, setOffset] = useState(0);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [fav, setFav] = useState(false);

  /** 依赖变化时重算当前金句 + 是否已收藏。 */
  useEffect(() => {
    const q = getTodayQuote(categories, offset);
    setQuote(q);
    let cancelled = false;
    void isFavorite(q.id).then((v) => {
      if (!cancelled) setFav(v);
    });
    return () => {
      cancelled = true;
    };
  }, [categories, offset]);

  const handleNext = useCallback(() => {
    setOffset((v) => v + 1);
  }, []);

  const handleCopy = useCallback(async () => {
    if (quote === null) return;
    const text = showSource ? `${quote.text} —— ${quote.source}` : quote.text;
    try {
      await navigator.clipboard.writeText(text);
      message.success(t('quote.copied'));
    } catch {
      message.warning(t('quote.copyFailed'));
    }
  }, [quote, showSource, message, t]);

  const handleFav = useCallback(async () => {
    if (quote === null) return;
    const next = await toggleFavorite(quote.id);
    setFav(next);
    message.success(next ? t('quote.favAdded') : t('quote.favRemoved'));
  }, [quote, message, t]);

  if (!enabled || quote === null) return null;

  const iconBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 26,
    height: 26,
    padding: 0,
    border: 'none',
    background: 'transparent',
    borderRadius: token.borderRadiusSM,
    color: token.colorTextTertiary,
    cursor: 'pointer',
    transition: 'color 180ms ease, background 180ms ease',
  };

  return (
    <div
      /*
       * 容器样式要点：
       *   - 最大宽度 720 居中；避免在超宽屏幕上文本行太长影响阅读。
       *   - 卡片轻量背景（fillQuaternary）+ 圆角；不使用强边框，保持克制。
       *   - group hover 时才升起操作按钮，避免图标抢视觉。
       */
      className="grovetab-daily-quote"
      style={{
        maxWidth: 720,
        margin: '0 auto 8px',
        padding: '10px 16px',
        borderRadius: token.borderRadiusLG,
        background: token.colorFillQuaternary,
        border: `1px solid ${token.colorBorderSecondary}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
      aria-label={t('quote.aria')}
    >
      {/* 左侧开引号：品牌色点缀 */}
      <span
        aria-hidden="true"
        style={{
          fontSize: 22,
          lineHeight: 1,
          color: token.colorPrimary,
          fontFamily: 'Georgia, "Songti SC", serif',
          flexShrink: 0,
          marginTop: -4,
        }}
      >
        “
      </span>

      {/* 中间文本区 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize,
            lineHeight: 1.55,
            color: token.colorText,
            fontWeight: 500,
            /* 单行裁切（弱化视觉抖动）：2 行内保持 flex 布局稳定 */
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {quote.text}
        </div>
        {showSource && (
          <div
            style={{
              fontSize: 11,
              color: token.colorTextTertiary,
              marginTop: 2,
              letterSpacing: '0.02em',
            }}
          >
            —— {quote.source}
          </div>
        )}
      </div>

      {/* 右侧操作按钮组 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        <Tooltip title={fav ? t('quote.unfavorite') : t('quote.favorite')}>
          <button
            type="button"
            style={{
              ...iconBtnStyle,
              color: fav ? token.colorError : token.colorTextTertiary,
            }}
            onClick={() => { void handleFav(); }}
            aria-label={fav ? t('quote.unfavorite') : t('quote.favorite')}
          >
<Heart size={ICON_SIZE.MEDIUM} fill={fav ? 'currentColor' : 'none'} />
          </button>
        </Tooltip>
        <Tooltip title={t('quote.copy')}>
          <button
            type="button"
            style={iconBtnStyle}
            onClick={() => { void handleCopy(); }}
            aria-label={t('quote.copy')}
          >
<Copy size={ICON_SIZE.MEDIUM} />
          </button>
        </Tooltip>
        <Tooltip title={t('quote.next')}>
          <button
            type="button"
            style={iconBtnStyle}
            onClick={handleNext}
            aria-label={t('quote.next')}
          >
<RefreshCw size={ICON_SIZE.MEDIUM} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
