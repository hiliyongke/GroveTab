/**
 * InsightsLineChart — 每日打开次数折线图
 *
 * 纯 SVG 实现：轻量（无第三方依赖）+ 高 DPI 友好（viewBox 缩放）。
 * 通过 viewBox 适配任意容器宽度，无需 ResizeObserver。
 */
import { useMemo } from "react";
import { useT } from "@/shared/i18n";
import styles from "../insights.module.less";

interface Props {
  data: number[];
  labels: string[];
  color: string;
}

/** SVG 坐标系基准（viewBox 内坐标，非像素） */
const BASE_W = 800;
const BASE_H = 200;
const PADDING = 24;

export function InsightsLineChart({ data, labels, color }: Props) {
  const { t } = useT();

  const { points, max, w, h } = useMemo(() => {
    const m = Math.max(1, ...data);
    const innerW = BASE_W - PADDING * 2;
    const innerH = BASE_H - PADDING * 2;
    const step = data.length > 1 ? innerW / (data.length - 1) : 0;
    const pts = data.map((v, i) => {
      const x = PADDING + i * step;
      const y = BASE_H - PADDING - (v / m) * innerH;
      return { x, y, value: v, label: labels[i] ?? "" };
    });
    return { points: pts, max: m, w: BASE_W, h: BASE_H };
  }, [data, labels]);

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={styles["insights-line-chart"]}
      role="img"
      aria-label={t("每日打开次数折线图")}
    >
      {/* 网格线（淡） */}
      {[0.25, 0.5, 0.75].map((pct) => (
        <line
          key={pct}
          x1={PADDING}
          x2={w - PADDING}
          y1={h - PADDING - pct * (h - PADDING * 2)}
          y2={h - PADDING - pct * (h - PADDING * 2)}
          stroke="currentColor"
          strokeWidth={1}
          opacity={0.08}
        />
      ))}
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polyline}
      />
      {points.map((p, i) => (
        <g key={labels[i] ?? i}>
          <title>{`${p.label}: ${p.value}`}</title>
          <circle cx={p.x} cy={p.y} r={4} fill={color} className={styles["insights-line-dot"]} />
        </g>
      ))}
      {labels.map((label, i) => (
        <text
          key={`${label}-${i}`}
          x={PADDING + (i * (w - PADDING * 2)) / Math.max(1, labels.length - 1)}
          y={h - 4}
          textAnchor="middle"
          fontSize="11"
          fill="currentColor"
          opacity={0.5}
        >
          {label}
        </text>
      ))}
      {/* Y 轴最大值标签 */}
      <text
        x={PADDING}
        y={PADDING - 4}
        fontSize="11"
        fill="currentColor"
        opacity={0.5}
      >
        {max}
      </text>
    </svg>
  );
}
