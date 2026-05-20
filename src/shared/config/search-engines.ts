/**
 * 搜索引擎与热门关键词配置。
 *
 * 热词来源由 `settings.hotSuggestionSource` 控制：
 *   - 'off'       ：不显示热词
 *   - 'local'     ：基于用户本地搜索历史聚合（默认，零请求）
 *   - 'preset'    ：静态预设列表（旧行为保留，作为 local 为空时的兜底）
 *   - 'trending'  ：可选公开热榜（目前未启用，占位）
 *
 * 所有数据源都不强制联网，国内环境默认 off / local 即可。
 */

import type { SearchEngineId, SearchHistoryEntry } from '@/shared/types';
import type { Locale } from '@/shared/i18n';

export interface SearchEngineOption {
  id: SearchEngineId;
  label: string;
  searchUrl: string;
}

/**
 * 内置搜索引擎：覆盖中英文主流引擎；国内用户默认选 Bing（国内可访问且体验最接近 Google）。
 */
export const SEARCH_ENGINE_OPTIONS: SearchEngineOption[] = [
  { id: 'bing', label: 'Bing', searchUrl: 'https://www.bing.com/search?q={query}' },
  { id: 'baidu', label: '百度', searchUrl: 'https://www.baidu.com/s?wd={query}' },
  { id: 'google', label: 'Google', searchUrl: 'https://www.google.com/search?q={query}' },
  { id: 'duckduckgo', label: 'DuckDuckGo', searchUrl: 'https://duckduckgo.com/?q={query}' },
];

/**
 * 热词来源联合类型，需与 UserSettings.hotSuggestionSource 对齐。
 */
export type HotKeywordSource = 'off' | 'local' | 'preset' | 'trending';

/**
 * 预设热词表（兜底）——无本地历史/未开启时才展示。
 * 这些是"静态兜底"，不代表当下热榜；避免给用户"这是固定写死"的错觉。
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
export function getSearchEngineOption(engineId: SearchEngineId): SearchEngineOption {
  return SEARCH_ENGINE_OPTIONS.find((item) => item.id === engineId) ?? SEARCH_ENGINE_OPTIONS[0];
}

/**
 * 构造网页搜索 URL。
 */
export function buildSearchUrl(engineId: SearchEngineId, query: string): string {
  return getSearchEngineOption(engineId).searchUrl.replace('{query}', encodeURIComponent(query.trim()));
}

/**
 * 新版：按 source 获取热词。
 *   - preset：直接返回预设列表
 *   - local：调用者需传入 history，本函数按频次+时效聚合
 *   - off / trending：返回空数组（trending 占位，未来接入公开热榜时扩展）
 */
export function resolveHotKeywords(
  source: HotKeywordSource,
  locale: Locale,
  history: SearchHistoryEntry[] = [],
): string[] {
  if (source === 'off') return [];
  if (source === 'trending') return [];
  if (source === 'local') {
    if (history.length === 0) return [];
    return rankHistoryAsHot(history);
  }
  // 'preset' 或兜底
  return PRESET_HOT_KEYWORDS[locale] ?? PRESET_HOT_KEYWORDS.en;
}


