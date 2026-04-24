/**
 * weather-providers · v1.3
 *
 * 把 WeatherWidget 的数据源抽成独立的 provider 函数链，
 * 便于：
 *  - 多源 fallback（wttr.in → open-meteo → geo-only）
 *  - 单元测试独立 mock
 *  - 后续新增源（和风 / 彩云…）只需 append 一个 provider
 */

/** 展示层快照 —— 所有 provider 必须归一化到此结构 */
export interface WeatherSnapshot {
  cityLabel: string;
  temp: number;
  desc: string;
  icon: string;
}

const REQUEST_TIMEOUT_MS = 5_000;

/** 带超时的 fetch（复用 AbortController 两层叠加） */
async function timedFetch(url: string, signal: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  signal.addEventListener('abort', () => controller.abort());
  try {
    return await fetch(url, { signal: controller.signal, mode: 'cors' });
  } finally {
    clearTimeout(timer);
  }
}

/** 描述 → emoji 映射（跨源共用） */
function mapDescToIcon(desc: string): string {
  const d = desc.toLowerCase();
  if (d.includes('sunny') || d.includes('clear') || d.includes('晴')) return '☀️';
  if (d.includes('cloud') || d.includes('云')) return '☁️';
  if (d.includes('rain') || d.includes('雨')) return '🌧️';
  if (d.includes('snow') || d.includes('雪')) return '❄️';
  if (d.includes('fog') || d.includes('haze') || d.includes('雾') || d.includes('霾')) return '🌫️';
  return '🌤️';
}

/** ─── Provider A：wttr.in ───
 * 国内可达、无需 Key、支持中文 & JSON。
 */
export async function fetchWttr(
  mode: 'auto' | 'manual',
  city: string,
  unit: 'c' | 'f',
  signal: AbortSignal,
): Promise<WeatherSnapshot> {
  const path = mode === 'auto' ? '' : encodeURIComponent(city);
  const url = `https://wttr.in/${path}?format=j1&lang=zh`;
  const resp = await timedFetch(url, signal);
  if (!resp.ok) throw new Error(`wttr.in HTTP ${resp.status}`);
  const json = (await resp.json()) as Record<string, unknown>;

  const current = (json['current_condition'] as Array<Record<string, unknown>> | undefined)?.[0];
  const nearest = (json['nearest_area'] as Array<Record<string, unknown>> | undefined)?.[0];
  if (!current) throw new Error('wttr.in: empty current_condition');

  const tempField = unit === 'c' ? 'temp_C' : 'temp_F';
  const tempStr = current[tempField] as string | undefined;
  const temp = tempStr !== undefined ? Number.parseFloat(tempStr) : NaN;
  if (!Number.isFinite(temp)) throw new Error('wttr.in: invalid temp');

  const descList = (current['lang_zh'] ?? current['weatherDesc']) as Array<Record<string, unknown>> | undefined;
  const desc = (descList?.[0]?.['value'] as string | undefined) ?? '';
  const cityList = nearest?.['areaName'] as Array<Record<string, unknown>> | undefined;
  const cityLabel = (cityList?.[0]?.['value'] as string | undefined) ?? '';

  return { cityLabel, temp: Math.round(temp), desc, icon: mapDescToIcon(desc) };
}

/** 通过 open-meteo 的 geocoding 找经纬度 */
export async function fetchGeo(city: string, signal: AbortSignal): Promise<{ lat: number; lon: number; name: string }> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh&format=json`;
  const resp = await timedFetch(url, signal);
  if (!resp.ok) throw new Error(`geocoding HTTP ${resp.status}`);
  const json = (await resp.json()) as { results?: Array<{ latitude: number; longitude: number; name: string }> };
  const first = json.results?.[0];
  if (!first) throw new Error('geocoding: not found');
  return { lat: first.latitude, lon: first.longitude, name: first.name };
}

/** weathercode → 中文描述（仅列出常见值） */
function openMeteoCodeToDesc(code: number): string {
  if (code === 0) return '晴';
  if (code >= 1 && code <= 3) return '多云';
  if (code === 45 || code === 48) return '雾';
  if (code >= 51 && code <= 67) return '雨';
  if (code >= 71 && code <= 77) return '雪';
  if (code >= 80 && code <= 82) return '阵雨';
  if (code >= 95 && code <= 99) return '雷雨';
  return '';
}

/** ─── Provider B：open-meteo ───
 * 无需 Key，欧洲托管；需先拿到经纬度。
 */
export async function fetchOpenMeteo(
  city: string,
  unit: 'c' | 'f',
  signal: AbortSignal,
): Promise<WeatherSnapshot> {
  const geo = await fetchGeo(city, signal);
  const tempParam = unit === 'f' ? '&temperature_unit=fahrenheit' : '';
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&current=temperature_2m,weather_code${tempParam}`;
  const resp = await timedFetch(url, signal);
  if (!resp.ok) throw new Error(`open-meteo HTTP ${resp.status}`);
  const json = (await resp.json()) as {
    current?: { temperature_2m?: number; weather_code?: number };
  };
  const temp = json.current?.temperature_2m;
  const code = json.current?.weather_code;
  if (typeof temp !== 'number' || typeof code !== 'number') {
    throw new Error('open-meteo: invalid current payload');
  }
  const desc = openMeteoCodeToDesc(code);
  return { cityLabel: geo.name, temp: Math.round(temp), desc, icon: mapDescToIcon(desc) };
}

/** ─── Fallback 链 ───
 * 入口函数：按 [wttr → open-meteo] 顺序尝试，任一成功即返回。
 * 注意：auto 模式下 open-meteo 需要 IP 定位，但 open-meteo 不直接支持 IP 定位，
 * 所以 auto + city 缺失时无法降级，抛错。
 */
export async function fetchWeatherWithFallback(
  mode: 'auto' | 'manual',
  city: string,
  unit: 'c' | 'f',
  signal: AbortSignal,
): Promise<WeatherSnapshot> {
  const errors: unknown[] = [];

  // Provider 1：wttr.in
  try {
    return await fetchWttr(mode, city, unit, signal);
  } catch (err) {
    errors.push(err);
  }

  // Provider 2：open-meteo（需要有 city 名；auto 模式下没有就只能放弃）
  if (mode === 'manual' && city.trim() !== '') {
    try {
      return await fetchOpenMeteo(city, unit, signal);
    } catch (err) {
      errors.push(err);
    }
  }

  throw new AggregateError(errors as Error[], 'all weather providers failed');
}
