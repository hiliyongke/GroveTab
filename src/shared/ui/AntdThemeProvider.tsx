/**
 * AntdThemeProvider —— antd v6 主题桥接 + 皮肤系统
 *
 * 职责：
 *   1. 解析当前明暗模式并同步到 `<html data-theme>`
 *   2. 通过 ConfigProvider 注入 antd v6 官方主题配置
 *   3. 注入业务层消费的 `--app-*` 语义变量
 *   4. 挂载 antd App 容器，为 message/notification/modal 提供上下文
 */

import { useEffect, useMemo, useRef } from 'react';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { useSettingsStore } from '@/store';
import { useResolvedTheme } from '@/shared/hooks';
import { bindFeedback, unbindFeedback } from './feedback';
import { getSkinPreset } from '@/shared/theme/skin-presets';
import { buildAntdThemeConfig, buildAppThemeVars } from '@/shared/theme/theme-customization';
import { LOCAL_CACHE_KEYS } from '@/shared/config/storage-keys';

const ANT_APP_STYLE: React.CSSProperties = { minHeight: '100vh' };

/** 静态 classNames 对象，避免每次渲染创建新引用导致 antd ConfigProvider 重复计算 */
const MODAL_CLASS_NAMES = {
  mask: 'app-modal__mask',
  header: 'app-modal__header',
  body: 'app-modal__body',
  footer: 'app-modal__footer',
  container: 'app-modal__container',
} as const;
const DRAWER_CLASS_NAMES = {
  mask: 'app-drawer__mask',
  header: 'app-drawer__header',
  body: 'app-drawer__body',
  footer: 'app-drawer__footer',
  section: 'app-drawer__section',
} as const;
const POPOVER_CLASS_NAMES = { container: 'app-popover__container' } as const;
const CARD_CLASS = { root: 'app-card' };
const TAG_CLASS = { root: 'app-tag' };
const BUTTON_CLASS = { root: 'app-button' };
const ALERT_CLASS = { root: 'app-alert' };
const BADGE_CLASS = { indicator: 'app-badge__indicator' };
const SEGMENTED_CLASS = { root: 'app-segmented', item: 'app-segmented__item' };
const TYPOGRAPHY_CONFIG = { className: 'app-typography' } as const;

/** 包装 classNames 的对象，避免每次渲染创建新引用 */
const TAG_PROPS = { classNames: TAG_CLASS };
const BUTTON_PROPS = { classNames: BUTTON_CLASS };
const CARD_PROPS = { classNames: CARD_CLASS };
const ALERT_PROPS = { classNames: ALERT_CLASS };
const BADGE_PROPS = { classNames: BADGE_CLASS };
const SEGMENTED_PROPS = { classNames: SEGMENTED_CLASS };
const MODAL_PROPS = { classNames: MODAL_CLASS_NAMES };
const DRAWER_PROPS = { classNames: DRAWER_CLASS_NAMES };
const POPOVER_PROPS = { classNames: POPOVER_CLASS_NAMES };

function FeedbackBridge() {
  const { message, notification, modal } = AntdApp.useApp();
  const apiRef = useRef({ message, notification, modal });

  useEffect(() => {
    apiRef.current = { message, notification, modal };
  }, [message, notification, modal]);

  useEffect(() => {
    bindFeedback(apiRef);
    return () => unbindFeedback();
  }, []);

  return null;
}

export function AntdThemeProvider({ children }: { children: React.ReactNode }) {
  const language = useSettingsStore((s) => s.settings.language);
  const loaded = useSettingsStore((s) => s.loaded);
  const mode = useResolvedTheme();
  const skinPreset = useSettingsStore((s) => s.settings.skinPreset ?? 'glassmorphism');
  const layoutDensity = useSettingsStore((s) => s.settings.layoutDensity ?? 'default');
  const reducedMotionSetting = useSettingsStore((s) => s.settings.reducedMotion ?? 'auto');
  const skinCustom = useSettingsStore((s) => s.settings.skinCustom);

  const reducedMotion = reducedMotionSetting === 'on'
    || (reducedMotionSetting === 'auto' && typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    if (!loaded) return;
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.setAttribute('data-skin', skinPreset);
    // 皮肤切换过渡动画
    if (!reducedMotion) {
      document.documentElement.style.transition = 'background-color 300ms ease, color 200ms ease';
    }
    document.documentElement.style.backgroundColor = mode === 'dark'
      ? (skinPreset === 'glassmorphism' ? '#202020' : '#141414')
      : (skinPreset === 'glassmorphism' ? '#F3F3F3' : '#F5F5F7');
    document.documentElement.style.colorScheme = mode;

    try {
      window.localStorage.setItem(LOCAL_CACHE_KEYS.prepaintTheme, mode);
    } catch {
      // ignore local cache failures
    }
  }, [mode, skinPreset, reducedMotion, loaded]);

  useEffect(() => {
    if (!loaded) return;
    const skin = getSkinPreset(skinPreset);
    if (skin.texture.noise) {
      document.documentElement.setAttribute('data-texture-noise', '');
    } else {
      document.documentElement.removeAttribute('data-texture-noise');
    }
  }, [skinPreset, loaded]);

  useEffect(() => {
    dayjs.locale(language === 'zh-CN' ? 'zh-cn' : 'en');
  }, [language]);

  const appThemeVars = useMemo(
    () => buildAppThemeVars(skinPreset, mode === 'dark', layoutDensity, reducedMotion, skinCustom),
    [skinPreset, mode, layoutDensity, reducedMotion, skinCustom],
  );

  useEffect(() => {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(appThemeVars)) {
      root.style.setProperty(key, value);
    }
    return () => {
      // 主题切换时清理已设置的变量，由下一次 effect 重新写入
      for (const key of Object.keys(appThemeVars)) {
        root.style.removeProperty(key);
      }
    };
  }, [appThemeVars]);

  const themeConfig = useMemo(
    () => buildAntdThemeConfig(skinPreset, mode === 'dark', layoutDensity, skinCustom),
    [skinPreset, mode, layoutDensity, skinCustom],
  );

  const locale = language === 'zh-CN' ? zhCN : enUS;

  return (
    <ConfigProvider
      theme={themeConfig}
      locale={locale}
      typography={TYPOGRAPHY_CONFIG}
      tag={TAG_PROPS}
      button={BUTTON_PROPS}
      card={CARD_PROPS}
      alert={ALERT_PROPS}
      badge={BADGE_PROPS}
      segmented={SEGMENTED_PROPS}
      modal={MODAL_PROPS}
      drawer={DRAWER_PROPS}
      popover={POPOVER_PROPS}
    >
      <AntdApp style={ANT_APP_STYLE}>
        <FeedbackBridge />
        {children}
      </AntdApp>
    </ConfigProvider>
  );
}
