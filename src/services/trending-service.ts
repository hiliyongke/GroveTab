/**
 * 热榜聚合数据服务
 *
 * 职责：
 *   1. 多源路由：主源（小尘API）失败自动切换备用源（DailyHot），最终降级到 OPFS 本地缓存
 *   2. 本地缓存：通过 chrome.storage.local 缓存榜单数据，30 分钟内直接读缓存
 *   3. 数据标准化：将 API 返回格式统一为 HotBoardData
 *   4. 兴趣信号：记录点击/收藏行为，调整内容排序权重
 */

import { storageGet, storageSet } from "@/chrome";
import { opfsRead, opfsWrite } from "@/shared/utils/opfs-storage";
import type { HotBoardData, TrendingCache, TrendingCategory, TrendingItem } from "@/shared/types";
import { STORAGE_KEYS } from "@/shared/config/storage-keys";

/** 存储 key */
const CACHE_KEY = STORAGE_KEYS.trendingCache;

/** 主源 API 基础地址（小尘API） */
const API_BASE_XCVTS = "https://api.xcvts.cn/api/hotlist";

/** 备用源 API 基础地址（DailyHot） */
const API_BASE_DAILYHOT = "https://dailyhot-api.vercel.app";

/** 请求超时（毫秒） */
const FETCH_TIMEOUT_MS = 8000;

/** 缓存新鲜度阈值（毫秒），30 分钟内视为有效 */
const CACHE_FRESHNESS_MS = 30 * 60 * 1000;

/** 单个平台最多返回的条目数 */
const MAX_ITEMS_PER_BOARD = 20;

/** OPFS 缓存文件名 */
const OPFS_CACHE_FILE = "trending-cache.json";

/** 兴趣信号存储 key */
const INTEREST_KEY = STORAGE_KEYS.trendingInterest ?? "trending_interest_signals";

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
const PLATFORMS: PlatformMeta[] = [
  // 综合
  {
    id: "weibo",
    name: "微博",
    subtitle: "热搜榜",
    category: "comprehensive",
    color: "#ff8200",
    order: 1,
  },
  {
    id: "baidu",
    name: "百度",
    subtitle: "热搜榜",
    category: "comprehensive",
    color: "#306cff",
    order: 2,
  },
  {
    id: "toutiao",
    name: "今日头条",
    subtitle: "热榜",
    category: "comprehensive",
    color: "#ff0000",
    order: 3,
  },
  {
    id: "sogou",
    name: "搜狗",
    subtitle: "热搜榜",
    category: "comprehensive",
    color: "#ff6f00",
    order: 4,
  },
  // 科技
  {
    id: "juejin",
    name: "稀土掘金",
    subtitle: "文章榜",
    category: "tech",
    color: "#007fff",
    order: 5,
  },
  { id: "sspai", name: "少数派", subtitle: "热榜", category: "tech", color: "#d6192b", order: 6 },
  { id: "csdn", name: "CSDN", subtitle: "综合热榜", category: "tech", color: "#fc5531", order: 7 },
  {
    id: "github",
    name: "GitHub",
    subtitle: "热门榜",
    category: "tech",
    color: "#24292f",
    order: 8,
  },
  { id: "51cto", name: "51CTO", subtitle: "推荐榜", category: "tech", color: "#c92027", order: 9 },
  // 娱乐
  {
    id: "bilihot",
    name: "哔哩哔哩",
    subtitle: "热搜榜",
    category: "entertainment",
    color: "#00a1d6",
    order: 10,
  },
  {
    id: "biliall",
    name: "哔哩哔哩",
    subtitle: "全站日榜",
    category: "entertainment",
    color: "#00a1d6",
    order: 11,
  },
  {
    id: "douyin",
    name: "抖音",
    subtitle: "热点榜",
    category: "entertainment",
    color: "#000000",
    order: 12,
  },
  {
    id: "acfun",
    name: "AcFun",
    subtitle: "热榜",
    category: "entertainment",
    color: "#fd4c5d",
    order: 13,
  },
  // 社区
  {
    id: "history",
    name: "历史上的今天",
    subtitle: "百科",
    category: "community",
    color: "#8B4513",
    order: 14,
  },
  // 新闻
  { id: "ker", name: "安全客", subtitle: "快讯", category: "tech", color: "#0066ff", order: 10 },
  // 新闻
  {
    id: "netease_news",
    name: "网易新闻",
    subtitle: "热点榜",
    category: "news",
    color: "#c03828",
    order: 15,
  },
  { id: "sohu", name: "搜狐", subtitle: "热榜新闻", category: "news", color: "#ff6b00", order: 16 },
  { id: "ifanr", name: "爱范儿", subtitle: "快讯", category: "news", color: "#d22222", order: 17 },
];

/** 获取指定分类下的平台列表 */
export function getPlatformsByCategory(category: TrendingCategory): PlatformMeta[] {
  if (category === "all") return PLATFORMS;
  return PLATFORMS.filter((p) => p.category === category);
}

/** 获取平台品牌色 */
export function getPlatformColor(platformId: string): string {
  return PLATFORMS.find((p) => p.id === platformId)?.color ?? "#1677ff";
}

// ── 数据标准化 ────────────────────────────────────────

/** 格式化热度值 */
function formatHot(hot: number | string | undefined): string {
  if (hot === undefined || hot === "" || hot === 0) return "";
  if (typeof hot === "string") {
    // 如果已经是 "547.4万" 这种格式，直接返回
    if (hot.includes("万") || hot.includes("亿")) return hot;
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
  const hot = typeof hotRaw === "number" ? hotRaw : undefined;
  const hotLabel = typeof hotRaw === "string" ? hotRaw : formatHot(hot);

  return {
    id: String(raw.index ?? raw.id ?? ""),
    title: String(raw.title ?? ""),
    desc: raw.desc ? String(raw.desc) : undefined,
    pic: raw.pics ? String(raw.pics) : undefined,
    hot,
    hotLabel,
    url: String(raw.url ?? ""),
    mobileUrl: raw.mobilUrl ? String(raw.mobilUrl) : undefined,
    author: raw.author ? String(raw.author) : undefined,
  };
}

// ── API 请求 ──────────────────────────────────────────

/** 从小尘API获取单个平台的热榜数据（主源） */
async function fetchFromXcvts(platformId: string): Promise<HotBoardData | null> {
  const platform = PLATFORMS.find((p) => p.id === platformId);
  if (!platform) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const resp = await fetch(`${API_BASE_XCVTS}?type=${encodeURIComponent(platformId)}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) return null;

    const json = (await resp.json()) as {
      success?: boolean;
      msg?: string;
      data?: Array<Record<string, unknown>>;
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
      .filter((item) => item.title !== "");

    return {
      id: platformId,
      name: json.title ?? platform.name,
      subtitle: json.subtitle ?? platform.subtitle,
      category: platform.category,
      items,
      updateTime: json.update_time,
      from: "xcvts",
    };
  } catch {
    return null;
  }
}

/**
 * 从 DailyHot 备用源获取单个平台的热榜数据
 * DailyHot API 路径格式：/{platformId}
 */
async function fetchFromDailyhot(platformId: string): Promise<HotBoardData | null> {
  const platform = PLATFORMS.find((p) => p.id === platformId);
  if (!platform) return null;

  // DailyHot 平台 ID 映射（部分平台名称不同）
  const DAILYHOT_ID_MAP: Record<string, string> = {
    bilihot: "bilibili",
    biliall: "bilibili-all",
    netease_news: "netease",
    "51cto": "51cto",
  };
  const dhId = DAILYHOT_ID_MAP[platformId] ?? platformId;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const resp = await fetch(`${API_BASE_DAILYHOT}/${encodeURIComponent(dhId)}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) return null;

    const json = (await resp.json()) as {
      code?: number;
      message?: string;
      data?: Array<Record<string, unknown>>;
      name?: string;
      title?: string;
      updateTime?: string;
    };

    const rawData = json.data;
    if (!Array.isArray(rawData) || rawData.length === 0) return null;

    const items = rawData
      .slice(0, MAX_ITEMS_PER_BOARD)
      .map(
        (raw) =>
          ({
            id: String(raw.id ?? raw.index ?? ""),
            title: String(raw.title ?? raw.desc ?? ""),
            desc: raw.desc ? String(raw.desc) : undefined,
            hot: typeof raw.hot === "number" ? raw.hot : undefined,
            hotLabel: typeof raw.hot === "string" ? raw.hot : undefined,
            url: String(raw.url ?? raw.mobUrl ?? ""),
            mobileUrl: raw.mobUrl ? String(raw.mobUrl) : undefined,
          }) satisfies TrendingItem,
      )
      .filter((item) => item.title !== "" && item.url !== "");

    if (items.length === 0) return null;

    return {
      id: platformId,
      name: json.name ?? json.title ?? platform.name,
      subtitle: platform.subtitle,
      category: platform.category,
      items,
      updateTime: json.updateTime,
      from: "pearktrue",
    };
  } catch {
    return null;
  }
}

/**
 * 从 OPFS 本地缓存读取热榜数据（最终降级）
 */
async function fetchFromOPFS(platformId: string): Promise<HotBoardData | null> {
  try {
    const raw = await opfsRead<TrendingCache>(OPFS_CACHE_FILE);
    if (!raw?.boards?.[platformId]) return null;
    return { ...raw.boards[platformId], from: "cache" };
  } catch {
    return null;
  }
}

/**
 * 将热榜缓存写入 OPFS（异步，不阻塞主流程）
 */
function persistToOPFS(cache: TrendingCache): void {
  void (async () => {
    try {
      await opfsWrite(OPFS_CACHE_FILE, cache);
    } catch {
      // 静默失败，OPFS 写入不影响主流程
    }
  })();
}

// ── 缓存读写 ──────────────────────────────────────────

/** 读取缓存 */
async function getCache(): Promise<TrendingCache | undefined> {
  return storageGet<TrendingCache>(CACHE_KEY);
}

/** 检查缓存是否仍然新鲜。 */
function isCacheFresh(cache: TrendingCache | undefined): boolean {
  if (!cache?.lastRefreshAt) return false;
  return Date.now() - cache.lastRefreshAt < CACHE_FRESHNESS_MS;
}

/** 写入缓存（同时持久化到 OPFS） */
async function setCache(cache: TrendingCache): Promise<void> {
  await storageSet(CACHE_KEY, cache);
  persistToOPFS(cache);
}

// ── 兴趣信号 ──────────────────────────────────────────

/** 兴趣信号记录 */
export interface InterestSignal {
  /** 条目 URL */
  url: string;
  /** 点击次数 */
  clicks: number;
  /** 收藏次数 */
  saves: number;
  /** 最近交互时间 */
  lastAt: number;
}

/** 读取兴趣信号表 */
export async function getInterestSignals(): Promise<Record<string, InterestSignal>> {
  return (await storageGet<Record<string, InterestSignal>>(INTEREST_KEY)) ?? {};
}

/**
 * 记录一次兴趣信号
 * @param url 条目 URL
 * @param type 'click' | 'save'
 */
export async function recordInterestSignal(url: string, type: "click" | "save"): Promise<void> {
  const signals = await getInterestSignals();
  const existing = signals[url] ?? { url, clicks: 0, saves: 0, lastAt: 0 };
  if (type === "click") existing.clicks += 1;
  else existing.saves += 1;
  existing.lastAt = Date.now();
  signals[url] = existing;
  await storageSet(INTEREST_KEY, signals);
}

/**
 * 根据兴趣信号对榜单条目重新排序
 * 权重公式：原始排名分 + 点击×2 + 收藏×5（越高越靠前）
 */
export function applyInterestWeights(
  items: TrendingItem[],
  signals: Record<string, InterestSignal>,
): TrendingItem[] {
  if (Object.keys(signals).length === 0) return items;
  const total = items.length;
  return [...items]
    .map((item, idx) => {
      const sig = signals[item.url];
      const baseScore = total - idx; // 原始排名分（第1名得 total 分）
      const bonus = sig ? sig.clicks * 2 + sig.saves * 5 : 0;
      return { item, score: baseScore + bonus };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}

// ── 公开 API ──────────────────────────────────────────

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

      // 第一优先：主源（小尘API）
      data = await fetchFromXcvts(id);

      // 第二优先：备用源（DailyHot）
      if (data === null) {
        data = await fetchFromDailyhot(id);
      }

      // 第三优先：chrome.storage.local 缓存（仅新鲜时使用）
      if (data === null) {
        const cache = await getCache();
        if (isCacheFresh(cache)) {
          const cached = cache?.boards[id];
          if (cached) {
            data = { ...cached, from: "cache" };
          }
        }
      }

      // 最终降级：OPFS 本地缓存（过期缓存也接受，避免空白）
      if (data === null) {
        const cache = await getCache();
        const expiredCached = cache?.boards[id];
        if (expiredCached) {
          data = { ...expiredCached, from: "cache" };
        } else {
          data = await fetchFromOPFS(id);
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
