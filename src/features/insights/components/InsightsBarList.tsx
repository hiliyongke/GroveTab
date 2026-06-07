/**
 * InsightsBarList — 通用条形列表
 *
 * 特性：
 *   - 点击行触发 onClick（用于"域名 → 过滤 tabs"）
 *   - 数值以 tabular-nums 渲染，避免数字抖动
 *   - 宽度过渡用 --app-motion-* token
 */

import { Flex, Typography, theme } from "antd";
import { cssVars } from "@/shared/utils/css-vars";
import styles from "../insights.module.less";

interface BarItem {
  label: string;
  value: number;
}

interface Props {
  items: BarItem[];
  color: string;
  onClick?: (label: string) => void;
  /** 自定义 label 渲染（如 i18n 翻译） */
  renderLabel?: (label: string) => string;
}

export function InsightsBarList({ items, color, onClick, renderLabel }: Props) {
  const { token } = theme.useToken();
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <Flex vertical className={styles["insights-bar-list"]} role="list">
      {items.map((it) => {
        const w = Math.round((it.value / max) * 100);
        const trackStyle = cssVars({
          "--insights-track-bg": token.colorFillTertiary,
          "--insights-bar-fill": color,
          "--insights-bar-width": `${w}%`,
        });
        const displayLabel = renderLabel !== undefined ? renderLabel(it.label) : it.label;
        return (
          <Flex
            key={it.label}
            className={styles["insights-bar-row"]}
            style={onClick !== undefined ? { cursor: "pointer" } : undefined}
            onClick={onClick !== undefined ? () => onClick(it.label) : undefined}
            role="listitem"
            tabIndex={onClick !== undefined ? 0 : undefined}
            onKeyDown={
              onClick !== undefined
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onClick(it.label);
                    }
                  }
                : undefined
            }
            aria-label={`${displayLabel}: ${it.value}`}
          >
            <Typography.Text className={styles["insights-bar-label"]} title={displayLabel}>
              {displayLabel}
            </Typography.Text>
            <div className={styles["insights-bar-track"]} style={trackStyle}>
              <div className={styles["insights-bar-fill"]} />
            </div>
            <Typography.Text className={styles["insights-bar-value"]}>
              {it.value}
            </Typography.Text>
          </Flex>
        );
      })}
    </Flex>
  );
}
