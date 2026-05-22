/**
 * InsightsPanel —— 本地隐私洞察仪表盘（F-28）
 *
 * 全部本地计算，零外部请求。4 个卡片：
 *   ① 近 7 天每日新标签页打开次数（折线图）
 *   ② Top 10 访问域名（柱状图）
 *   ③ 累计归档 tab 数 + 估算节省内存
 *   ④ 使用频率前 5 的操作
 *
 * 仅使用纯 SVG，不引入 echarts / chart.js，控制包体增量 ≤ 15 KB。
 */

import { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Card, Row, Col, Typography, theme, Popconfirm, Skeleton } from 'antd';
import type { MetricEvent, StatsData } from '@/shared/types';
import { BarChart3 } from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { cssVars } from '@/shared/utils/css-vars';
import {
  getMetrics,
  clearMetrics,
  getStats,
  saveStats,
} from '@/repositories';
import { useT } from '@/shared/i18n';
import { feedback } from '@/shared/ui/feedback';
import { FeatureEmptyState } from '@/shared/ui/FeatureEmptyState';
import '@/shared/ui/FeatureEmptyState.css';
import './insights.css';

const { Text, Title } = Typography;

/**
 * 事件名归一化：旧 `newtabOpens` 合并到 `newtab_open`，
 * 避免 Top 5 中出现两条 label 相同但 event 不同的重复项。
 */
function normalizeEvent(event: string): string {
  if (event === 'newtabOpens') return 'newtab_open';
  return event;
}

/** 事件类型 → 可读名称映射（走 i18n） */
function getEventLabel(
  event: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const norm = normalizeEvent(event);
  const i18nKey = `insights.event.${norm}`;
  const label = t(i18nKey);
  // 未命中的 i18n key 会原样返回，此时退化为原始事件名
  return label === i18nKey ? norm : label;
}

interface InsightsPanelProps {
  open: boolean;
  onClose: () => void;
}

/** 校验 StatsData 结构完整性，防止 daily 缺失导致迭代报错 */
function isValidStatsData(data: StatsData | undefined | null): data is StatsData {
  if (data == null) return false;
  if (!Array.isArray(data.daily)) return false;
  if (typeof data.lastFlushAt !== 'number') return false;
  return true;
}

function toLocalDayKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function InsightsPanel({ open, onClose }: InsightsPanelProps) {
  const { token } = theme.useToken();
  const { t } = useT();
  const [metrics, setMetrics] = useState<MetricEvent[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [m, s] = await Promise.all([getMetrics(), getStats()]);
        if (cancelled) return;
        setMetrics(Array.isArray(m) ? m : []);
        setStats(isValidStatsData(s) ? s : null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  /**
   * 近 7 天新标签页打开次数。
   * 只在面板打开时计算 "now"，避免面板一直打开跨天后“今天”错位。
   */
  const dailyOpens = useMemo(() => {
    const now = new Date();
    const map = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = toLocalDayKey(d);
      map.set(key, 0);
    }
    for (const ev of metrics) {
      const norm = normalizeEvent(ev.event);
      if (norm !== 'newtab_open') continue;
      const key = toLocalDayKey(new Date(ev.ts));
      if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([day, count]) => ({ day, count }));
    // open 作为依赖仅用于面板重新打开时刷新 "今天" 基准
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics, open]);

  /** Top 10 访问域名——优先从 stats.daily 取，同时从 metrics 中的 tab 事件补充 */
  const topDomains = useMemo(() => {
    const counts = new Map<string, number>();
    // 来源1：stats.daily（SW StatsCollector 按 URL × day 聚合）
    if (stats?.daily != null) {
      for (const record of stats.daily) {
        if (record?.counts == null) continue;
        for (const [url, c] of Object.entries(record.counts)) {
          try {
            const host = new URL(url).hostname;
            counts.set(host, (counts.get(host) ?? 0) + c);
          } catch {
            // ignore malformed
          }
        }
      }
    }
    // 来源2：metrics 中的 tab 事件（补充 stats 未覆盖的操作，如关闭/跳转）
    for (const ev of metrics) {
      if (!ev.event.startsWith('tab_') && ev.event !== 'search_web') continue;
      const payload = ev.payload ?? {};
      // 尝试从 hostname 字段取域名
      const hostname = typeof payload.hostname === 'string' ? payload.hostname : '';
      if (hostname !== '') {
        counts.set(hostname, (counts.get(hostname) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([host, count]) => ({ host, count }));
  }, [stats, metrics]);

  /** Top 5 操作：在统计前先归一化事件名 */
  const topActions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ev of metrics) {
      const key = normalizeEvent(ev.event);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([event, count]) => ({ event, count }));
  }, [metrics]);

  /** 累计归档 tab 数（来自 metrics 的 archive / archive_create 事件） */
  const archiveStats = useMemo(() => {
    let totalTabs = 0;
    for (const ev of metrics) {
      if (ev.event === 'archive' || ev.event === 'archive_create') {
        const count = typeof ev.payload?.count === 'number' ? ev.payload.count : 0;
        totalTabs += count;
      }
    }
    return { totalTabs, savedMemMB: totalTabs * 80 };
  }, [metrics]);

  /** 是否所有数据源都为空：冷启动用户统一展示 empty state */
  const isAllEmpty = !loading
    && metrics.length === 0
    && (stats?.daily?.length ?? 0) === 0;

  /** 近 7 天是否全部为 0 */
  const dailyAllZero = dailyOpens.every((d) => d.count === 0);

  /**
   * 清除：仅清除统计相关数据（metrics + stats）。
   * 不再清理 OG 索引与 Recent Activity，避免超出用户预期。
   */
  const handleClearAll = async () => {
    try {
      await clearMetrics();
      await saveStats({ daily: [], lastFlushAt: Date.now() });
      setMetrics([]);
      setStats(null);
      feedback.success(t('insights.cleared'));
    } catch (err) {
      console.warn('[insights] clear failed', err);
      feedback.error(t('insights.clearFailed'));
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="min(760px, calc(100vw - 24px))"
      title={t('insights.title')}
      centered
      destroyOnHidden
    >
      <div className="insights-panel">
        {loading ? (
          <div className="insights-loading">
            <Skeleton active paragraph={{ rows: 6 }} />
          </div>
        ) : isAllEmpty ? (
          <FeatureEmptyState
            title={t('insights.empty')}
            icon={<BarChart3 size={ICON_SIZE.LARGE} />}
            hints={[t('insights.emptyHint1'), t('insights.emptyHint2')]}
          />
        ) : (
          <Row gutter={[12, 12]}>
            <Col xs={24} md={12}>
              <Card size="small" title={t('insights.dailyOpens')}>
                {dailyAllZero ? (
                  <FeatureEmptyState
                    title={t('insights.dailyEmpty')}
                    icon={<BarChart3 size={ICON_SIZE.LARGE} />}
                    size="small"
                    hints={[t('insights.emptyHint1')]}
                  />
                ) : (
                  <LineChart
                    data={dailyOpens.map((d) => d.count)}
                    labels={dailyOpens.map((d) => d.day.slice(5))}
                    color={token.colorPrimary}
                  />
                )}
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card size="small" title={t('insights.topDomains')}>
                {topDomains.length === 0 ? (
                  <FeatureEmptyState
                    title={t('insights.empty')}
                    icon={<BarChart3 size={ICON_SIZE.LARGE} />}
                    size="small"
                    hints={[t('insights.emptyHint1'), t('insights.emptyHint2')]}
                  />
                ) : (
                  <BarList items={topDomains.map((d) => ({ label: d.host, value: d.count }))} color={token.colorPrimary} />
                )}
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card size="small" title={t('insights.archiveStat')}>
                {archiveStats.totalTabs === 0 ? (
                  <FeatureEmptyState
                    title={t('insights.archiveEmpty')}
                    icon={<BarChart3 size={ICON_SIZE.LARGE} />}
                    size="small"
                    hints={[t('insights.emptyHint1')]}
                  />
                ) : (
                  <>
                    <Title level={3} className="insights-archive-stat">{archiveStats.totalTabs}</Title>
                    <Text type="secondary">{t('insights.archiveDesc', { mb: archiveStats.savedMemMB })}</Text>
                  </>
                )}
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card size="small" title={t('insights.topActions')}>
                {topActions.length === 0 ? (
                  <FeatureEmptyState
                    title={t('insights.empty')}
                    icon={<BarChart3 size={ICON_SIZE.LARGE} />}
                    size="small"
                    hints={[t('insights.emptyHint1'), t('insights.emptyHint2')]}
                  />
                ) : (
                  <BarList items={topActions.map((a) => ({ label: getEventLabel(a.event, t), value: a.count }))} color={token.colorPrimary} />
                )}
              </Card>
            </Col>
          </Row>
        )}

        <div className="insights-footer">
          <Popconfirm
            title={t('insights.clearConfirm')}
            onConfirm={() => void handleClearAll()}
            okText={t('archive.delete')}
            cancelText={t('archive.cancel')}
            disabled={loading || isAllEmpty}
          >
            <Button danger size="small" disabled={loading || isAllEmpty}>
              {t('insights.clearAll')}
            </Button>
          </Popconfirm>
        </div>
      </div>
    </Modal>
  );
}

/** 纯 SVG 折线图（轻量） */
function LineChart({ data, labels, color }: { data: number[]; labels: string[]; color: string }) {
  const width = 300;
  const height = 120;
  const padding = 16;
  const max = Math.max(1, ...data);
  const step = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;
  const points = data
    .map((v, i) => {
      const x = padding + i * step;
      const y = height - padding - ((v / max) * (height - padding * 2));
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="insights-line-chart">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {data.map((v, i) => {
        const x = padding + i * step;
        const y = height - padding - ((v / max) * (height - padding * 2));
        return <circle key={i} cx={x} cy={y} r={2.5} fill={color} />;
      })}
      {labels.map((label, i) => (
        <text
          key={label}
          x={padding + i * step}
          y={height - 2}
          textAnchor="middle"
          fontSize="9"
          fill="currentColor"
          opacity={0.5}
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

/** 条形列表（轻量柱状） */
function BarList({ items, color }: { items: Array<{ label: string; value: number }>; color: string }) {
  const { token } = theme.useToken();
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="insights-bar-list">
      {items.map((it) => {
        const w = Math.round((it.value / max) * 100);
        const trackStyle: React.CSSProperties = cssVars({
          '--insights-track-bg': token.colorFillTertiary,
          '--insights-bar-fill': color,
          '--insights-bar-width': `${w}%`,
        });

        return (
          <div key={it.label} className="insights-bar-row">
            <span className="insights-bar-label">
              {it.label}
            </span>
            <div className="insights-bar-track" style={trackStyle}>
              <div className="insights-bar-fill" />
            </div>
            <span className="insights-bar-value">{it.value}</span>
          </div>
        );
      })}
    </div>
  );
}
