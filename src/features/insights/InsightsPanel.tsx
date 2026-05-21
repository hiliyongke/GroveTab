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
import { Modal, Button, Card, Row, Col, Typography, theme, Popconfirm } from 'antd';
import type { MetricEvent, StatsData } from '@/shared/types';
import { BarChart3 } from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import {
  getMetrics,
  clearMetrics,
  getStats,
  clearOgIndex,
  clearActivity,
  saveStats,
} from '@/repositories';
import { useT } from '@/shared/i18n';
import { feedback } from '@/shared/ui/feedback';
import { FeatureEmptyState } from '@/shared/ui/FeatureEmptyState';
import '@/shared/ui/FeatureEmptyState.css';
import './insights.css';

const { Text, Title } = Typography;

/** 事件类型 → 可读名称映射 */
const EVENT_LABEL_MAP: Record<string, string> = {
  newtabOpens: '打开新标签页',
  newtab_open: '打开新标签页',
  tab_jump: '跳转标签页',
  tab_close: '关闭标签页',
  tab_close_batch: '批量关闭',
  tab_close_domain: '按域名关闭',
  tab_close_all: '全部关闭',
  tab_discard: '休眠标签页',
  tab_discard_batch: '批量休眠',
  tab_discard_domain: '按域名休眠',
  search_web: '网页搜索',
  archive_create: '创建归档',
  archive_restore: '恢复归档',
  archive_delete: '删除归档',
  archive_merge: '合并归档',
  view_switch: '切换视图',
  newtab_page_mode_switch: '切换页面模式',
  perf_fcp: 'FCP 性能',
  perf_fps_sample: 'FPS 采样',
};

function getEventLabel(event: string): string {
  return EVENT_LABEL_MAP[event] ?? event;
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

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const [m, s] = await Promise.all([getMetrics(), getStats()]);
      setMetrics(Array.isArray(m) ? m : []);
      setStats(isValidStatsData(s) ? s : null);
    })();
  }, [open]);

  /** 近 7 天新标签页打开次数——使用 useMemo 缓存，避免水合不匹配 */
  const now = useMemo(() => new Date(), [open]);
  const dailyOpens = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = toLocalDayKey(d);
      map.set(key, 0);
    }
    for (const ev of metrics) {
      if (ev.event !== 'newtab_open' && ev.event !== 'newtabOpens') continue;
      const key = toLocalDayKey(new Date(ev.ts));
      if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([day, count]) => ({ day, count }));
  }, [metrics]);

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

  const handleClearAll = async () => {
    try {
      await clearMetrics();
      await saveStats({ daily: [], lastFlushAt: Date.now() });
      await clearOgIndex();
      await clearActivity();
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
              <Title level={3} className="insights-archive-stat">{archiveStats.totalTabs}</Title>
              <Text type="secondary">{t('insights.archiveDesc', { mb: archiveStats.savedMemMB })}</Text>
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
                <BarList items={topActions.map((a) => ({ label: getEventLabel(a.event), value: a.count }))} color={token.colorPrimary} />
              )}
            </Card>
          </Col>
        </Row>

        <div className="insights-footer">
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
        const trackStyle = {
          ['--insights-track-bg' as string]: token.colorFillTertiary,
          ['--insights-bar-fill' as string]: color,
          ['--insights-bar-width' as string]: `${w}%`,
        } as React.CSSProperties;

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
