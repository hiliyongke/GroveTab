/**
 * 搜索引擎与热门关键词配置。
 */

import type { SearchEngineId } from '@/shared/types';
import type { Locale } from '@/shared/i18n';

export interface SearchEngineOption {
  id: SearchEngineId;
  label: string;
  searchUrl: string;
}

export const SEARCH_ENGINE_OPTIONS: SearchEngineOption[] = [
  { id: 'google', label: 'Google', searchUrl: 'https://www.google.com/search?q={query}' },
  { id: 'bing', label: 'Bing', searchUrl: 'https://www.bing.com/search?q={query}' },
  { id: 'baidu', label: '百度', searchUrl: 'https://www.baidu.com/s?wd={query}' },
  { id: 'duckduckgo', label: 'DuckDuckGo', searchUrl: 'https://duckduckgo.com/?q={query}' },
];

const HOT_KEYWORDS: Record<Locale, string[]> = {
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
 * 获取热门关键词列表。
 */
export function getHotKeywords(locale: Locale): string[] {
  return HOT_KEYWORDS[locale] ?? HOT_KEYWORDS.en;
}
