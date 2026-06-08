/**
 * StatsCollector + FocusTimeTracker — 标签页激活统计与聚焦时长追踪。
 *
 * - StatsCollector：按 URL × day 聚合 tab 激活次数，每 30s flush 落盘。
 * - FocusTimeTracker：按 URL × day 聚合每日聚焦时长（毫秒），
 *   依赖 chrome.storage.session 保持跨 SW 周期状态。
 *
 * 从 sw/index.ts 抽离以改善可维护性（CODE-01 阶段3）。
 */

import { todayStr } from "@/shared/utils/date";
import { getStats, saveStats, getFocusTime, saveFocusTime, getActiveFocusSession, setActiveFocusSession } from "@/repositories";
import { BRAND } from "@/shared/config/brand";
import { CONFIG } from "@/shared/config";
import type { StatsData, StatsRecord, FocusTimeData, DailyFocusTime } from "@/shared/types";

const SW_LOG_TAG = `${BRAND.logTag} SW`;
const STATS_FLUSH_INTERVAL_MS = CONFIG.performance.statsFlushIntervalMs;
const STATS_RETAIN_DAYS = CONFIG.performance.statsRetainDays;
const MAX_MEMORY_ENTRIES = 5000;

// ── Shared URL normalizer ──
function urlKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString().replace(/\/+$/, "");
  } catch { return url; }
}

// ── StatsCollector ──────────────────────────────────────
interface InMemoryCounts {
  byUrl: Map<string, number>;
  lastFlushAt: number;
  dirty: boolean;
}

const statsMem: InMemoryCounts = { byUrl: new Map(), lastFlushAt: 0, dirty: false };

export function incrementStats(url: string): void {
  if (url === "") return;
  if (statsMem.byUrl.size >= MAX_MEMORY_ENTRIES) return;
  const key = urlKey(url);
  statsMem.byUrl.set(key, (statsMem.byUrl.get(key) ?? 0) + 1);
  statsMem.dirty = true;
}

export async function flushStats(force = false): Promise<void> {
  if (!statsMem.dirty) return;
  if (!force && Date.now() - statsMem.lastFlushAt < STATS_FLUSH_INTERVAL_MS) return;
  const snapshot = new Map(statsMem.byUrl);
  try {
    const existing: StatsData = (await getStats()) ?? { daily: [], lastFlushAt: 0 };
    const today = todayStr();
    let dayRecord = existing.daily.find((r) => r.day === today);
    if (!dayRecord) {
      dayRecord = { day: today, counts: {} };
      existing.daily.push(dayRecord);
    }
    for (const [url, count] of snapshot) dayRecord.counts[url] = (dayRecord.counts[url] ?? 0) + count;
    const cutoff = new Date(Date.now() - STATS_RETAIN_DAYS * 86400_000);
    const cs = `${cutoff.getUTCFullYear()}-${String(cutoff.getUTCMonth() + 1).padStart(2, "0")}-${String(cutoff.getUTCDate()).padStart(2, "0")}`;
    existing.daily = existing.daily.filter((r: StatsRecord) => r.day >= cs);
    existing.lastFlushAt = Date.now();
    await saveStats(existing);
    statsMem.byUrl.clear();
    statsMem.dirty = false;
    statsMem.lastFlushAt = Date.now();
  } catch (err) {
    console.warn(`${SW_LOG_TAG} flushStats failed`, err);
    for (const [url, count] of snapshot) statsMem.byUrl.set(url, (statsMem.byUrl.get(url) ?? 0) + count);
    statsMem.dirty = true;
  }
}

// ── FocusTimeTracker ────────────────────────────────────
interface FocusTimeMem {
  byUrl: Map<string, number>;
  lastFlushAt: number;
  dirty: boolean;
}

const focusTimeMem: FocusTimeMem = { byUrl: new Map(), lastFlushAt: 0, dirty: false };
const FOCUS_TIME_FLUSH_INTERVAL_MS = 30_000;
const FOCUS_TIME_RETAIN_DAYS = 30;

export function incrementFocusTime(url: string, durationMs: number): void {
  if (url === "" || durationMs <= 0) return;
  if (focusTimeMem.byUrl.size >= MAX_MEMORY_ENTRIES) return;
  const key = urlKey(url);
  focusTimeMem.byUrl.set(key, (focusTimeMem.byUrl.get(key) ?? 0) + durationMs);
  focusTimeMem.dirty = true;
}

export async function flushFocusTime(force = false): Promise<void> {
  if (!focusTimeMem.dirty) return;
  if (!force && Date.now() - focusTimeMem.lastFlushAt < FOCUS_TIME_FLUSH_INTERVAL_MS) return;
  const snapshot = new Map(focusTimeMem.byUrl);
  try {
    const existing: FocusTimeData = (await getFocusTime()) ?? { daily: [], lastFlushAt: 0 };
    const today = todayStr();
    let dayRecord = existing.daily.find((r) => r.day === today);
    if (!dayRecord) {
      dayRecord = { day: today, byUrl: {} };
      existing.daily.push(dayRecord);
    }
    for (const [url, ms] of snapshot) dayRecord.byUrl[url] = (dayRecord.byUrl[url] ?? 0) + ms;
    const cutoff = new Date(Date.now() - FOCUS_TIME_RETAIN_DAYS * 86400_000);
    const cs = `${cutoff.getUTCFullYear()}-${String(cutoff.getUTCMonth() + 1).padStart(2, "0")}-${String(cutoff.getUTCDate()).padStart(2, "0")}`;
    existing.daily = existing.daily.filter((r: DailyFocusTime) => r.day >= cs);
    existing.lastFlushAt = Date.now();
    await saveFocusTime(existing);
    focusTimeMem.byUrl.clear();
    focusTimeMem.dirty = false;
    focusTimeMem.lastFlushAt = Date.now();
  } catch (err) {
    console.warn(`${SW_LOG_TAG} flushFocusTime failed`, err);
    for (const [url, ms] of snapshot) focusTimeMem.byUrl.set(url, (focusTimeMem.byUrl.get(url) ?? 0) + ms);
    focusTimeMem.dirty = true;
  }
}

// ── Tab Switch Handler ──────────────────────────────────
/** 处理标签切换：结束上一个会话，开始新会话 */
export async function handleTabSwitch(newTabId: number, newUrl: string): Promise<void> {
  const prev = await getActiveFocusSession();
  const now = Date.now();
  if (prev && prev.url !== newUrl) {
    incrementFocusTime(prev.url, now - prev.activatedAt);
    void flushFocusTime(false);
  }
  await setActiveFocusSession({ tabId: newTabId, url: newUrl, activatedAt: now });
}
