/**
 * i18n 纯函数核心
 *
 * 把字典、类型定义以及非 React 环境下使用的 `translate` / `formatDate` / `formatNumber`
 * 从 `index.tsx` 拆出来，避免「同文件同时导出组件与常量/纯函数」导致的
 * `react-refresh/only-export-components` 告警。
 *
 * React 组件侧（`I18nProvider` / `useT`）继续放在 `index.tsx`。
 */

import { useSettingsStore } from '@/store';
import zhCN from './zh-CN';
import en from './en';

/** 目前支持的两种语言 */
export type Locale = 'zh-CN' | 'en';

/** 字典表：按 Locale 索引到 key→value 的平坦 Map */
const dictionaries: Record<Locale, Record<string, string>> = {
  'zh-CN': zhCN,
  en,
};

/** 在 dictionaries 中按 locale 查找并替换占位符 */
function lookup(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): string {
  let text = dictionaries[locale]?.[key] || dictionaries['en']?.[key] || key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, String(v));
    });
  }
  return text;
}

/**
 * 根据 Locale 和 key 获取翻译（组件与非组件通用）
 * @param locale 目标语言
 * @param key    翻译 key
 * @param params 占位符替换 Map
 */
export function translateWithLocale(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): string {
  return lookup(locale, key, params);
}

/**
 * 非 React 环境使用的纯函数版翻译器
 *
 * 适用于 store action、chrome API 回调、SW 桥等脱离 React tree 的场景。
 * 从 settings store 直接读 language，不依赖 Context。
 *
 * @param key    同 useT 的 key
 * @param params 占位符替换 Map
 */
export function translate(
  key: string,
  params?: Record<string, string | number>,
): string {
  const lang = useSettingsStore.getState().settings?.language;
  const loc: Locale = lang === 'en' ? 'en' : 'zh-CN';
  return lookup(loc, key, params);
}


