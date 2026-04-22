/**
 * Canopy i18n —— React 侧入口
 *
 * 组件 / Hook 留在这里；字典与纯函数（translate / formatDate / formatNumber）
 * 拆到 ./core.ts，满足 `react-refresh/only-export-components` 的组件纯净要求。
 *
 * 注意：纯函数（translate / formatDate / formatNumber）**不再从本文件 re-export**，
 * 请直接 `import { translate } from '@/shared/i18n/core'`。类型 `Locale` 可继续
 * 从本文件 re-export（仅类型不算 value export，不破坏 fast-refresh）。
 */

import { createContext, useContext, useCallback } from 'react';
import { useSettingsStore } from '@/store';
import { translateWithLocale, type Locale } from './core';

/** 类型 re-export：不影响 fast-refresh 规则 */
export type { Locale };

/** I18n Context 值 */
interface I18nContextValue {
  locale: Locale;
  t: (key: string, params?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * I18nProvider —— 将当前语言与 `t` 函数注入 React 树
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const settingsLocale = useSettingsStore((s) => s.settings.language);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const loaded = useSettingsStore((s) => s.loaded);

  /**
   * locale 直接从 store 派生：
   *   - settings 已加载：使用 settings.language
   *   - 未加载：回退到 navigator 推断
   * 避免在 effect 里 setState 触发的级联 render。
   */
  const locale: Locale = loaded && settingsLocale
    ? settingsLocale
    : (navigator.language.startsWith('zh') ? 'zh-CN' : 'en');

  const setLocale = useCallback(
    (newLocale: Locale) => {
      updateSettings({ language: newLocale });
    },
    [updateSettings],
  );

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translateWithLocale(locale, key, params),
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

/** 组件内获取 `t` / `locale` / `setLocale` */
export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used within I18nProvider');
  return ctx;
}
