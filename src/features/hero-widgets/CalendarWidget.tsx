/**
 * CalendarWidget —— HeroWidgets 之三：小巧日历
 *
 * 展示内容：
 *   - 主显：超大日期数字 + 今日星期
 *   - 次显：月份名 · 中国法定节假日名（命中时）
 *   - 可选：农历（简化版，近似；需要精准农历可接入第三方 lib，当前不联网）
 *
 * 设计：
 *   - 纯本地数据，零网络请求
 *   - 农历转换用轻量表驱动：lunar-cn.ts（本模块目录下）
 *   - 节日表同样是本地硬编码，只含大陆常用法定节日
 *   - 尺寸紧凑，与 Clock/Weather 保持视觉均衡
 */

import { useEffect, useMemo, useState } from 'react';
import { theme } from 'antd';
import { useT } from '@/shared/i18n';
import { useSettingsStore } from '@/store';
import { solarToLunarLabel, getSolarHoliday, loadLunarAsync } from './lunar-cn';

export function CalendarWidget() {
  const { token } = theme.useToken();
  const { t, locale } = useT();
  const conf = useSettingsStore((s) => s.settings.heroWidgets?.calendar);
  const enabled = conf?.enabled !== false;
  const showLunar = conf?.showLunar !== false;
  const showHolidays = conf?.showHolidays !== false;

  // lunar-typescript 懒加载就绪后触发一次重渲染（仅 zh-CN 触发）
  const [lunarReady, setLunarReady] = useState(false);
  useEffect(() => {
    if (locale !== 'zh-CN') return;
    if (!showLunar && !showHolidays) return;
    let alive = true;
    void loadLunarAsync().then(() => {
      if (alive) setLunarReady(true);
    });
    return () => {
      alive = false;
    };
  }, [locale, showLunar, showHolidays]);

  /** 今日日期计算 —— lunarReady 翻转时重新计算以注入真实农历/节日 */
  const info = useMemo(() => {
    const d = new Date();
    const day = d.getDate();
    const weekdayLabel = d.toLocaleDateString(locale === 'zh-CN' ? 'zh-CN' : 'en-US', {
      weekday: 'long',
    });
    const monthLabel = d.toLocaleDateString(locale === 'zh-CN' ? 'zh-CN' : 'en-US', {
      month: 'long',
    });
    const lunar = showLunar ? solarToLunarLabel(d) : '';
    const holiday = showHolidays ? getSolarHoliday(d, locale) : '';
    return { day, weekdayLabel, monthLabel, lunar, holiday };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, showLunar, showHolidays, lunarReady]);

  if (!enabled) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minWidth: 140,
      }}
      aria-label={t('heroWidgets.calendar.aria')}
    >
      {/* 左侧：日期数字 */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: token.colorPrimaryBg,
          color: token.colorPrimaryText,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: '-0.04em',
          flexShrink: 0,
        }}
      >
        {info.day}
      </div>
      {/* 右侧：月 + 周几 + 农历/节日 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: token.colorText,
            lineHeight: 1.2,
          }}
        >
          {info.monthLabel}
          <span style={{ marginLeft: 6, color: token.colorTextSecondary, fontWeight: 500 }}>
            {info.weekdayLabel}
          </span>
        </div>
        <div
          style={{
            fontSize: 11,
            color: info.holiday !== '' ? token.colorPrimary : token.colorTextTertiary,
            lineHeight: 1.2,
            fontWeight: info.holiday !== '' ? 500 : 400,
          }}
        >
          {info.holiday !== '' ? info.holiday : info.lunar}
        </div>
      </div>
    </div>
  );
}
