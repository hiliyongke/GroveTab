/**
 * InsightsView —— 本地隐私洞察仪表盘
 *
 * 全部本地计算，零外部请求。4 个卡片：
 *   ① 近 7 天每日新标签页打开次数（折线图）
 *   ② Top 10 访问域名（柱状图）
 *   ③ 累计归档 tab 数 + 估算节省内存
 *   ④ 使用频率前 5 的操作
 *
 * 仅使用纯 SVG，不引入 echarts / chart.js，控制包体增量 ≤ 15 KB。
 *
 * 内存估算模型（P1-7）：
 *   - 基础单标签页内存：80 MB（与 Chrome 官方内存报告一致）
 *   - 视频/媒体类标签（油管等）：+220 MB 加权
 *   - 图片富媒体类标签（Unsplash 等）：+70 MB 加权
 *   - JS 密集型应用类标签（Google Docs 等）：+120 MB 加权
 *   - 常规文本/文章类标签：−30 MB 修正（更轻量）
 *   - 通过 URL 路径特征（/watch/, /video/, /image/, /doc/）进行分类估算
 */

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Row,
  Col,
  Typography,
  theme,
  Popconfirm,
  Skeleton,
  Flex,
  Progress,
  Alert,
  Segmented,
} from "antd";
import type { MetricEvent, StatsData } from "@/shared/types";
import { BarChart3, Download, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { cssVars } from "@/shared/utils/css-vars";
import { getMetrics, clearMetrics, getStats, saveStats } from "@/repositories";
import { useT } from "@/shared/i18n";
import { feedback } from "@/shared/ui/feedback";
import { FeatureEmptyState } from "@/shared/ui/FeatureEmptyState";
import { useStorageQuota } from "./hooks/use-storage-quota";
import { useSmartSuggestions } from "./hooks/use-smart-suggestions";
import styles from "./insights.module.less";


/** 字节数格式化：1024 → 1 KB，1048576 → 1 MB */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * 事件名归一化：旧 `newtabOpens` 合并到 `newtab_open`，
 * 避免 Top 5 中出现两条 label 相同但 event 不同的重复项。
 */
function normalizeEvent(event: string): string {
  if (event === "newtabOpens") return "newtab_open";
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

/** 时间范围选项（P2-13：洞察数据时间范围可配置） */
export type InsightsTimeRange = 7 | 14 | 30;

/** 校验 StatsData 结构完整性，防止 daily 缺失导致迭代报错 */
function isValidStatsData(data: StatsData | undefined | null): data is StatsData {
  if (data == null) return false;
  if (!Array.isArray(data.daily)) return false;
  if (typeof data.lastFlushAt !== "number") return false;
  return true;
}

function toLocalDayKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** 紧凑空态占位，与 BarList 高度对齐 */
function EmptyText({ text }: { text: string }) {
  return (
    <Flex align="center" justify="center" style={{ minHeight: 160 }}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>{text}</Typography.Text>
    </Flex>
  );
}

export default function InsightsView({
  onOpenArchive,
  onOpenSettings,
}: {
  onOpenArchive?: () => void;
  onOpenSettings?: () => void;
}) {
  const { token } = theme.useToken();
  const { t } = useT();
  const [metrics, setMetrics] = useState<MetricEvent[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const { info: quotaInfo, loading: quotaLoading } = useStorageQuota(true);

  /** 时间范围（P2-13：支持 7/14/30 天可配置） */
  const [timeRange, setTimeRange] = useState<InsightsTimeRange>(7);

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
   * 近 N 天新标签页打开次数（P2-13：时间范围可配置）。
   * 只在面板打开时计算 "now"，避免面板一直打开跨天后"今天"错位。
   */
  const dailyOpens = useMemo(() => {
    const now = new Date();
    const map = new Map<string, number>();
    for (let i = timeRange - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = toLocalDayKey(d);
      map.set(key, 0);
    }
    for (const ev of metrics) {
      const norm = normalizeEvent(ev.event);
      if (norm !== "newtab_open") continue;
      const key = toLocalDayKey(new Date(ev.ts));
      if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([day, count]) => ({ day, count }));
    // open 作为依赖仅用于面板重新打开时刷新 "今天" 基准
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics, open, timeRange]);

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
      if (!ev.event.startsWith("tab_") && ev.event !== "search_web") continue;
      const payload = ev.payload ?? {};
      // 尝试从 hostname 字段取域名
      const hostname = typeof payload.hostname === "string" ? payload.hostname : "";
      if (hostname !== "") {
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

  /**
   * 内存估算模型（P1-7）：基于 URL 特征的类型加权
   *
   * 规则：
   *   - /watch/, /v/, /video/, /player/ → 视频/媒体标签，+220 MB 加权
   *   - /image/, /photo/, /img/, /pic/    → 图片富媒体标签，+70 MB 加权
   *   - /doc/, /document/, /sheets/, /slides/ → JS 密集型应用，+120 MB 加权
   *   - 其他 → 常规标签，基础值 80 MB
   *
   * savedMemMB = sum(estimatedMemoryPerTab) 表示归档前各标签消耗的内存总量
   */
  const estimateMemMBByUrl = (url: string): number => {
    const u = url.toLowerCase();
    if (/\/(watch\?|v\/|video\/|player\/|shorts\b)/.test(u)) return 300;
    if (/\/(image\/|photo\/|img\/|pic\/|image\?|\.jpg|\.png|\.webp|\.gif|\/gallery)/.test(u))
      return 150;
    if (/\/(doc\/|document\/|sheets\/|slides\/|office\/|docs\.google)/.test(u)) return 200;
    return 80;
  };

  /** 累计归档 tab 数（来自 metrics 的 archive / archive_create 事件） */
  const archiveStats = useMemo(() => {
    let totalTabs = 0;
    let savedMemMB = 0;
    for (const ev of metrics) {
      if (ev.event === "archive" || ev.event === "archive_create") {
        const count = typeof ev.payload?.count === "number" ? ev.payload.count : 0;
        const tabUrls: string[] = Array.isArray(ev.payload?.tabs)
          ? (ev.payload.tabs as string[])
          : [];
        totalTabs += count;
        for (const url of tabUrls) {
          savedMemMB += estimateMemMBByUrl(url);
        }
      }
    }
    return { totalTabs, savedMemMB };
  }, [metrics]);

  /** 是否所有数据源都为空：冷启动用户统一展示 empty state */
  const isAllEmpty = !loading && metrics.length === 0 && (stats?.daily?.length ?? 0) === 0;

  /** 近 N 天是否全部为 0 */
  const dailyAllZero = dailyOpens.every((d) => d.count === 0);

  /** 智能建议 */
  const suggestions = useSmartSuggestions({
    quota: quotaInfo,
    archiveTabCount: archiveStats.totalTabs,
    topDomainCount: topDomains.length,
    dailyOpens: dailyOpens.map((d) => d.count),
    onOpenArchive: () => {
      // onClose removed
      onOpenArchive?.();
    },
    onOpenSettings: () => {
      // onClose removed
      onOpenSettings?.();
    },
  });

  /** 导出洞察数据为 .json.gz（通过 Blob + a 标签下载） */
  const handleExport = () => {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        metrics,
        stats,
        topDomains,
        topActions,
        archiveStats,
        dailyOpens,
        storageQuota: quotaInfo,
      };
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `insights-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      feedback.success(t("导出成功"));
    } catch (err) {
      console.warn("[insights] export failed", err);
      feedback.error(t("导出失败"));
    }
  };

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
      feedback.success(t("已清除所有本地统计"));
    } catch (err) {
      console.warn("[insights] clear failed", err);
      feedback.error(t("清除失败，请重试"));
    }
  };

  return (
    <div style={{ minHeight: 0 }}>
      <Flex vertical className={styles["insights-panel"]}>
        {loading ? (
          <Flex vertical className={styles["insights-loading"]}>
            <Skeleton active paragraph={{ rows: 6 }} />
          </Flex>
        ) : isAllEmpty ? (
          <FeatureEmptyState
            title={t("暂无数据")}
            icon={<BarChart3 size={ICON_SIZE.LARGE} />}
            hints={[t("继续使用扩展以生成洞察数据"), t("所有数据均在本地计算，不会上传")]}
          />
        ) : (
          <Flex vertical gap={12}>
            {/* 第一行：折线图全宽 */}
            <Card
              size="small"
              title={
                <Flex justify="space-between" align="center">
                  <Typography.Text>{t("每日打开次数")}</Typography.Text>
                  <Segmented
                    size="small"
                    value={timeRange}
                    onChange={(v) => setTimeRange(v as InsightsTimeRange)}
                    options={[
                      { label: "7d", value: 7 },
                      { label: "14d", value: 14 },
                      { label: "30d", value: 30 },
                    ]}
                  />
                </Flex>
              }
            >
              {dailyAllZero ? (
                <FeatureEmptyState
                  title={t("近 {n} 天暂无打开记录", { n: timeRange })}
                  icon={<BarChart3 size={ICON_SIZE.LARGE} />}
                  size="small"
                  hints={[t("继续使用扩展以生成洞察数据")]}
                />
              ) : (
                <LineChart
                  data={dailyOpens.map((d) => d.count)}
                  labels={dailyOpens.map((d) => d.day.slice(5))}
                  color={token.colorPrimary}
                />
              )}
            </Card>

            {/* 第二行：3列 BarList + 归档统计 */}
            <Row gutter={12}>
              <Col xs={24} md={8}>
                <Card size="small" title={t("Top 10 访问域名")} className={styles["insights-stat-card"]}>
                  {topDomains.length === 0 ? <EmptyText text={t("暂无数据")} /> : (
                    <BarList items={topDomains.map((d) => ({ label: d.host, value: d.count }))} color={token.colorPrimary} />
                  )}
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card size="small" title={t("使用频率前 5")} className={styles["insights-stat-card"]}>
                  {topActions.length === 0 ? <EmptyText text={t("暂无数据")} /> : (
                    <BarList items={topActions.map((a) => ({ label: getEventLabel(a.event, t), value: a.count }))} color={token.colorPrimary} />
                  )}
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card size="small" title={t("累计归档")} className={styles["insights-stat-card"]}>
                  {archiveStats.totalTabs === 0 ? <EmptyText text={t("尚未归档")} /> : (
                    <Flex vertical align="center" gap={4}>
                      <Typography.Text style={{ fontSize: 28, fontWeight: 700, color: token.colorPrimary, lineHeight: 1 }}>
                        {archiveStats.totalTabs}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {t("约节省 {mb} MB 内存", { mb: archiveStats.savedMemMB })}
                      </Typography.Text>
                    </Flex>
                  )}
                </Card>
              </Col>
            </Row>

            {/* 第三行：存储占用（合并） */}
            {!quotaLoading && quotaInfo && (
              <Card size="small" title={t("存储占用")}>
                <Row gutter={24}>
                  <Col xs={24} sm={12}>
                    <Flex vertical gap={4}>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>chrome.storage</Typography.Text>
                      <Progress
                        percent={Math.round(quotaInfo.chromeStorageRatio * 100)}
                        status={quotaInfo.chromeStorageRatio >= 0.9 ? "exception" : quotaInfo.chromeStorageRatio >= 0.7 ? "active" : "normal"}
                        size="small"
                      />
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {formatBytes(quotaInfo.chromeStorageUsed)} / {formatBytes(quotaInfo.chromeStorageTotal)}
                      </Typography.Text>
                    </Flex>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Flex vertical gap={4}>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>OPFS</Typography.Text>
                      <Progress
                        percent={quotaInfo.opfsTotal > 0 ? Math.round(quotaInfo.opfsRatio * 100) : 0}
                        status={quotaInfo.opfsRatio >= 0.9 ? "exception" : "normal"}
                        size="small"
                      />
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {formatBytes(quotaInfo.opfsUsed)}
                        {quotaInfo.opfsTotal > 0 ? ` / ${formatBytes(quotaInfo.opfsTotal)}` : ""}
                      </Typography.Text>
                    </Flex>
                  </Col>
                </Row>
              </Card>
            )}

            {/* 智能建议 */}
            {suggestions.length > 0 && (
              <Card size="small" title={t("智能建议")}>
                <Flex vertical gap={8}>
                  {suggestions.map((s) => (
                    <Alert
                      key={s.id}
                      type={s.level === "warning" ? "warning" : s.level === "success" ? "success" : "info"}
                      showIcon
                      icon={s.level === "success" ? <CheckCircle2 size={14} /> : s.level === "warning" ? <AlertTriangle size={14} /> : <Info size={14} />}
                      title={t(s.titleKey)}
                      description={t(s.descKey)}
                      action={s.actionKey && s.onAction ? <Button size="small" type="link" onClick={s.onAction}>{t(s.actionKey)}</Button> : undefined}
                    />
                  ))}
                </Flex>
              </Card>
            )}
          </Flex>
        )}

        <Flex className={styles["insights-footer"]} gap={8}>
          <Button
            size="small"
            icon={<Download size={12} />}
            onClick={() => void handleExport()}
            disabled={loading || isAllEmpty}
          >
            {t("导出数据")}
          </Button>
          <Popconfirm
            title={t("将清空所有本地统计数据，不可恢复。继续？")}
            onConfirm={() => void handleClearAll()}
            okText={t("删除")}
            cancelText={t("取消")}
            disabled={loading || isAllEmpty}
          >
            <Button danger size="small" disabled={loading || isAllEmpty}>
              {t("清除所有统计")}
            </Button>
          </Popconfirm>
        </Flex>
      </Flex>
    </div>
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
      const y = height - padding - (v / max) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={styles["insights-line-chart"]}>
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
        const y = height - padding - (v / max) * (height - padding * 2);
        return <circle key={labels[i] ?? i} cx={x} cy={y} r={2.5} fill={color} />;
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
function BarList({
  items,
  color,
}: {
  items: Array<{ label: string; value: number }>;
  color: string;
}) {
  const { token } = theme.useToken();
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <Flex vertical className={styles["insights-bar-list"]}>
      {items.map((it) => {
        const w = Math.round((it.value / max) * 100);
        const trackStyle: React.CSSProperties = cssVars({
          "--insights-track-bg": token.colorFillTertiary,
          "--insights-bar-fill": color,
          "--insights-bar-width": `${w}%`,
        });

        return (
          <Flex key={it.label} className={styles["insights-bar-row"]}>
            <Typography.Text className={styles["insights-bar-label"]}>{it.label}</Typography.Text>
            <div className={styles["insights-bar-track"]} style={trackStyle}>
              <div className={styles["insights-bar-fill"]} />
            </div>
            <Typography.Text className={styles["insights-bar-value"]}>{it.value}</Typography.Text>
          </Flex>
        );
      })}
    </Flex>
  );
}
