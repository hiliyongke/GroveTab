/**
 * Trending Cache Refresh — 后台静默刷新热榜缓存。
 *
 * 仅当存在缓存（说明用户使用过热榜功能）时才刷新，
 * 避免从未用过热榜的用户产生不必要的网络请求。
 *
 * 从 sw/index.ts 抽离以改善可维护性（CODE-01）。
 */

import { STORAGE_KEYS } from "@/shared/config/storage-keys";

export async function refreshTrendingCache(): Promise<void> {
  try {
    const { storageGet, storageSet } = await import("@/chrome");
    const cache = await storageGet<Record<string, unknown>>(STORAGE_KEYS.trendingCache);
    if (!cache?.boards || typeof cache.boards !== "object") return;

    const boards = cache.boards as Record<string, Record<string, unknown>>;
    const boardIds = Object.keys(boards);
    if (boardIds.length === 0) return;

    const FETCH_TIMEOUT_MS = 6000;
    const MAX_ITEMS = 20;
    const API_BASE = "https://api.xcvts.cn/api/hotlist";
    const STAGGER_MS = 500;

    for (const boardId of boardIds) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        const resp = await fetch(`${API_BASE}?type=${encodeURIComponent(boardId)}`, {
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (resp.status === 429) break;
        if (!resp.ok) continue;

        const json = (await resp.json()) as {
          success?: boolean;
          data?: Array<Record<string, unknown>>;
          title?: string;
          subtitle?: string;
          update_time?: string;
        };

        if (json.success !== true || !Array.isArray(json.data)) continue;
        if (json.data.length === 0) continue;

        const items = json.data.slice(0, MAX_ITEMS).map((raw) => ({
          id: String(raw.index ?? raw.id ?? ""),
          title: String(raw.title ?? ""),
          desc: raw.desc ? String(raw.desc) : undefined,
          pic: raw.pics ? String(raw.pics) : undefined,
          hot: typeof raw.hot === "number" ? raw.hot : undefined,
          hotLabel: typeof raw.hot === "string" ? raw.hot : undefined,
          url: String(raw.url ?? ""),
          mobileUrl: raw.mobilUrl ? String(raw.mobilUrl) : undefined,
        })).filter((item) => item.title !== "");

        (cache.boards as Record<string, unknown>)[boardId] = {
          ...(boards[boardId] ?? {}),
          items,
          updateTime: json.update_time,
          from: "xcvts",
        };

        await new Promise((r) => setTimeout(r, STAGGER_MS));
      } catch { /* 单平台失败不影响其他 */ }
    }

    cache.lastRefreshAt = Date.now();
    await storageSet(STORAGE_KEYS.trendingCache, cache);
  } catch (err) {
    console.warn("[GroveTab SW] trending cache refresh failed", err);
  }
}
