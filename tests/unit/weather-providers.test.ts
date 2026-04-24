/**
 * weather-providers fallback chain · v1.3 单测
 *
 * 用 vi.stubGlobal 模拟 fetch：
 *  - wttr 返回 500 → 降级到 open-meteo
 *  - 所有源都挂 → 抛 AggregateError
 *  - wttr 正常 → 直接返回、不触发 open-meteo
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWeatherWithFallback } from '../../src/features/hero-widgets/weather-providers';

function mockFetchSequence(
  handlers: Array<(url: string) => Response | Promise<Response>>,
) {
  let idx = 0;
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const h = handlers[idx++];
    if (!h) throw new Error(`unexpected fetch call #${idx}: ${url}`);
    return await h(url);
  });
}

function okJson(payload: unknown): Response {
  return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

describe('fetchWeatherWithFallback', () => {
  let originalFetch: typeof fetch | undefined;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    if (originalFetch) globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('wttr 成功时直接返回，不触发 open-meteo', async () => {
    const fetchMock = mockFetchSequence([
      () =>
        okJson({
          current_condition: [{ temp_C: '22', lang_zh: [{ value: '晴' }] }],
          nearest_area: [{ areaName: [{ value: '上海' }] }],
        }),
    ]);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const snap = await fetchWeatherWithFallback('manual', '上海', 'c', new AbortController().signal);
    expect(snap.temp).toBe(22);
    expect(snap.cityLabel).toBe('上海');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('wttr 失败 → 降级到 open-meteo（geo + forecast）', async () => {
    const fetchMock = mockFetchSequence([
      // 1. wttr 500
      () => new Response('server error', { status: 500 }),
      // 2. geocoding
      () => okJson({ results: [{ latitude: 31.2, longitude: 121.5, name: 'Shanghai' }] }),
      // 3. open-meteo forecast
      () => okJson({ current: { temperature_2m: 18.3, weather_code: 3 } }),
    ]);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const snap = await fetchWeatherWithFallback('manual', 'Shanghai', 'c', new AbortController().signal);
    expect(snap.temp).toBe(18);
    expect(snap.cityLabel).toBe('Shanghai');
    expect(snap.desc).toBe('多云');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('所有源都挂：抛 AggregateError', async () => {
    const fetchMock = mockFetchSequence([
      () => new Response('x', { status: 500 }),
      () => new Response('x', { status: 500 }),
    ]);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      fetchWeatherWithFallback('manual', 'nowhere', 'c', new AbortController().signal),
    ).rejects.toThrow();
  });
});
