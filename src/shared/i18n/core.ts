/**
 * i18n 纯函数核心（v4）
 *
 * 字典格式：
 *   zh-CN.json: { "k_xxx": "中文原文" }  （k_xxx = MD5(中文) 前 8 位）
 *   en.json:    { "k_xxx": "English" }
 *
 * 查找流程：
 *   t("设置") → locale=zh-CN → 直接返回原文（零字典查询）
 *   t("设置") → locale=en → reverseMap["设置"] → k_xxx → en[k_xxx] → 翻译
 *
 * 启动时导入 JSON 字典作为内嵌 fallback，立即可用无需等待网络请求。
 * 翻译结果自动应用 pangu 间距算法（中英文/数字间加空格）。
 */

import { useSettingsStore } from "@/store";
import { fetchGet } from "@/chrome/fetch";
import { panguSpacing } from "./format";

// ─── 内嵌字典（编译时注入，立即可用） ──────────────────────
import zhCNBuiltin from '../../../i18n/source/zh-CN.json';
import enBuiltin from '../../../i18n/source/en.json';

export type Locale = "zh-CN" | "en";

// ─── Window 类型扩展 ──────────────────────────────────────
declare global {
  interface Window {
    __I18N_MANIFEST__?: Record<string, string>;
  }
}

// ─── 反向映射 ────────────────────────────────────────────

/**
 * 从 zh-CN.json（k_xxx → 中文）构建反向映射（中文 → k_xxx）
 */
function buildReverseMap(dict: Record<string, string>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [kId, zhText] of Object.entries(dict)) {
    if (typeof zhText === 'string') map[zhText] = kId;
  }
  return map;
}

// ─── 字典表 ──────────────────────────────────────────────

/** en 字典：k_xxx → English */
let enDict: Record<string, string> = { ...enBuiltin };
/** zh-CN 字典：k_xxx → 中文 */
let zhDict: Record<string, string> = { ...zhCNBuiltin };
/** 反向映射：中文 → k_xxx，启动时立即构建 */
let reverseMap: Record<string, string> = buildReverseMap(zhCNBuiltin);
/** 字典是否已从服务端加载 */
let dictReady = false;

export function getDictionaries(): { zhCN: Record<string, string>; en: Record<string, string> } {
  return { zhCN: zhDict, en: enDict };
}

// ─── 字典加载 ────────────────────────────────────────────

function getI18nManifest(): Record<string, string> {
  if (typeof window !== "undefined" && window.__I18N_MANIFEST__) {
    return window.__I18N_MANIFEST__;
  }
  return {};
}

function getI18nUrl(locale: Locale, baseUrl = ""): string {
  const manifest = getI18nManifest();
  if (manifest[locale]) return manifest[locale];
  return `${baseUrl}/i18n/source/${locale}.json`;
}

async function fetchLocaleDict(locale: Locale, baseUrl = ""): Promise<Record<string, string> | null> {
  const url = getI18nUrl(locale, baseUrl);
  try {
    const res = await fetchGet(url);
    if (!res.ok) {
      console.warn(translate("[i18n] 加载失败 ({status}): {url}", { status: res.status, url }));
      return null;
    }
    return (await res.json()) as Record<string, string>;
  } catch (err) {
    console.warn(translate("[i18n] 请求异常 : {url}", { url }), err);
    return null;
  }
}

let loadPromise: Promise<boolean> | null = null;

/**
 * 加载全量字典（zh-CN.json + en.json），构建反向映射。
 * 内置缓存：首次调用执行加载，后续直接返回。
 * 加载失败时使用空字典兜底（中文 key 直接返回原文）。
 */
export function loadDictionary(baseUrl?: string, force = false): Promise<boolean> {
  if (!force && dictReady) return Promise.resolve(true);
  if (!force && loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      // 生产环境：built-in 字典已完整，跳过外部 fetch 避免 CSP 问题
      if (!import.meta.env.DEV) {
        dictReady = true;
        return true;
      }
      const [zhData, enData] = await Promise.all([
        fetchLocaleDict("zh-CN", baseUrl),
        fetchLocaleDict("en", baseUrl),
      ]);

      if (zhData) {
        zhDict = zhData;
        reverseMap = buildReverseMap(zhData);
      } else {
        console.warn(translate("[i18n] zh-CN.json 加载失败"));
      }

      if (enData) {
        enDict = enData;
      } else {
        console.warn(translate("[i18n] en.json 加载失败"));
      }

      dictReady = true;

      if (import.meta.env?.DEV) {
        const zhCount = Object.keys(zhDict).length;
        const enCount = Object.keys(enDict).length;
        console.info(translate("[i18n] 字典就绪：zh-CN {zhCount} 条，en {enCount} 条", { zhCount, enCount }));
      }

      return true;
    } catch (err) {
      console.warn(translate("[i18n] 加载异常，使用兜底策略 :"), err);
      dictReady = true; // 标记为就绪，让 t() 走 fallback
      return false;
    }
  })();

  return loadPromise;
}

/**
 * 语言切换时只加载目标语言
 */
export async function loadLocale(locale: Locale, baseUrl?: string): Promise<boolean> {
  try {
    const data = await fetchLocaleDict(locale, baseUrl);
    if (!data) return false;
    if (locale === "zh-CN") {
      zhDict = data;
      reverseMap = buildReverseMap(data);
    } else {
      enDict = data;
    }
    return true;
  } catch (err) {
    console.warn(translate("[i18n] 语言 {locale} 加载失败 :", { locale }), err);
    return false;
  }
}

// ─── 核心翻译 ────────────────────────────────────────────

function containsChinese(str: string): boolean {
  return /[\u4e00-\u9fff]/.test(str);
}

function applyParams(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  let result = text;
  for (const [k, v] of Object.entries(params)) {
    result = result.replaceAll(`{${k}}`, String(v));
  }
  return result;
}

/**
 * 核心查找函数
 */
function lookup(locale: Locale, key: string, params?: Record<string, string | number>): string {
  // zh-CN 且 key 含中文 → 直接返回原文（应用 pangu 间距）
  if (locale === "zh-CN" && containsChinese(key)) {
    return panguSpacing(applyParams(key, params));
  }

  // 需要翻译：key 是中文原文，先反查 MD5
  let dictKey = key;
  if (containsChinese(key)) {
    const mapped = reverseMap[key];
    if (mapped) dictKey = mapped;
  }

  // 查目标语言字典
  const dict = locale === "en" ? enDict : zhDict;
  const raw = dict?.[dictKey] || enDict[dictKey];

  if (!raw || raw.trim() === '') {
    if (import.meta.env?.DEV && locale !== "zh-CN") {
      console.warn(translate('[i18n] 翻译缺失 ({locale}): "{key}" -> {dictKey}', { locale, key, dictKey }));
    }
    return panguSpacing(applyParams(key, params));
  }

  return panguSpacing(applyParams(raw, params));
}

// ─── 调试 ────────────────────────────────────────────────

export interface TranslateDebugInfo {
  inputKey: string;
  resolvedKey: string;
  locale: Locale;
  zhCN: string;
  en: string;
  result: string;
  isMissing: boolean;
}

export function translateDebug(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): TranslateDebugInfo {
  const dictKey = (containsChinese(key) ? reverseMap[key] : key) ?? key;
  const zhVal = zhDict[dictKey] ?? key;
  const enVal = enDict[dictKey];
  const result = lookup(locale, key, params);
  return { inputKey: key, resolvedKey: dictKey, locale, zhCN: zhVal, en: enVal ?? '', result, isMissing: locale !== "zh-CN" && !enVal };
}

export function translateWithLocale(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): string {
  return lookup(locale, key, params);
}

export function translate(key: string, params?: Record<string, string | number>): string {
  const lang = useSettingsStore.getState().settings?.language;
  const loc: Locale = lang === "en" ? "en" : "zh-CN";
  return lookup(loc, key, params);
}
