/**
 * 搜索引擎与热门关键词配置。
 *
 * 热词来源由 `settings.hotSuggestionSource` 控制：
 *   - 'off'       ：不显示热词
 *   - 'local'     ：基于用户本地搜索历史聚合（默认，零请求）
 *   - 'preset'    ：静态预设列表（显式选择 preset 时展示）
 *   - 'trending'  ：可选公开热榜（目前未启用，占位）
 *
 * 所有数据源都不强制联网，国内环境默认 off / local 即可。
 *
 * 本文件包含 locale-specific 数据（搜索引擎品牌名 + 预设热词表），
 * 不属于「中文原文 → 译文」字典，因此跳过 i18n:scan 检查。
 */
// @i18n-noscan

import type { SearchEngineId, SearchHistoryEntry, TrendingCache } from "@/shared/types";
import type { CustomSearchEngine } from "@/shared/types/settings";
import type { Locale } from "@/shared/i18n";

export interface SearchEngineOption {
  id: SearchEngineId;
  label: string;
  searchUrl: string;
  iconUrl?: string;
  color: string;
  builtIn?: boolean;
}

/**
 * 内置搜索引擎：覆盖中英文主流引擎；国内用户默认选 Bing（国内可访问且体验最接近 Google）。
 */
const SEARCH_ENGINE_OPTIONS: SearchEngineOption[] = [
  {
    id: "bing",
    label: "Bing",
    searchUrl: "https://www.bing.com/search?q={query}",
    iconUrl: "https://www.bing.com/favicon.ico",
    color: "#008373",
    builtIn: true,
  },
  {
    id: "baidu",
    label: "百度",
    searchUrl: "https://www.baidu.com/s?wd={query}",
    iconUrl: "https://www.baidu.com/favicon.ico",
    color: "#315efb",
    builtIn: true,
  },
  {
    id: "google",
    label: "Google",
    searchUrl: "https://www.google.com/search?q={query}",
    iconUrl: "https://www.google.com/favicon.ico",
    color: "#4285f4",
    builtIn: true,
  },
  {
    id: "duckduckgo",
    label: "DuckDuckGo",
    searchUrl: "https://duckduckgo.com/?q={query}",
    iconUrl: "https://duckduckgo.com/favicon.ico",
    color: "#de5833",
    builtIn: true,
  },
];

/**
 * 热词来源联合类型，需与 UserSettings.hotSuggestionSource 对齐。
 */
export type HotKeywordSource = "off" | "local" | "preset" | "trending";

/**
 * 预设热词表（显式选择 preset 时展示）。
 * 这些是"静态兜底"，不代表当下热榜；默认 local 不再自动退回预设，避免给用户"这是固定写死"的错觉。
 */
const PRESET_HOT_KEYWORDS: Record<Locale, string[]> = {
  "zh-CN": [
    "AI 工具",
    "React 19",
    "TypeScript 6",
    "Chrome 插件",
    "效率工具",
    "前端性能优化",
    "产品设计灵感",
    "网页可访问性",
    "Vite 最佳实践",
    "Figma 组件库",
  ],
  en: [
    "AI tools",
    "React 19",
    "TypeScript 6",
    "Chrome extension",
    "productivity tools",
    "frontend performance",
    "design inspiration",
    "web accessibility",
    "Vite best practices",
    "component library",
  ],
};

/** 最多返回热词个数 */
const MAX_HOT_ITEMS = 8;
const TRENDING_BOARD_PRIORITY = ["weibo", "baidu", "toutiao", "zhihu", "bilihot"];

function normalizeSearchUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed === "") return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.includes("{query}")
    ? withProtocol
    : `${withProtocol}${withProtocol.includes("?") ? "&" : "?"}q={query}`;
}

export function getAllSearchEngineOptions(
  customEngines: CustomSearchEngine[] = [],
): SearchEngineOption[] {
  const customOptions = customEngines
    .filter((item) => item.label.trim() !== "" && item.searchUrl.trim() !== "")
    .map<SearchEngineOption>((item) => ({
      id: item.id,
      label: item.label,
      searchUrl: normalizeSearchUrl(item.searchUrl),
      iconUrl: item.iconUrl,
      color: item.color ?? "#64748b",
      builtIn: false,
    }));
  return [...SEARCH_ENGINE_OPTIONS, ...customOptions];
}

export function normalizeEnabledSearchEngines(
  engineIds: SearchEngineId[] | undefined,
  customEngines: CustomSearchEngine[] = [],
): SearchEngineId[] {
  const allOptions = getAllSearchEngineOptions(customEngines);
  const validIds = new Set<SearchEngineId>(allOptions.map((item) => item.id));
  const normalized = (engineIds ?? []).filter((item) => validIds.has(item));
  return normalized.length > 0 ? normalized : SEARCH_ENGINE_OPTIONS.map((item) => item.id);
}

/**
 * 按 count 降序 + 最近使用时间加权，从历史记录聚合出 Top N 热词。
 *
 * 计分公式：`score = count + recencyBonus`
 * 其中 `recencyBonus`：
 *   - 近 1 天：+5
 *   - 近 7 天：+2
 *   - 近 30 天：+1
 *   - 超过 30 天：0
 * 保证"刚刚搜过"的比"搜过很多次但很久没搜"的优先级高。
 */
function rankHistoryAsHot(entries: SearchHistoryEntry[]): string[] {
  const now = Date.now();
  const DAY = 86_400_000;
  const scored = entries.map((e) => {
    const age = now - e.ts;
    let bonus = 0;
    if (age < 1 * DAY) bonus = 5;
    else if (age < 7 * DAY) bonus = 2;
    else if (age < 30 * DAY) bonus = 1;
    return { query: e.query, score: e.count + bonus };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_HOT_ITEMS).map((e) => e.query);
}

/**
 * 获取指定引擎的配置。
 */
export function getSearchEngineOption(
  engineId: SearchEngineId,
  customEngines: CustomSearchEngine[] = [],
): SearchEngineOption {
  return (
    getAllSearchEngineOptions(customEngines).find((item) => item.id === engineId) ??
    SEARCH_ENGINE_OPTIONS[0]!
  );
}

/**
 * 构造网页搜索 URL。
 */
export function buildSearchUrl(
  engineId: SearchEngineId,
  query: string,
  customEngines: CustomSearchEngine[] = [],
): string {
  return getSearchEngineOption(engineId, customEngines).searchUrl.replace(
    "{query}",
    encodeURIComponent(query.trim()),
  );
}

function resolveTrendingKeywords(cache: TrendingCache | undefined): string[] {
  if (!cache) return [];
  const boards = Object.values(cache.boards);
  const orderedBoards = boards.sort((a, b) => {
    const ai = TRENDING_BOARD_PRIORITY.indexOf(a.id);
    const bi = TRENDING_BOARD_PRIORITY.indexOf(b.id);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  const seen = new Set<string>();
  const keywords: string[] = [];
  orderedBoards.forEach((board) => {
    board.items.forEach((item) => {
      const title = item.title.trim();
      const key = title.toLowerCase();
      if (title === "" || seen.has(key)) return;
      seen.add(key);
      keywords.push(title);
    });
  });
  return keywords.slice(0, MAX_HOT_ITEMS);
}

/**
 * 新版：按 source 获取热词。
 *   - preset：直接返回预设列表
 *   - local：基于 history 聚合；本地历史为空时返回空数组，不展示写死热词
 *   - trending：使用全网热榜缓存
 *   - off：返回空数组
 */
export function resolveHotKeywords(
  source: HotKeywordSource,
  locale: Locale,
  history: SearchHistoryEntry[] = [],
  trendingCache?: TrendingCache,
): string[] {
  if (source === "off") return [];
  if (source === "trending") return resolveTrendingKeywords(trendingCache);
  if (source === "local") {
    if (history.length === 0) return [];
    return rankHistoryAsHot(history);
  }
  // 'preset' 或兜底
  return PRESET_HOT_KEYWORDS[locale] ?? PRESET_HOT_KEYWORDS.en;
}
