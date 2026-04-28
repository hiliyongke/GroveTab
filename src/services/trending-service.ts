/**
 * 热榜聚合数据服务
 *
 * 职责：
 *   1. 单 API 源封装：小尘API（api.xcvts.cn），支持 20+ 平台
 *   2. 本地缓存：通过 chrome.storage.local 缓存榜单数据，30 分钟内直接读缓存
 *   3. 数据标准化：将 API 返回格式统一为 HotBoardData
 */

import { storageGet, storageSet } from '@/chrome';
import type { HotBoardData, TrendingCache, TrendingCategory, TrendingItem } from '@/shared/types';

/** 缓存有效期（毫秒），30 分钟 */
const CACHE_TTL_MS = 30 * 60 * 1000;

/** 存储 key */
const CACHE_KEY = 'canopy_trending_cache';

/** API 基础地址 */
const API_BASE = 'https://api.xcvts.cn/api/hotlist';

/** 请求超时（毫秒） */
const FETCH_TIMEOUT_MS = 8000;

/** 单个平台最多返回的条目数 */
const MAX_ITEMS_PER_BOARD = 20;

// ── 平台配置 ──────────────────────────────────────────

/** 平台元信息 */
interface PlatformMeta {
  /** API type 参数 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 榜单类别 */
  subtitle: string;
  /** 分类标签 */
  category: TrendingCategory;
  /** 平台品牌色 */
  color: string;
  /** 排序权重 */
  order: number;
}

/** 支持的热榜平台列表（仅包含 api.xcvts.cn 实测可用的平台） */
export const PLATFORMS: PlatformMeta[] = [
  // 综合
  { id: 'weibo', name: '微博', subtitle: '热搜榜', category: 'comprehensive', color: '#ff8200', order: 1 },
  { id: 'baidu', name: '百度', subtitle: '热搜榜', category: 'comprehensive', color: '#306cff', order: 2 },
  { id: 'toutiao', name: '今日头条', subtitle: '热榜', category: 'comprehensive', color: '#ff0000', order: 3 },
  { id: 'sogou', name: '搜狗', subtitle: '热搜榜', category: 'comprehensive', color: '#ff6f00', order: 4 },
  // 科技
  { id: 'juejin', name: '稀土掘金', subtitle: '文章榜', category: 'tech', color: '#007fff', order: 5 },
  { id: 'sspai', name: '少数派', subtitle: '热榜', category: 'tech', color: '#d6192b', order: 6 },
  { id: 'csdn', name: 'CSDN', subtitle: '综合热榜', category: 'tech', color: '#fc5531', order: 7 },
  { id: 'github', name: 'GitHub', subtitle: '热门榜', category: 'tech', color: '#24292f', order: 8 },
  { id: '51cto', name: '51CTO', subtitle: '推荐榜', category: 'tech', color: '#c92027', order: 9 },
  // 娱乐
  { id: 'bilihot', name: '哔哩哔哩', subtitle: '热搜榜', category: 'entertainment', color: '#00a1d6', order: 10 },
  { id: 'biliall', name: '哔哩哔哩', subtitle: '全站日榜', category: 'entertainment', color: '#00a1d6', order: 11 },
  { id: 'douyin', name: '抖音', subtitle: '热点榜', category: 'entertainment', color: '#000000', order: 12 },
  { id: 'acfun', name: 'AcFun', subtitle: '热榜', category: 'entertainment', color: '#fd4c5d', order: 13 },
  // 社区
  { id: 'history', name: '历史上的今天', subtitle: '百科', category: 'community', color: '#8B4513', order: 14 },
  // 新闻
  { id: 'ker', name: '安全客', subtitle: '快讯', category: 'tech', color: '#0066ff', order: 10 },
  // 新闻
  { id: 'netease_news', name: '网易新闻', subtitle: '热点榜', category: 'news', color: '#c03828', order: 15 },
  { id: 'sohu', name: '搜狐', subtitle: '热榜新闻', category: 'news', color: '#ff6b00', order: 16 },
  { id: 'ifanr', name: '爱范儿', subtitle: '快讯', category: 'news', color: '#d22222', order: 17 },
];

/** 获取指定分类下的平台列表 */
export function getPlatformsByCategory(category: TrendingCategory): PlatformMeta[] {
  if (category === 'all') return PLATFORMS;
  return PLATFORMS.filter((p) => p.category === category);
}

/** 获取平台品牌色 */
export function getPlatformColor(platformId: string): string {
  return PLATFORMS.find((p) => p.id === platformId)?.color ?? '#1677ff';
}

// ── 数据标准化 ────────────────────────────────────────

/** 格式化热度值 */
function formatHot(hot: number | string | undefined): string {
  if (hot === undefined || hot === '' || hot === 0) return '';
  if (typeof hot === 'string') {
    // 如果已经是 "547.4万" 这种格式，直接返回
    if (hot.includes('万') || hot.includes('亿')) return hot;
    const n = Number(hot);
    if (Number.isNaN(n)) return hot;
    return formatHot(n);
  }
  if (hot >= 100_000_000) return `${(hot / 100_000_000).toFixed(1)}亿`;
  if (hot >= 10_000) return `${(hot / 10_000).toFixed(1)}万`;
  return String(hot);
}

/** 将原始 API 条目标准化为 TrendingItem */
function normalizeItem(raw: Record<string, unknown>): TrendingItem {
  const hotRaw = raw.hot ?? raw.hot_zh ?? raw.heat;
  const hot = typeof hotRaw === 'number' ? hotRaw : undefined;
  const hotLabel = typeof hotRaw === 'string' ? hotRaw : formatHot(hot);

  return {
    id: String(raw.index ?? raw.id ?? ''),
    title: String(raw.title ?? ''),
    desc: raw.desc ? String(raw.desc) : undefined,
    pic: raw.pics ? String(raw.pics) : undefined,
    hot,
    hotLabel,
    url: String(raw.url ?? ''),
    mobileUrl: raw.mobilUrl ? String(raw.mobilUrl) : undefined,
    author: raw.author ? String(raw.author) : undefined,
  };
}

// ── API 请求 ──────────────────────────────────────────

/** 从小尘API获取单个平台的热榜数据 */
async function fetchFromXcvts(platformId: string): Promise<HotBoardData | null> {
  const platform = PLATFORMS.find((p) => p.id === platformId);
  if (!platform) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const resp = await fetch(`${API_BASE}?type=${encodeURIComponent(platformId)}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) return null;

    const json = await resp.json() as {
      success?: boolean;
      msg?: string;
      data?: Record<string, unknown>[];
      title?: string;
      subtitle?: string;
      update_time?: string;
      total?: number;
    };

    if (json.success !== true || !Array.isArray(json.data)) return null;
    if (json.data.length === 0) return null;

    const items = json.data
      .slice(0, MAX_ITEMS_PER_BOARD)
      .map(normalizeItem)
      .filter((item) => item.title !== '');

    return {
      id: platformId,
      name: json.title ?? platform.name,
      subtitle: json.subtitle ?? platform.subtitle,
      category: platform.category,
      items,
      updateTime: json.update_time,
      from: 'xcvts',
    };
  } catch {
    return null;
  }
}

// ── 缓存读写 ──────────────────────────────────────────

/** 读取缓存 */
async function getCache(): Promise<TrendingCache | undefined> {
  return storageGet<TrendingCache>(CACHE_KEY);
}

/** 写入缓存 */
async function setCache(cache: TrendingCache): Promise<void> {
  await storageSet(CACHE_KEY, cache);
}

/** 判断缓存是否过期 */
function isCacheExpired(cache: TrendingCache | undefined): boolean {
  if (cache === undefined) return true;
  return Date.now() - cache.lastRefreshAt > CACHE_TTL_MS;
}

// ── 公开 API ──────────────────────────────────────────

/**
 * 获取单个平台的热榜数据（带缓存）
 *
 * 策略：
 *   1. 缓存未过期 → 直接返回
 *   2. 请求小尘API → 成功则写入缓存并返回
 *   3. 失败 → 返回缓存中的旧数据（如有）或 null
 */
export async function fetchHotBoard(platformId: string): Promise<HotBoardData | null> {
  // 1. 检查缓存
  const cache = await getCache();
  const cached = cache?.boards[platformId];
  if (cached && !isCacheExpired(cache)) {
    return { ...cached, from: 'cache' };
  }

  // 2. 请求 API
  const result = await fetchFromXcvts(platformId);

  // 3. 写入缓存
  if (result !== null) {
    const newCache: TrendingCache = {
      boards: {
        ...(cache?.boards ?? {}),
        [platformId]: result,
      },
      lastRefreshAt: Date.now(),
    };
    await setCache(newCache);
    return result;
  }

  // 4. 失败，返回旧缓存
  return cached ?? null;
}

/**
 * 批量获取多个平台的热榜数据
 *
 * 并发请求，每个平台独立缓存。
 *
 * @param platformIds 平台 ID 列表
 * @param maxConcurrent 最大并发数，默认 4
 */
export async function fetchMultipleBoards(
  platformIds: string[],
  maxConcurrent = 4,
): Promise<Record<string, HotBoardData>> {
  const results: Record<string, HotBoardData> = {};
  const queue = [...platformIds];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const id = queue.shift();
      if (id === undefined) break;

      let data: HotBoardData | null = null;

      // 尝试 API
      data = await fetchFromXcvts(id);

      // 失败时尝试缓存
      if (data === null) {
        const cache = await getCache();
        const cached = cache?.boards[id];
        if (cached) {
          data = { ...cached, from: 'cache' };
        }
      }

      if (data !== null) {
        results[id] = data;
        // 写入缓存
        const cache = await getCache();
        await setCache({
          boards: { ...(cache?.boards ?? {}), [id]: data },
          lastRefreshAt: Date.now(),
        });
      }
    }
  }

  const workers = Array.from({ length: Math.min(maxConcurrent, queue.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

/**
 * 强制刷新指定平台的热榜数据（跳过缓存）
 */
export async function forceRefreshBoard(platformId: string): Promise<HotBoardData | null> {
  const result = await fetchFromXcvts(platformId);

  if (result !== null) {
    const cache = await getCache();
    const newCache: TrendingCache = {
      boards: {
        ...(cache?.boards ?? {}),
        [platformId]: result,
      },
      lastRefreshAt: Date.now(),
    };
    await setCache(newCache);
  }

  return result;
}

/**
 * 清空热榜缓存
 */
export async function clearTrendingCache(): Promise<void> {
  await storageSet(CACHE_KEY, { boards: {}, lastRefreshAt: 0 });
}

/**
 * 获取所有已缓存的榜单数据
 */
export async function getCachedBoards(): Promise<Record<string, HotBoardData>> {
  const cache = await getCache();
  return cache?.boards ?? {};
}
