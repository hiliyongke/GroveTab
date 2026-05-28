/**
 * i18n 纯函数核心
 *
 * 把字典、类型定义以及非 React 环境下使用的 `translate` / `formatDate` / `formatNumber`
 * 从 `index.tsx` 拆出来，避免「同文件同时导出组件与常量/纯函数」导致的
 * `react-refresh/only-export-components` 告警。
 *
 * React 组件侧（`I18nProvider` / `useT`）继续放在 `index.tsx`。
 */

import { useSettingsStore } from "@/store";
import { fetchGet } from "@/chrome/fetch";
import zhCN from "./zh-CN";
import en from "./en";

/** 目前支持的两种语言 */
export type Locale = "zh-CN" | "en";

// ─── 字典文件类型定义 ─────────────────────────────────────────

/** 字典条目：key + 中文原文 + 英文翻译 */
export interface DictionaryEntry {
  /** k_ 前缀标准键名（如 "k_0a3b7x2"） */
  key: string;
  /** 中文原文 */
  "zh-CN": string;
  /** 英文翻译 */
  en: string;
}

/**
 * 字典文件格式（i18n/source/*.json）
 * 每个文件是一个 DictionaryEntry 数组
 */
export type DictionaryFile = DictionaryEntry[];

/** 字典表：按 Locale 索引到 key→value 的平坦 Map */
let dictionaries: Record<Locale, Record<string, string>> = {
  "zh-CN": zhCN,
  en,
};

/**
 * 替换内存中的字典数据
 * 用于 loadDictionary 成功加载新格式字典后替换旧字典
 */
export function replaceDictionaries(
  newDicts: Partial<Record<Locale, Record<string, string>>>,
): void {
  dictionaries = { ...dictionaries, ...newDicts };
}

/**
 * 获取当前字典的引用（调试用）
 */
export function getDictionaries(): Record<Locale, Record<string, string>> {
  return dictionaries;
}

// ─── 中文→键名双向映射 ────────────────────────────────────

/** 中文→键名反向映射字典（中文原文 → 标准键名） */
let ChineseKeyMap: Record<string, string> = {};

/**
 * 生成唯一键名（格式：`k_` + 7位随机字母数字）
 * 示例：k_0a3b7x2, k_z9y8c4d
 */
export function generateKeyId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "k_";
  for (let i = 0; i < 7; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/**
 * 从翻译字典构建中文→键名的双向映射索引
 * 遍历 zh-CN 字典，将每个中文 value 映射回其 key
 *
 * 支持两种字典来源：
 *   1. 旧格式：Record<string, string>（直接从 dictionaries 加载）
 *   2. 新格式：DictionaryFile[]（从 i18n/source/*.json 加载）
 */
export function loadChineseKeyMap(source?: DictionaryFile | Record<string, string>): void {
  ChineseKeyMap = {};

  if (source && Array.isArray(source)) {
    // 新格式：DictionaryFile 数组
    for (const entry of source) {
      ChineseKeyMap[entry["zh-CN"]] = entry.key;
    }
  } else {
    // 旧格式：从 dictionaries 中遍历 zh-CN
    const zhDict = source || dictionaries["zh-CN"];
    for (const [key, value] of Object.entries(zhDict)) {
      // 中文原文 → 键名映射（允许一对多，后者覆盖前者）
      ChineseKeyMap[value] = key;
    }
  }
}

// ─── 运行时字典缓存 ────────────────────────────────────────────

/** 字典是否已从 i18n/source/ 加载并替换 */
let dictLoadedFromSource = false;

/**
 * 读取构建时注入的 i18n manifest
 * 构建时 vite.config.ts 会在 HTML 中注入：
 *   window.__I18N_MANIFEST__ = { "zh-CN": "/i18n/zh-CN.{hash}.json", "en": "/i18n/en.{hash}.json" }
 */
function getI18nManifest(): Record<string, string> {
  if (
    typeof window !== "undefined" &&
    (window as unknown as Record<string, unknown>).__I18N_MANIFEST__
  ) {
    return (window as unknown as Record<string, unknown>).__I18N_MANIFEST__ as Record<
      string,
      string
    >;
  }
  return {};
}

/**
 * 获取指定 locale 的翻译文件 URL
 * 优先使用构建时注入的哈希命名路径，回退到开发时的原始路径
 */
function getI18nUrl(locale: Locale, baseUrl = ""): string {
  const manifest = getI18nManifest();
  if (manifest[locale]) {
    return manifest[locale];
  }
  // 开发模式回退：直接从 i18n/source/ 加载
  return `${baseUrl}/i18n/source/${locale}.json`;
}

/**
 * 从翻译文件加载单个 locale 的字典数据
 * @param locale  目标语言
 * @param baseUrl 基础路径（开发模式用）
 */
async function fetchLocaleDict(locale: Locale, baseUrl = ""): Promise<DictionaryFile | null> {
  const url = getI18nUrl(locale, baseUrl);
  try {
    const res = await fetchGet(url);
    if (!res.ok) {
      console.warn(`[i18n] 翻译文件加载失败 (${res.status}): ${url}`);
      return null;
    }
    return (await res.json()) as DictionaryFile;
  } catch (err) {
    console.warn(`[i18n] 翻译文件请求异常: ${url}`, err);
    return null;
  }
}

/**
 * 从 DictionaryFile 数组构建 Record<string, string> 格式的字典
 */
function buildDictFromEntries(
  entries: DictionaryFile,
  field: "zh-CN" | "en",
): Record<string, string> {
  const dict: Record<string, string> = {};
  for (const entry of entries) {
    if (entry[field]) {
      dict[entry.key] = entry[field];
    }
  }
  return dict;
}

/**
 * 从 i18n/source/ 目录加载字典文件并构建内存字典
 * 内置缓存：首次调用执行加载，后续调用直接返回缓存结果
 *
 * 加载策略：
 *   1. 生产环境：从 window.__I18N_MANIFEST__ 读取哈希命名的文件路径
 *   2. 开发环境：回退到 /i18n/source/{locale}.json
 *   3. 加载失败：保留内嵌的最小字典（zh-CN.ts / en.ts），确保基本功能可用
 *
 * @param baseUrl 翻译文件的基础路径（开发模式用，默认 ''）
 * @param force   是否强制重新加载（默认 false）
 * @returns 是否成功加载
 */
export async function loadDictionary(baseUrl?: string, force = false): Promise<boolean> {
  // 缓存命中且非强制刷新时直接返回
  if (dictLoadedFromSource && !force) {
    return true;
  }

  try {
    const [zhCNData, enData] = await Promise.all([
      fetchLocaleDict("zh-CN", baseUrl),
      fetchLocaleDict("en", baseUrl),
    ]);

    // 至少有一个语言加载成功才替换字典
    if (!zhCNData && !enData) {
      console.warn("[i18n] 所有翻译文件加载失败，回退到内嵌字典");
      return false;
    }

    if (zhCNData) {
      dictionaries["zh-CN"] = buildDictFromEntries(zhCNData, "zh-CN");
      // 使用新格式数据构建中文→键名映射
      loadChineseKeyMap(zhCNData);
    }

    if (enData) {
      dictionaries.en = buildDictFromEntries(enData, "en");
    }

    // 标记缓存已加载
    dictLoadedFromSource = true;

    if (import.meta.env?.DEV) {
      const zhCount = zhCNData ? Object.keys(dictionaries["zh-CN"]).length : 0;
      const enCount = enData ? Object.keys(dictionaries.en).length : 0;

      console.info(`[i18n] 字典加载完成：zh-CN ${zhCount} 条，en ${enCount} 条`);
    }

    return true;
  } catch (err) {
    console.warn("[i18n] 字典加载异常，回退到内嵌字典:", err);
    return false;
  }
}

/**
 * 切换语言时重新加载对应语言的翻译文件
 * 仅加载目标语言，避免不必要的网络请求
 *
 * @param locale  目标语言
 * @param baseUrl 基础路径（开发模式用）
 * @returns 是否成功加载
 */
export async function loadLocale(locale: Locale, baseUrl?: string): Promise<boolean> {
  try {
    const data = await fetchLocaleDict(locale, baseUrl);
    if (!data) return false;

    dictionaries[locale] = buildDictFromEntries(data, locale);

    // 如果加载的是中文，同步更新 ChineseKeyMap
    if (locale === "zh-CN") {
      loadChineseKeyMap(data);
    }

    return true;
  } catch (err) {
    console.warn(`[i18n] 语言 ${locale} 加载失败:`, err);
    return false;
  }
}

/**
 * 通过中文原文反查标准键名
 * @param chineseKey 中文原文（如 "搜索标签页..."）
 * @returns 标准键名（如 "search.placeholder"）或 undefined
 */
export function lookupKeyByChinese(chineseKey: string): string | undefined {
  return ChineseKeyMap[chineseKey];
}

// ─── 核心翻译函数 ────────────────────────────────────────

/**
 * 判断字符串是否包含中文字符
 */
function containsChinese(str: string): boolean {
  return /[\u4e00-\u9fff]/.test(str);
}

/**
 * 在 dictionaries 中按 locale 查找并替换占位符
 * 支持：
 *   1. 标准 key 查找（如 "search.placeholder"）
 *   2. 中文直达查找（如 "搜索标签页..."）——先反查为 key 再查翻译
 */
function lookup(locale: Locale, key: string, params?: Record<string, string | number>): string {
  let actualKey = key;
  let isChinese = false;

  // 如果 key 包含中文，尝试通过 ChineseKeyMap 反查为标准键名
  if (containsChinese(key)) {
    isChinese = true;
    const mappedKey = ChineseKeyMap[key];
    if (mappedKey) {
      actualKey = mappedKey;
    }
    // 如果反查不到，保留原始 key（中文回退机制）
  }

  // 中文语言：直接返回中文原文（无需查字典）
  if (locale === "zh-CN" && isChinese) {
    let text = key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  }

  // 按 locale 查翻译，找不到则回退到英文，再找不到返回 key 本身
  const translated = dictionaries[locale]?.[actualKey] || dictionaries.en?.[actualKey];

  // 翻译缺失处理
  if (!translated) {
    // 开发模式：输出警告并返回醒目标记
    if (import.meta.env?.DEV) {
      console.warn(`[i18n] 翻译缺失 (${locale}): "${key}"`);
      // 中文 key 直接回退显示中文原文，非中文 key 显示缺失标记
      return isChinese ? key : `[i18n_missing: ${key}]`;
    }
    // 生产模式：静默回退
    return isChinese ? key : actualKey;
  }

  let text = translated;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, String(v));
    });
  }
  return text;
}

// ─── 调试工具 ────────────────────────────────────────────────

/** `t.debug()` 返回的完整调试信息 */
export interface TranslateDebugInfo {
  /** 原始传入的 key（中文原文或标准键名） */
  inputKey: string;
  /** 反查后的标准键名（k_ 前缀） */
  resolvedKey: string | undefined;
  /** 当前语言 */
  locale: Locale;
  /** 中文原文 */
  zhCN: string | undefined;
  /** 英文翻译 */
  en: string | undefined;
  /** 当前语言的最终翻译结果 */
  result: string;
  /** 是否存在翻译缺失 */
  isMissing: boolean;
}

/**
 * 翻译调试函数：返回包含 key、中文原文、当前语言翻译的完整信息对象
 * 用于开发时排查翻译问题
 *
 * @param locale 目标语言
 * @param key    翻译 key（支持标准 key 或中文原文）
 * @param params 占位符替换 Map
 */
export function translateDebug(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): TranslateDebugInfo {
  let resolvedKey: string | undefined;

  if (containsChinese(key)) {
    resolvedKey = ChineseKeyMap[key];
  } else {
    resolvedKey = key;
  }

  const actualKey = resolvedKey ?? key;
  const zhCN = dictionaries["zh-CN"]?.[actualKey];
  const en = dictionaries.en?.[actualKey];
  const result = lookup(locale, key, params);

  const isMissing =
    locale !== "zh-CN"
      ? !dictionaries[locale]?.[actualKey] && !dictionaries.en?.[actualKey]
      : false;

  return {
    inputKey: key,
    resolvedKey,
    locale,
    zhCN,
    en,
    result,
    isMissing,
  };
}

/**
 * 根据 Locale 和 key 获取翻译（组件与非组件通用）
 * @param locale 目标语言
 * @param key    翻译 key（支持标准 key 或中文原文）
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
 * @param key    翻译 key（支持标准 key 或中文原文）
 * @param params 占位符替换 Map
 */
export function translate(key: string, params?: Record<string, string | number>): string {
  const lang = useSettingsStore.getState().settings?.language;
  const loc: Locale = lang === "en" ? "en" : "zh-CN";
  return lookup(loc, key, params);
}
