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
    document.documentElement.style.backgroundColor = mode === 'dark'
      ? (skinPreset === 'glassmorphism' ? '#202020' : '#141414')
      : (skinPreset === 'glassmorphism' ? '#F3F3F3' : '#F5F5F7');
    document.documentElement.style.colorScheme = mode;

    try {
      window.localStorage.setItem(LOCAL_CACHE_KEYS.prepaintTheme, mode);
    } catch {
      // ignore local cache failures
    }
  }, [mode, loaded]);

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
      typography={{ className: 'app-typography' }}
      tag={{ classNames: { root: 'app-tag' } }}
      button={{ classNames: { root: 'app-button' } }}
      card={{ classNames: { root: 'app-card' } }}
      alert={{ classNames: { root: 'app-alert' } }}
      badge={{ classNames: { indicator: 'app-badge__indicator' } }}
      segmented={{
        classNames: {
          root: 'app-segmented',
          item: 'app-segmented__item',
        },
      }}
      modal={{
        classNames: {
          mask: 'app-modal__mask',
          header: 'app-modal__header',
          body: 'app-modal__body',
          footer: 'app-modal__footer',
          container: 'app-modal__container',
        },
      }}
      drawer={{
        classNames: {
          mask: 'app-drawer__mask',
          header: 'app-drawer__header',
          body: 'app-drawer__body',
          footer: 'app-drawer__footer',
          section: 'app-drawer__section',
        },
      }}
      popover={{
        classNames: {
          container: 'app-popover__container',
        },
      }}
    >
      <AntdApp style={ANT_APP_STYLE}>
        <FeedbackBridge />
        {children}
      </AntdApp>
    </ConfigProvider>
  );
}
