/**
 * i18n —— React 侧入口
 *
 * 组件 / Hook 留在这里；字典与纯函数（translate / formatDate / formatNumber）
 * 拆到 ./core.ts，满足 `react-refresh/only-export-components` 的组件纯净要求。
 *
 * 注意：纯函数（translate / formatDate / formatNumber）**不再从本文件 re-export**，
 * 请直接 `import { translate } from '@/shared/i18n/core'`。类型 `Locale` 可继续
 * 从本文件 re-export（仅类型不算 value export，不破坏 fast-refresh）。
 */

import { createContext, useContext, useCallback, useMemo } from 'react';
import { useSettingsStore } from '@/store';
import { translateWithLocale, type Locale } from './core';

/** 类型 re-export：不影响 fast-refresh 规则 */
export type { Locale };

/** I18nContext 注入值 */
interface I18nContextValue {
  /** 当前语言 */
  locale: Locale;
  /** 翻译函数：传入 key 和可选占位符，返回翻译文本 */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** 切换语言 */
  setLocale: (locale: Locale) => void;
}

/** I18n Context 实例，供 Provider 和 useT 使用 */
const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * I18nProvider —— 将当前语言与 `t` 函数注入 React 树
 *
 * 从 settings store 读取语言设置，派生 locale 和 t 函数，
 * 通过 Context 提供给所有子组件。首次加载时根据浏览器语言自动推断。
 *
 * @param children 子组件
 * @param children.children
 * @returns 包裹了 I18nContext.Provider 的子组件树
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
      void updateSettings({ language: newLocale });
    },
    [updateSettings],
  );

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translateWithLocale(locale, key, params),
    [locale],
  );

  /** 用 useMemo 稳定化 context value，避免消费组件因引用变化而无限重渲染 */
  const contextValue = useMemo(
    () => ({ locale, t, setLocale }),
    [locale, t, setLocale],
  );

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}

/**
 * 组件内获取 `t` / `locale` / `setLocale`
 *
 * @returns I18n 上下文，包含 locale、t 翻译函数和 setLocale
 * @throws 若在未包裹 I18nProvider 的组件中使用，抛出 Error
 */
export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used within I18nProvider');
  return ctx;
}
