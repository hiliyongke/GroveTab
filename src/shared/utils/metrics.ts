/**
 * Metrics — 本地隐私友好的使用分析。
 */

import { getData, setData } from '@/repositories';
import type { MetricEvent } from '@/shared/types';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';

const METRICS_KEY = STORAGE_KEYS.metrics;

export interface Metrics {
  newtabOpens: number;
  archivesCreated: number;
  tabsClosed: number;
  searchesPerformed: number;
  firstUsedAt: number;
  lastUsedAt: number;
}

const DEFAULT_METRICS: Metrics = {
  newtabOpens: 0,
  archivesCreated: 0,
  tabsClosed: 0,
  searchesPerformed: 0,
  firstUsedAt: 0,
  lastUsedAt: 0,
};

async function getCounters(): Promise<Metrics> {
  return (await getData<Metrics>(STORAGE_KEYS.metricCounters)) ?? { ...DEFAULT_METRICS };
}

/**
 * 旧版累加计数器（保持兼容）。
 */
export async function recordMetric(
  key: keyof Metrics,
  increment = 1,
): Promise<void> {
  try {
    const metrics = await getCounters();
    const now = Date.now();
    if (metrics.firstUsedAt === 0) metrics.firstUsedAt = now;
    metrics.lastUsedAt = now;
    if (typeof metrics[key] === 'number') {
      (metrics[key]) += increment;
    }
    await setData(STORAGE_KEYS.metricCounters, metrics);
  } catch {
    // metrics 永远不应阻塞主流程
  }
  // 同时写入事件流，便于 InsightsView 展示
  void track(String(key), { increment });
}

const MAX_EVENTS = 2000;

/** 事件型埋点，按时间追加，最多 2000 条，本地存储。 */
export async function track(event: string, payload?: Record<string, unknown>): Promise<void> {
  try {
    const list = (await getData<MetricEvent[]>(METRICS_KEY)) ?? [];
    list.push({ event, ts: Date.now(), payload });
    if (list.length > MAX_EVENTS) list.splice(0, list.length - MAX_EVENTS);
    await setData(METRICS_KEY, list);
  } catch {
    // 静默失败
  }
}

/**
 * FCP 采样：在页面就绪时调用一次（首次调用生效），写入 perf_fcp 事件。
 */
export function recordFcpOnce(): void {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return;
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          void track('perf_fcp', { ms: Math.round(entry.startTime) });
          observer.disconnect();
          return;
        }
      }
    });
    observer.observe({ type: 'paint', buffered: true });
  } catch {
    // 部分环境下 PerformanceObserver 缺失
  }
}

/**
 * FPS 采样：按 10s 窗口统计 p50 / p95，写入 perf_fps_sample 事件。
 * 仅采样一次（避免持续增加 CPU 开销）。
 */
export function recordFpsSampleOnce(): void {
  if (typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined') return;
  const frameTimes: number[] = [];
  let last = performance.now();
  const start = last;
  let stopped = false;

  function frame(now: number) {
    if (stopped) return;
    frameTimes.push(now - last);
    last = now;
    if (now - start >= 10_000) {
      stopped = true;
      const fps = frameTimes.map((d) => 1000 / d).sort((a, b) => a - b);
      const p50 = fps[Math.floor(fps.length * 0.5)] ?? 0;
      const p95 = fps[Math.floor(fps.length * 0.95)] ?? 0;
      void track('perf_fps_sample', {
        p50: Math.round(p50),
        p95: Math.round(p95),
        samples: fps.length,
      });
      return;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
