/**
 * Metrics — Local privacy-friendly usage analytics
 * All data stays local, never uploaded
 */

import { getData, setData } from '@/repositories';

const METRICS_KEY = 'canopy_metrics';

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

async function getMetrics(): Promise<Metrics> {
  return (await getData<Metrics>(METRICS_KEY)) || { ...DEFAULT_METRICS };
}

export async function recordMetric(
  key: keyof Metrics,
  increment: number = 1,
): Promise<void> {
  const metrics = await getMetrics();
  const now = Date.now();
  if (!metrics.firstUsedAt) metrics.firstUsedAt = now;
  metrics.lastUsedAt = now;
  if (typeof metrics[key] === 'number') {
    (metrics[key]) += increment;
  }
  await setData(METRICS_KEY, metrics);
}
