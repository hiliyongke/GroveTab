/**
 * ClockWidget —— HeroWidgets 之一：大号数字时钟
 *
 * 设计：
 *   - 纯本地计算，不依赖网络；使用 Date + setInterval（秒级）
 *   - 12/24 制、秒针显示可配；由 settings.heroWidgets.clock 驱动
 *   - 字体走 tabular-nums，避免每秒宽度跳动
 *   - 布局紧凑：主时间居中，下方一行小字显示日期（周几 + 月/日）
 *   - 使用 token.colorText / colorTextTertiary 自适应深浅色
 *
 * 注意：定时器只在组件挂载期间存在；页面 hidden 时主动暂停，
 * 避免后台标签页每秒 render 导致功耗。
 */

import { useEffect, useState } from 'react';
import { theme } from 'antd';
import { useT } from '@/shared/i18n';
import { useSettingsStore } from '@/store';

/**
 * 补零：把单位数补成两位。
 */
function padZero(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * 返回当前时间格式化后的各字段。
 * 抽出来是为了方便以后扩展 12h/24h 逻辑时共享同一份时间源。
 */
function readNow(format24: boolean): { h: string; m: string; s: string; ampm: string } {
  const now = new Date();
  const rawH = now.getHours();
  const h = format24 ? rawH : ((rawH % 12) === 0 ? 12 : (rawH % 12));
  const ampm = rawH >= 12 ? 'PM' : 'AM';
  return {
    h: padZero(h),
    m: padZero(now.getMinutes()),
    s: padZero(now.getSeconds()),
    ampm,
  };
}

/**
 * 主组件。
 */
export function ClockWidget() {
  const { token } = theme.useToken();
  const { t, locale } = useT();

  const clockConf = useSettingsStore((s) => s.settings.heroWidgets?.clock);
  const enabled = clockConf?.enabled !== false;
  const format24 = clockConf?.format24 !== false;
  const showSeconds = clockConf?.showSeconds === true;

  /** 初始值同步计算，避免首屏闪现空字符串 */
  const [parts, setParts] = useState(() => readNow(format24));

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    /**
     * 根据是否展示秒针决定刷新频率：
     *   - 展示秒 → 每秒刷新
     *   - 不展示秒 → 每 20s 够用（仅分钟级别）
     */
    const intervalMs = showSeconds ? 1_000 : 20_000;

    /** 启动定时器 */
    const start = () => {
      if (timer !== null) return;
      setParts(readNow(format24));
      timer = setInterval(() => {
        setParts(readNow(format24));
      }, intervalMs);
    };

    /** 停止定时器（页面隐藏时节能） */
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    /** visibilitychange 驱动启停 */
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [enabled, format24, showSeconds]);

  if (!enabled) return null;

  /** 日期展示：周几 · M月D日 */
  const now = new Date();
  const dateLine = now.toLocaleDateString(locale === 'zh-CN' ? 'zh-CN' : 'en-US', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        minWidth: 140,
      }}
      aria-label={t('heroWidgets.clock.aria')}
    >
      <div
        style={{
          fontSize: 44,
          fontWeight: 300,
          letterSpacing: '-0.04em',
          color: token.colorText,
          fontFeatureSettings: '"tnum"',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'baseline',
          gap: 2,
        }}
      >
        <span>{parts.h}</span>
        <span style={{ opacity: 0.5 }}>:</span>
        <span>{parts.m}</span>
        {showSeconds && (
          <>
            <span style={{ opacity: 0.4, fontSize: 28 }}>:</span>
            <span style={{ fontSize: 28, opacity: 0.7 }}>{parts.s}</span>
          </>
        )}
        {!format24 && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              marginLeft: 6,
              color: token.colorTextTertiary,
              letterSpacing: '0.08em',
            }}
          >
            {parts.ampm}
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 12,
          color: token.colorTextTertiary,
          letterSpacing: '0.02em',
        }}
      >
        {dateLine}
      </div>
    </div>
  );
}
