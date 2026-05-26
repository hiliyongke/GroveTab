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

import { useEffect, useMemo, useState } from "react";
import {
  Modal,
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

const { Text, Title } = Typography;

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

interface InsightsPanelProps {
  open: boolean;
  onClose: () => void;
  /** 跳转到归档面板（智能建议操作） */
  onOpenArchive?: () => void;
  /** 跳转到设置面板（智能建议操作） */
  onOpenSettings?: () => void;
}

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

export default function InsightsPanel({
  open,
  onClose,
  onOpenArchive,
  onOpenSettings,
}: InsightsPanelProps) {
  const { token } = theme.useToken();
  const { t } = useT();
  const [metrics, setMetrics] = useState<MetricEvent[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const { info: quotaInfo, loading: quotaLoading } = useStorageQuota(open);

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
      if (norm !== "newtab_open") continue;
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

  /** 累计归档 tab 数（来自 metrics 的 archive / archive_create 事件） */
  const archiveStats = useMemo(() => {
    let totalTabs = 0;
    for (const ev of metrics) {
      if (ev.event === "archive" || ev.event === "archive_create") {
        const count = typeof ev.payload?.count === "number" ? ev.payload.count : 0;
        totalTabs += count;
      }
    }
    return { totalTabs, savedMemMB: totalTabs * 80 };
  }, [metrics]);

  /** 是否所有数据源都为空：冷启动用户统一展示 empty state */
  const isAllEmpty = !loading && metrics.length === 0 && (stats?.daily?.length ?? 0) === 0;

  /** 近 7 天是否全部为 0 */
  const dailyAllZero = dailyOpens.every((d) => d.count === 0);

  /** 智能建议 */
  const suggestions = useSmartSuggestions({
    quota: quotaInfo,
    archiveTabCount: archiveStats.totalTabs,
    topDomainCount: topDomains.length,
    dailyOpens: dailyOpens.map((d) => d.count),
    onOpenArchive: () => {
      onClose();
      onOpenArchive?.();
    },
    onOpenSettings: () => {
      onClose();
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
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="min(760px, calc(100vw - 24px))"
      title={t("本地隐私洞察")}
      centered
      destroyOnHidden
    >
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
          <Row gutter={[12, 12]}>
            <Col xs={24} md={12}>
              <Card size="small" title={t("近 7 天每日打开次数")}>
                {dailyAllZero ? (
                  <FeatureEmptyState
                    title={t("近 7 天暂无打开记录")}
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
            </Col>
            <Col xs={24} md={12}>
              <Card size="small" title={t("Top 10 访问域名")}>
                {topDomains.length === 0 ? (
                  <FeatureEmptyState
                    title={t("暂无数据")}
                    icon={<BarChart3 size={ICON_SIZE.LARGE} />}
                    size="small"
                    hints={[t("继续使用扩展以生成洞察数据"), t("所有数据均在本地计算，不会上传")]}
                  />
                ) : (
                  <BarList
                    items={topDomains.map((d) => ({ label: d.host, value: d.count }))}
                    color={token.colorPrimary}
                  />
                )}
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card size="small" title={t("累计归档")}>
                {archiveStats.totalTabs === 0 ? (
                  <FeatureEmptyState
                    title={t("尚未归档过 Tab")}
                    icon={<BarChart3 size={ICON_SIZE.LARGE} />}
                    size="small"
                    hints={[t("继续使用扩展以生成洞察数据")]}
                  />
                ) : (
                  <>
                    <Title level={3} className={styles["insights-archive-stat"]}>
                      {archiveStats.totalTabs}
                    </Title>
                    <Text type="secondary">
                      {t("约节省 {mb} MB 内存", { mb: archiveStats.savedMemMB })}
                    </Text>
                  </>
                )}
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card size="small" title={t("使用频率前 5")}>
                {topActions.length === 0 ? (
                  <FeatureEmptyState
                    title={t("暂无数据")}
                    icon={<BarChart3 size={ICON_SIZE.LARGE} />}
                    size="small"
                    hints={[t("继续使用扩展以生成洞察数据"), t("所有数据均在本地计算，不会上传")]}
                  />
                ) : (
                  <BarList
                    items={topActions.map((a) => ({
                      label: getEventLabel(a.event, t),
                      value: a.count,
                    }))}
                    color={token.colorPrimary}
                  />
                )}
              </Card>
            </Col>
          </Row>
        )}

        {/* 存储占用卡片 */}
        {!quotaLoading && quotaInfo && (
          <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
            <Col xs={24} md={12}>
              <Card size="small" title={t("chrome.storage 占用")}>
                <Progress
                  percent={Math.round(quotaInfo.chromeStorageRatio * 100)}
                  status={
                    quotaInfo.chromeStorageRatio >= 0.9
                      ? "exception"
                      : quotaInfo.chromeStorageRatio >= 0.7
                        ? "active"
                        : "normal"
                  }
                  size="small"
                />
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {formatBytes(quotaInfo.chromeStorageUsed)} /{" "}
                  {formatBytes(quotaInfo.chromeStorageTotal)}
                </Typography.Text>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card size="small" title={t("OPFS 存储占用")}>
                <Progress
                  percent={quotaInfo.opfsTotal > 0 ? Math.round(quotaInfo.opfsRatio * 100) : 0}
                  status={quotaInfo.opfsRatio >= 0.9 ? "exception" : "normal"}
                  size="small"
                />
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {formatBytes(quotaInfo.opfsUsed)}
                  {quotaInfo.opfsTotal > 0 ? ` / ${formatBytes(quotaInfo.opfsTotal)}` : ""}
                </Typography.Text>
              </Card>
            </Col>
          </Row>
        )}

        {/* 智能建议区 */}
        {suggestions.length > 0 && (
          <Card size="small" title={t("智能建议")} style={{ marginTop: 12 }}>
            <Flex vertical gap={8}>
              {suggestions.map((s) => (
                <Alert
                  key={s.id}
                  type={
                    s.level === "warning" ? "warning" : s.level === "success" ? "success" : "info"
                  }
                  showIcon
                  icon={
                    s.level === "success" ? (
                      <CheckCircle2 size={14} />
                    ) : s.level === "warning" ? (
                      <AlertTriangle size={14} />
                    ) : (
                      <Info size={14} />
                    )
                  }
                  message={t(s.titleKey)}
                  description={t(s.descKey)}
                  action={
                    s.actionKey && s.onAction ? (
                      <Button size="small" type="link" onClick={s.onAction}>
                        {t(s.actionKey)}
                      </Button>
                    ) : undefined
                  }
                />
              ))}
            </Flex>
          </Card>
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
