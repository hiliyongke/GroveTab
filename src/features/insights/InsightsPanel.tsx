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
import { Modal, Button, Card, Row, Col, Typography, theme, Popconfirm, message } from 'antd';
import type { MetricEvent, StatsData } from '@/shared/types';
import {
  getMetrics,
  clearMetrics,
  getStats,
  clearOgIndex,
  clearActivity,
  saveStats,
} from '@/repositories';
import { useT } from '@/shared/i18n';

const { Text, Title } = Typography;

interface InsightsPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function InsightsPanel({ open, onClose }: InsightsPanelProps) {
  const { token } = theme.useToken();
  const { t } = useT();
  const [metrics, setMetrics] = useState<MetricEvent[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const [m, s] = await Promise.all([getMetrics(), getStats()]);
      setMetrics(m);
      setStats(s ?? null);
    })();
  }, [open]);

  /** 近 7 天新标签页打开次数 */
  const dailyOpens = useMemo(() => {
    const map = new Map<string, number>();
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      map.set(key, 0);
    }
    for (const ev of metrics) {
      if (ev.event !== 'newtab_open') continue;
      const key = new Date(ev.ts).toISOString().slice(0, 10);
      if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([day, count]) => ({ day, count }));
  }, [metrics]);

  /** Top 10 访问域名 */
  const topDomains = useMemo(() => {
    if (!stats) return [];
    const counts = new Map<string, number>();
    for (const record of stats.daily) {
      for (const [url, c] of Object.entries(record.counts)) {
        try {
          const host = new URL(url).hostname;
          counts.set(host, (counts.get(host) ?? 0) + c);
        } catch {
          // ignore malformed
        }
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([host, count]) => ({ host, count }));
  }, [stats]);

  /** Top 5 操作 */
  const topActions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ev of metrics) {
      counts.set(ev.event, (counts.get(ev.event) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([event, count]) => ({ event, count }));
  }, [metrics]);

  /** 累计归档 tab 数（来自 metrics archive 事件） */
  const archiveStats = useMemo(() => {
    let totalTabs = 0;
    for (const ev of metrics) {
      if (ev.event === 'archive') {
        const count = typeof ev.payload?.count === 'number' ? ev.payload.count : 0;
        totalTabs += count;
      }
    }
    return { totalTabs, savedMemMB: totalTabs * 80 };
  }, [metrics]);

  const handleClearAll = async () => {
    try {
      await clearMetrics();
      await saveStats({ daily: [], lastFlushAt: Date.now() });
      await clearOgIndex();
      await clearActivity();
      setMetrics([]);
      setStats(null);
      message.success(t('insights.cleared'));
    } catch (err) {
      console.warn('[insights] clear failed', err);
      message.error(t('insights.clearFailed'));
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={760}
      title={t('insights.title')}
      centered
      destroyOnHidden
    >
      <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={12}>
            <Card size="small" title={t('insights.dailyOpens')}>
              <LineChart
                data={dailyOpens.map((d) => d.count)}
                labels={dailyOpens.map((d) => d.day.slice(5))}
                color={token.colorPrimary}
              />
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card size="small" title={t('insights.topDomains')}>
              {topDomains.length === 0 ? (
                <Text type="secondary">{t('insights.empty')}</Text>
              ) : (
                <BarList items={topDomains.map((d) => ({ label: d.host, value: d.count }))} color={token.colorPrimary} />
              )}
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card size="small" title={t('insights.archiveStat')}>
              <Title level={3} style={{ margin: 0 }}>{archiveStats.totalTabs}</Title>
              <Text type="secondary">{t('insights.archiveDesc', { mb: archiveStats.savedMemMB })}</Text>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card size="small" title={t('insights.topActions')}>
              {topActions.length === 0 ? (
                <Text type="secondary">{t('insights.empty')}</Text>
              ) : (
                <BarList items={topActions.map((a) => ({ label: a.event, value: a.count }))} color={token.colorPrimary} />
              )}
            </Card>
          </Col>
        </Row>

        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Popconfirm
            title={t('insights.clearConfirm')}
            onConfirm={() => void handleClearAll()}
            okText={t('archive.delete')}
            cancelText={t('archive.cancel')}
          >
            <Button danger size="small">
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
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 120 }}>
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
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((it) => {
        const w = Math.round((it.value / max) * 100);
        return (
          <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11.5, flex: '0 0 40%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {it.label}
            </span>
            <div style={{ flex: 1, position: 'relative', height: 14, background: 'rgba(0,0,0,0.04)', borderRadius: 4 }}>
              <div style={{ width: `${w}%`, height: '100%', background: color, borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: 11.5, fontVariantNumeric: 'tabular-nums' }}>{it.value}</span>
          </div>
        );
      })}
    </div>
  );
}
