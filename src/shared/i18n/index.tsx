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

import React, { createContext, useContext, useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { useSettingsStore } from '@/store';
import { translateWithLocale, translateDebug, getDictionaries, loadChineseKeyMap, loadDictionary, loadLocale, type Locale, type TranslateDebugInfo } from './core';

/** 类型 re-export：方便外部使用调试信息类型 */
export type { TranslateDebugInfo };

/** 类型 re-export：不影响 fast-refresh 规则 */
export type { Locale };

/** 带 debug 方法的翻译函数类型 */
interface TFunction {
  (key: string, params?: Record<string, string | number>): string;
  /** 返回指定 key 的完整调试信息（key 解析路径、中英文翻译、是否缺失等） */
  debug: (key: string, params?: Record<string, string | number>) => TranslateDebugInfo;
}

/** I18n Context 值 */
interface I18nContextValue {
  locale: Locale;
  t: TFunction;
  setLocale: (locale: Locale) => void;
  /** 翻译文件是否已从服务端加载完成（false 时使用内嵌字典） */
  dictReady: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * I18nProvider —— 将当前语言与 `t` 函数注入 React 树
 *
 * 加载策略：
 *   1. 应用启动时先用内嵌字典（zh-CN.ts / en.ts）立即可用，无白屏
 *   2. 异步加载哈希命名的翻译文件（生产）或 /i18n/source/*.json（开发）
 *   3. 加载成功后替换内存字典，触发重渲染使用最新翻译
 *   4. 加载失败时保留内嵌字典，确保基本功能可用
 *   5. 语言切换时仅加载目标语言的翻译文件，避免不必要的网络请求
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const settingsLocale = useSettingsStore((s) => s.settings.language);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const loaded = useSettingsStore((s) => s.loaded);

  // 应用启动时构建中文→键名双向映射（只执行一次）
  const mapInitialized = useRef(false);
  // 翻译文件是否已从服务端加载完成
  const [dictReady, setDictReady] = useState(false);
  // 记录上一次加载的 locale，用于检测语言切换
  const prevLocaleRef = useRef<Locale | null>(null);

  // ── 初始化：启动时加载全量字典 ──────────────────────────────
  useEffect(() => {
    if (mapInitialized.current) return;
    mapInitialized.current = true;

    // 先用内嵌字典构建中文→键名映射，确保 t() 立即可用
    loadChineseKeyMap();

    // 异步加载哈希命名的翻译文件（生产）或原始文件（开发）
    loadDictionary().then((success) => {
      if (success) {
        setDictReady(true);
        // 开发模式：加载完成后输出词条统计
        if (import.meta.env.DEV) {
          const dicts = getDictionaries();
          const zhCount = Object.keys(dicts['zh-CN']).length;
          const enCount = Object.keys(dicts.en).length;
          const missingEn = Object.keys(dicts['zh-CN']).filter((k) => !dicts.en[k]).length;
          console.groupCollapsed('[i18n] 翻译字典加载完成');
          console.log(`  zh-CN：${zhCount} 条`);
          console.log(`  en：${enCount} 条`);
          if (missingEn > 0) {
            console.warn(`  ⚠️  英文缺失：${missingEn} 条`);
          } else {
            console.log('  ✅ 英文翻译完整');
          }
          console.groupEnd();
        }
      } else {
        // 加载失败：内嵌字典仍可用，仅标记未就绪
        console.warn('[i18n] 翻译文件加载失败，使用内嵌字典');
      }
    });
  }, []);

  /**
   * locale 直接从 store 派生：
   *   - settings 已加载：使用 settings.language
   *   - 未加载：回退到 navigator 推断
   */
  const locale: Locale = (loaded && settingsLocale)
    ? settingsLocale
    : (navigator.language.startsWith('zh') ? 'zh-CN' : 'en');

  // ── 语言切换：动态加载目标语言翻译文件 ──────────────────────
  useEffect(() => {
    // 跳过初始化阶段（由上面的 effect 处理）
    if (!mapInitialized.current) return;
    // 跳过相同语言
    if (prevLocaleRef.current === locale) return;

    const prev = prevLocaleRef.current;
    prevLocaleRef.current = locale;

    // 首次设置时不触发切换加载（由初始化 effect 处理）
    if (prev === null) return;

    // 语言发生切换，加载目标语言的翻译文件
    loadLocale(locale).then((success) => {
      if (success) {
        // 触发重渲染，使用新语言的翻译
        setDictReady((v) => !v ? true : v);
      } else {
        console.warn(`[i18n] 语言 ${locale} 翻译文件加载失败，使用内嵌字典`);
      }
    });
  }, [locale]);

  const setLocale = useCallback(
    (newLocale: Locale) => {
      void updateSettings({ language: newLocale });
    },
    [updateSettings],
  );

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translateWithLocale(locale, key, params),
    // dictReady 作为依赖：字典加载完成后触发重渲染，确保 t() 使用最新字典
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, dictReady],
  ) as TFunction;

  // 挂载 debug 方法：返回指定 key 的完整调试信息
  t.debug = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translateDebug(locale, key, params),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, dictReady],
  );

  /** 用 useMemo 稳定化 context value，避免消费组件因引用变化而无限重渲染 */
  const contextValue = useMemo(
    () => ({ locale, t, setLocale, dictReady }),
    [locale, t, setLocale, dictReady],
  );

  return (
    <I18nContext.Provider value={contextValue}>
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

// ─── <Trans> 富文本翻译组件 ──────────────────────────────────────────

/**
 * Trans —— 支持 JSX 内翻译的组件
 *
 * 用法：
 * ```tsx
 * <Trans>共 <b>{count}</b> 个标签页</Trans>
 * ```
 *
 * 工作原理：
 * 1. 收集子元素的纯文本（忽略标签/组件，保留占位符位置）
 * 2. 将拼接的纯文本作为翻译 key（优先中文直达）
 * 3. 对翻译结果按 `<0>` / `<1>` 占位符拆分，穿插回子元素
 *
 * 限制：子元素中不能包含嵌套的 HTML 标签（如 <div><span>...</span></div>），
 * 只支持简单标签如 <b>、<i>、<em>、<strong> 等。
 */
export function Trans({ children }: { children: React.ReactNode }) {
  const { t } = useT();

  // 1. 递归收集子元素中的文本片段和占位符位置
  const parts: Array<{ type: 'text'; value: string } | { type: 'tag'; index: number }> = [];
  let tagIndex = 0;

  function collect(node: React.ReactNode): void {
    if (React.isValidElement(node)) {
      parts.push({ type: 'tag', index: tagIndex++ });
      const childNodes = (node.props as { children?: React.ReactNode }).children;
      React.Children.forEach(childNodes, collect);
    } else if (typeof node === 'string') {
      parts.push({ type: 'text', value: node });
    } else if (typeof node === 'number') {
      parts.push({ type: 'text', value: String(node) });
    } else if (Array.isArray(node)) {
      node.forEach(collect);
    }
  }

  if (typeof children === 'string') {
    return <>{t(children)}</>;
  }

  if (typeof children === 'number') {
    return <>{t(String(children))}</>;
  }

  collect(children);
  const rawText = parts
    .map((p) => (p.type === 'text' ? p.value : `<${p.index}>`))
    .join('');

  // 2. 翻译文本
  const translated = t(rawText);

  // 3. 如果翻译结果与原文相同，直接渲染子元素
  if (translated === rawText) {
    return <>{children}</>;
  }

  // 4. 将翻译结果按 <0>/<1>/... 占位符拆分
  const tagCount = parts.filter((p) => p.type === 'tag').length;
  if (tagCount === 0) {
    return <>{translated}</>;
  }

  // 按 <数字> 拆分翻译结果
  const splitRegex = new RegExp(`(<\\d+>)`);
  const translatedParts = translated.split(splitRegex).filter(Boolean);

  // 构建 React 元素数组
  const elements: React.ReactNode[] = [];

  // 收集子元素中的标签元素（按深度优先顺序）
  const tagElements: React.ReactElement[] = [];
  function collectTagElements(node: React.ReactNode): void {
    if (React.isValidElement(node)) {
      tagElements.push(node);
      const childNodes = (node.props as { children?: React.ReactNode }).children;
      React.Children.forEach(childNodes, collectTagElements);
    } else if (Array.isArray(node)) {
      node.forEach(collectTagElements);
    }
  }
  collectTagElements(children);

  for (const part of translatedParts) {
    const tagMatch = part.match(/^<(\d+)>$/);
    if (tagMatch) {
      const idx = parseInt(tagMatch[1]!, 10);
      const maybeTagEl = tagElements[idx];
      if (maybeTagEl !== undefined) {
        elements.push(React.cloneElement(maybeTagEl!, { key: `tag-${idx}` }));
      } else {
        // 如果找不到对应的标签元素，直接输出占位符文本
        elements.push(part);
      }
    } else {
      elements.push(part);
    }
  }

  return <>{elements}</>;
}
