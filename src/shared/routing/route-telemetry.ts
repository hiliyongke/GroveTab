/**
 * 路由埋点模块
 *
 * UX-P0-14：路由切换时上报埋点
 *   - dev mode：写入 console.info（方便调试）
 *   - prod mode：写入 chrome.storage.local 本地统计
 *
 * 统计维度：
 *   - 路由切换次数（按 space/view/panel 分组）
 *   - 最后访问时间
 *   - 平均停留时长（仅 prod）
 */

import type { RouteChangeEvent, RouteDescriptor } from "./hash-router";
import { getStorageLocal, setStorageLocal, removeStorageLocal } from "@/chrome/storage";

// ── 类型 ──────────────────────────────────────────────────────────────────────

interface RouteStatEntry {
  /** 累计访问次数 */
  count: number;
  /** 最后访问时间（ISO 8601） */
  lastVisitedAt: string;
  /** 首次访问时间 */
  firstVisitedAt: string;
}

type RouteStats = Record<string, RouteStatEntry>;

// ── 常量 ──────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "route_stats";
const MAX_ENTRIES = 200; // 最多保留 200 条统计

// ── 工具函数 ──────────────────────────────────────────────────────────────────

/** 将 RouteDescriptor 序列化为统计 key */
function routeToStatKey(route: RouteDescriptor): string {
  const parts = [route.spaceId];
  if (route.viewId) parts.push(`v:${route.viewId}`);
  if (route.panelId) parts.push(`p:${route.panelId}`);
  if (route.subId) parts.push(`s:${route.subId}`);
  return parts.join("/");
}

// ── Dev Mode 埋点 ─────────────────────────────────────────────────────────────

function logDevTelemetry(event: RouteChangeEvent): void {
  const from = event.previous
    ? `${event.previous.spaceId}${event.previous.viewId ? `/${event.previous.viewId}` : ""}${event.previous.panelId ? `/${event.previous.panelId}` : ""}`
    : "(init)";
  const to = `${event.route.spaceId}${event.route.viewId ? `/${event.route.viewId}` : ""}${event.route.panelId ? `/${event.route.panelId}` : ""}`;
  const src = event.source;

  console.info(`[RouteTelemetry] ${from} → ${to} (${src})`);
}

// ── Prod Mode 埋点 ────────────────────────────────────────────────────────────

async function persistStats(route: RouteDescriptor): Promise<void> {
  try {
    const key = routeToStatKey(route);
    const now = new Date().toISOString();

    // 读取现有统计
    const stored = await getStorageLocal(STORAGE_KEY);
    const stats: RouteStats = (stored[STORAGE_KEY] as RouteStats) ?? {};

    // 更新条目
    if (stats[key]) {
      stats[key].count++;
      stats[key].lastVisitedAt = now;
    } else {
      stats[key] = {
        count: 1,
        lastVisitedAt: now,
        firstVisitedAt: now,
      };
    }

    // 淘汰最旧的条目（保留 MAX_ENTRIES 条）
    const entries = Object.entries(stats);
    if (entries.length > MAX_ENTRIES) {
      entries.sort((a, b) => a[1].lastVisitedAt.localeCompare(b[1].lastVisitedAt));
      const toRemove = entries.slice(0, entries.length - MAX_ENTRIES);
      for (const [k] of toRemove) {
        delete stats[k];
      }
    }

    await setStorageLocal({ [STORAGE_KEY]: stats });
  } catch {
    // 静默失败，不影响路由功能
  }
}

// ── 公共 API ──────────────────────────────────────────────────────────────────

/**
 * 处理路由变更事件（由 use-url-sync 调用）
 */
export function handleRouteTelemetry(event: RouteChangeEvent): void {
  // Dev mode：console 日志
  if (import.meta.env.DEV) {
    logDevTelemetry(event);
  }

  // Prod mode：持久化统计
  if (!import.meta.env.DEV) {
    void persistStats(event.route);
  }
}

/**
 * 获取路由统计（用于 Insights 面板等）
 */
export async function getRouteStats(): Promise<RouteStats> {
  try {
    const stored = await getStorageLocal(STORAGE_KEY);
    return (stored[STORAGE_KEY] as RouteStats) ?? {};
  } catch {
    return {};
  }
}

/**
 * 清除路由统计
 */
export async function clearRouteStats(): Promise<void> {
  try {
    await removeStorageLocal(STORAGE_KEY);
  } catch {
    // 静默失败
  }
}
