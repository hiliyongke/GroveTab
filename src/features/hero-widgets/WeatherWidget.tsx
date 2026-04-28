/**
 * WeatherWidget —— HeroWidgets 之二：天气
 *
 * 数据源策略（国内友好）：
 *   主源：wttr.in（无需 key；国内可达；支持中文与 JSON）
 *         https://wttr.in/{city}?format=j1&lang=zh
 *   备用：open-meteo（欧洲托管，国内基本可达；需先用 IP 定位得经纬度）
 *         https://api.open-meteo.com/v1/forecast
 *
 * 模式（settings.heroWidgets.weather.mode）：
 *   - 'auto'   ：让 wttr.in 基于 IP 自动定位（path 省略 city）
 *   - 'manual' ：使用 settings.heroWidgets.weather.city 指定城市
 *   - 'off'    ：不展示组件（直接 return null）
 *
 * 行为：
 *   - 组件挂载/依赖变化时发起一次请求
 *   - 30 分钟本地缓存（localStorage key 由应用命名空间统一生成）
 *   - 请求失败但有缓存时，展示最后一次有效值 + "离线"标
 *   - 请求耗时 > 5s 超时
 */

import { useEffect, useMemo, useState } from 'react';
import { theme } from 'antd';
import { Cloud, CloudOff, MapPin, RefreshCcw, Sun } from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useT } from '@/shared/i18n';
import { useSettingsStore } from '@/store';
import { fetchWeatherWithFallback, type WeatherSnapshot } from './weather-providers';
import { LOCAL_CACHE_KEYS } from '@/shared/config/storage-keys';

export type { WeatherSnapshot };

/** 本地缓存条目 */
interface WeatherCache {
  snapshot: WeatherSnapshot;
  cityKey: string;
  unit: 'c' | 'f';
  ts: number;
}

const CACHE_KEY = LOCAL_CACHE_KEYS.weather;
const CACHE_TTL_MS = 30 * 60_000; // 30 min

function readCache(): WeatherCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as WeatherCache;
    if (typeof parsed.ts !== 'number' || parsed.snapshot === undefined) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(entry: WeatherCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // 静默：天气非关键
  }
}

function clearCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * 主组件。
 */
export function WeatherWidget() {
  const { token } = theme.useToken();
  const { t } = useT();
  const weatherConf = useSettingsStore((s) => s.settings.heroWidgets?.weather);

  const mode = weatherConf?.mode ?? 'auto';
  const city = weatherConf?.city ?? '';
  const unit: 'c' | 'f' = weatherConf?.unit ?? 'c';

  /**
   * 组件内部显示状态：
   *   - snapshot: 当前天气快照（可能来自网络或缓存）
   *   - stale:    是否来自"离线缓存"——用于右上角小徽标提示
   *   - loading:  首次加载无缓存时显示 loading
   */
  const [snapshot, setSnapshot] = useState<WeatherSnapshot | null>(null);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(false);
  // 所有 provider 都挂且无缓存时，展示"点击重试"；retryTick 手动 bump 触发重跑
  const [allFailed, setAllFailed] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  /** 组件卡片 key：mode+city+unit 组合；模式切换时应清空显示 */
  const cityKey = useMemo(() => (mode === 'auto' ? '__auto__' : city), [mode, city]);

  useEffect(() => {
    if (mode === 'off') {
      setSnapshot(null);
      return;
    }
    if (mode === 'manual' && city.trim() === '') {
      setSnapshot(null);
      return;
    }

    const abort = new AbortController();

    // 先命中缓存立即展示
    const cache = readCache();
    if (cache !== null && cache.cityKey === cityKey && cache.unit === unit) {
      setSnapshot(cache.snapshot);
      setStale(Date.now() - cache.ts > CACHE_TTL_MS);
      setAllFailed(false);
      if (Date.now() - cache.ts <= CACHE_TTL_MS) {
        return () => abort.abort();
      }
    } else {
      setLoading(true);
    }

    void (async () => {
      try {
        const snap = await fetchWeatherWithFallback(mode, city, unit, abort.signal);
        setSnapshot(snap);
        setStale(false);
        setAllFailed(false);
        writeCache({ snapshot: snap, cityKey, unit, ts: Date.now() });
      } catch {
        const fallback = readCache();
        if (fallback !== null && fallback.cityKey === cityKey) {
          setSnapshot(fallback.snapshot);
          setStale(true);
          setAllFailed(false);
        } else {
          setSnapshot(null);
          setAllFailed(true);
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => abort.abort();
  }, [mode, city, unit, cityKey, retryTick]);

  const handleRetry = () => {
    clearCache();
    setAllFailed(false);
    setRetryTick((t) => t + 1);
  };

  if (mode === 'off') return null;

  /** 未就绪 / 配置缺失时展示占位 */
  if (snapshot === null) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minWidth: 140,
          color: token.colorTextTertiary,
          fontSize: 12,
        }}
      >
        {mode === 'manual' && city.trim() === '' ? (
          <>
<MapPin size={ICON_SIZE.MEDIUM} />
            <span>{t('heroWidgets.weather.needCity')}</span>
          </>
        ) : loading ? (
          <>
<Cloud size={ICON_SIZE.MEDIUM} />
            <span>{t('heroWidgets.weather.loading')}</span>
          </>
        ) : allFailed ? (
          <button
            type="button"
            onClick={handleRetry}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'transparent',
              border: `1px solid ${token.colorBorder}`,
              borderRadius: 6,
              padding: '2px 6px',
              fontSize: 11,
              color: token.colorTextSecondary,
              cursor: 'pointer',
            }}
            aria-label={t('heroWidgets.weather.retry')}
          >
<RefreshCcw size={ICON_SIZE.SMALL} />
            <span>{t('heroWidgets.weather.retry')}</span>
          </button>
        ) : (
          <>
<CloudOff size={ICON_SIZE.MEDIUM} />
            <span>{t('heroWidgets.weather.unavailable')}</span>
          </>
        )}
      </div>
    );
  }

  const tempSuffix = unit === 'c' ? '°C' : '°F';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minWidth: 140,
      }}
      title={stale ? t('heroWidgets.weather.staleHint') : undefined}
    >
      <span style={{ fontSize: 28, lineHeight: 1 }} aria-hidden="true">
        {snapshot.icon}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: token.colorText,
            lineHeight: 1,
          }}
        >
          {snapshot.temp}
          <span style={{ fontSize: 12, marginLeft: 2, color: token.colorTextSecondary }}>{tempSuffix}</span>
          {stale && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 10,
                padding: '1px 4px',
                borderRadius: 4,
                background: token.colorWarningBg,
                color: token.colorWarningText,
                fontWeight: 500,
              }}
            >
              {t('heroWidgets.weather.offline')}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 11,
            color: token.colorTextTertiary,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {snapshot.desc !== '' ? (
            <>
<Sun size={ICON_SIZE.MICRO} />
              <span>{snapshot.desc}</span>
            </>
          ) : null}
          {snapshot.cityLabel !== '' && (
            <>
              <span style={{ opacity: 0.5 }}>·</span>
              <span>{snapshot.cityLabel}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
