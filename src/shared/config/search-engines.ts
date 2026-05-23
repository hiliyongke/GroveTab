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
 */

import type { SearchEngineId, SearchHistoryEntry, TrendingCache } from '@/shared/types';
import type { CustomSearchEngine } from '@/shared/types/settings';
import type { Locale } from '@/shared/i18n';

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
export const SEARCH_ENGINE_OPTIONS: SearchEngineOption[] = [
  {
    id: 'bing',
    label: 'Bing',
    searchUrl: 'https://www.bing.com/search?q={query}',
    iconUrl: 'https://www.bing.com/favicon.ico',
    color: '#008373',
    builtIn: true,
  },
  {
    id: 'baidu',
    label: '百度',
    searchUrl: 'https://www.baidu.com/s?wd={query}',
    iconUrl: 'https://www.baidu.com/favicon.ico',
    color: '#315efb',
    builtIn: true,
  },
  {
    id: 'google',
    label: 'Google',
    searchUrl: 'https://www.google.com/search?q={query}',
    iconUrl: 'https://www.google.com/favicon.ico',
    color: '#4285f4',
    builtIn: true,
  },
  {
    id: 'duckduckgo',
    label: 'DuckDuckGo',
    searchUrl: 'https://duckduckgo.com/?q={query}',
    iconUrl: 'https://duckduckgo.com/favicon.ico',
    color: '#de5833',
    builtIn: true,
  },
];

/**
 * 热词来源联合类型，需与 UserSettings.hotSuggestionSource 对齐。
 */
export type HotKeywordSource = 'off' | 'local' | 'preset' | 'trending';

/**
 * 预设热词表（显式选择 preset 时展示）。
 * 这些是"静态兜底"，不代表当下热榜；默认 local 不再自动退回预设，避免给用户"这是固定写死"的错觉。
 */
const PRESET_HOT_KEYWORDS: Record<Locale, string[]> = {
  'zh-CN': [
    'AI 工具',
    'React 19',
    'TypeScript 6',
    'Chrome 插件',
    '效率工具',
    '前端性能优化',
    '产品设计灵感',
    '网页可访问性',
    'Vite 最佳实践',
    'Figma 组件库',
  ],
  en: [
    'AI tools',
    'React 19',
    'TypeScript 6',
    'Chrome extension',
    'productivity tools',
    'frontend performance',
    'design inspiration',
    'web accessibility',
    'Vite best practices',
    'component library',
  ],
};

/** 最多返回热词个数 */
const MAX_HOT_ITEMS = 8;
const TRENDING_BOARD_PRIORITY = ['weibo', 'baidu', 'toutiao', 'zhihu', 'bilihot'];

/**
 * 标准化搜索引擎 URL
 *
 * 确保 URL 包含协议头和 {query} 占位符。
 * 如果 URL 没有协议头，自动添加 https://。
 * 如果 URL 不包含 {query}，自动在末尾添加 ?q={query} 或 &q={query}。
 *
 * @param url - 原始搜索引擎 URL
 * @returns 标准化后的 URL（包含 {query} 占位符）
 */
export function normalizeSearchUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed === '') return '';
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.includes('{query}') ? withProtocol : `${withProtocol}${withProtocol.includes('?') ? '&' : '?'}q={query}`;
}

/**
 * 创建自定义搜索引擎配置对象
 *
 * 根据用户输入的标签、搜索 URL 和图标 URL 生成标准化的自定义搜索引擎配置。
 * 会自动生成唯一的 ID（包含 slug 和时间戳）。
 *
 * @param label - 搜索引擎显示名称
 * @param searchUrl - 搜索引擎 URL（会自动标准化）
 * @param iconUrl - 可选的品牌图标 URL
 * @returns 自定义搜索引擎配置对象
 */
export function createCustomSearchEngine(label: string, searchUrl: string, iconUrl?: string): CustomSearchEngine {
  const normalizedLabel = label.trim();
  const normalizedUrl = normalizeSearchUrl(searchUrl);
  const normalizedSlug = normalizedLabel
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const slug = normalizedSlug === '' ? 'engine' : normalizedSlug;
  const normalizedIconUrl = iconUrl?.trim();
  return {
    id: `custom:${slug}-${Date.now()}`,
    label: normalizedLabel,
    searchUrl: normalizedUrl,
    iconUrl: normalizedIconUrl === '' ? undefined : normalizedIconUrl,
    color: '#64748b',
  };
}

/**
 * 获取所有搜索引擎选项列表（内置 + 自定义）
 *
 * 将内置搜索引擎和用户自定义搜索引擎合并，返回统一的选项列表。
 * 自定义引擎会转换为 SearchEngineOption 格式。
 *
 * @param customEngines - 用户自定义搜索引擎数组
 * @returns 所有搜索引擎选项列表
 */
export function getAllSearchEngineOptions(customEngines: CustomSearchEngine[] = []): SearchEngineOption[] {
  const customOptions = customEngines
    .filter((item) => item.label.trim() !== '' && item.searchUrl.trim() !== '')
    .map<SearchEngineOption>((item) => ({
      id: item.id,
      label: item.label,
      searchUrl: normalizeSearchUrl(item.searchUrl),
      iconUrl: item.iconUrl,
      color: item.color ?? '#64748b',
      builtIn: false,
    }));
  return [...SEARCH_ENGINE_OPTIONS, ...customOptions];
}

/**
 * 标准化已启用的搜索引擎 ID 列表
 *
 * 过滤掉无效的搜索引擎 ID，确保返回的列表都是当前可用的引擎。
 * 如果输入为空或过滤后为空，返回默认的内置搜索引擎 ID 列表。
 *
 * @param engineIds - 用户设置的已启用搜索引擎 ID 列表（可能未定义）
 * @param customEngines - 用户自定义搜索引擎数组
 * @returns 标准化后的搜索引擎 ID 列表
 */
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
 *
 * @param entries 搜索历史记录数组
 * @returns 热词字符串数组（最多 MAX_HOT_ITEMS 条）
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
 * 获取指定搜索引擎的配置对象
 *
 * 根据引擎 ID 查找对应的配置，如果找不到则返回默认的第一个内置引擎。
 *
 * @param engineId - 搜索引擎 ID
 * @param customEngines - 用户自定义搜索引擎数组
 * @returns 搜索引擎配置对象
 */
export function getSearchEngineOption(
  engineId: SearchEngineId,
  customEngines: CustomSearchEngine[] = [],
): SearchEngineOption {
  return getAllSearchEngineOptions(customEngines).find((item) => item.id === engineId) ?? SEARCH_ENGINE_OPTIONS[0]!;
}

/**
 * 构造网页搜索 URL
 *
 * 根据指定的搜索引擎 ID 和查询关键词，构造完整的搜索 URL。
 * 会自动对查询关键词进行 URL 编码。
 *
 * @param engineId - 搜索引擎 ID
 * @param query - 用户搜索关键词
 * @param customEngines - 用户自定义搜索引擎数组
 * @returns 完整的搜索 URL
 */
export function buildSearchUrl(engineId: SearchEngineId, query: string, customEngines: CustomSearchEngine[] = []): string {
  return getSearchEngineOption(engineId, customEngines).searchUrl.replace('{query}', encodeURIComponent(query.trim()));
}

/**
 * 从热榜缓存中解析出热词列表
 *
 * 按优先级排序各个热榜来源（微博 > 百度 > 头条 > 知乎 > B站），
 * 去重后返回前 N 条热词。
 *
 * @param cache - 热榜缓存对象（可能未定义）
 * @returns 热词字符串数组（最多 MAX_HOT_ITEMS 条）
 */
export function resolveTrendingKeywords(cache: TrendingCache | undefined): string[] {
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
      if (title === '' || seen.has(key)) return;
      seen.add(key);
      keywords.push(title);
    });
  });
  return keywords.slice(0, MAX_HOT_ITEMS);
}

/**
 * 新版：按 source 获取热词。
 *
 *   - preset：直接返回预设列表
 *   - local：基于 history 聚合；本地历史为空时返回空数组，不展示写死热词
 *   - trending：使用全网热榜缓存
 *   - off：返回空数组
 *
 * @param source 热词来源（'off' | 'local' | 'preset' | 'trending'）
 * @param locale 当前语言
 * @param history 搜索历史记录数组
 * @param trendingCache 热榜缓存对象
 * @returns 热词字符串数组
 */
export function resolveHotKeywords(
  source: HotKeywordSource,
  locale: Locale,
  history: SearchHistoryEntry[] = [],
  trendingCache?: TrendingCache,
): string[] {
  if (source === 'off') return [];
  if (source === 'trending') return resolveTrendingKeywords(trendingCache);
  if (source === 'local') {
    if (history.length === 0) return [];
    return rankHistoryAsHot(history);
  }
  // 'preset' 或兜底
  return PRESET_HOT_KEYWORDS[locale] ?? PRESET_HOT_KEYWORDS.en;
}
