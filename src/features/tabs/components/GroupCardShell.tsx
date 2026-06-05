import { useMemo } from "react";
import { Card, Flex, Typography, theme } from "antd";
import type { CSSProperties, ReactNode } from "react";
import { cssVars } from "@/shared/utils/css-vars";

import styles from "../styles/items.module.less";

export type GroupCardAccentBarPosition = "left" | "top" | "none";

interface GroupCardShellProps {
  className?: string;
  bodyClassName?: string;
  accentBarPosition?: GroupCardAccentBarPosition;
  header: ReactNode;
  collapsed?: boolean;
  collapsedSummary?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  ghostDropZone?: ReactNode;
  /** 是否添加交互动画（hover 上浮、阴影提升、hover-reveal）。默认 true。 */
  interactive?: boolean;
  // ── 统一样式 props（由 GroupCardShell 内部生成 cardStyle）──
  /** 身份色条颜色（CSS 颜色字符串） */
  barColor: string;
  /** 徽章/图标底板的柔光背景色 */
  badgeBg: string;
  /** 卡片圆角像素值（默认 token.borderRadiusLG） */
  cardRadius?: number;
  /** 额外内联样式，合并到 cardStyle 上（用于卡片专属变量） */
  extraStyle?: CSSProperties;
}

/**
 * GroupCardShell —— 分组卡片统一容器。
 *
 * 所有分组卡片（Domain / TabGroup / Window）的外观从此处统一：
 *   - 公共 CSS 变量（--app-domain-card-*）由 GroupCardShell 内部生成
 *   - 卡片专属变量通过 extraStyle 注入
 *   - 不再需要各卡片手写 cardStyle
 */
export function GroupCardShell({
  className,
  bodyClassName,
  accentBarPosition = "left",
  header,
  collapsed = false,
  collapsedSummary,
  children,
  footer,
  ghostDropZone,
  interactive = true,
  barColor,
  badgeBg,
  cardRadius,
  extraStyle,
}: GroupCardShellProps) {
  const { token } = theme.useToken();
  const radius = cardRadius ?? token.borderRadiusLG;
  const cardClasses = interactive ? "app-card app-card-interactive app-hover-reveal-host" : "app-card";

  const style = useMemo<CSSProperties>(
    () => ({
      borderRadius: radius || 12,
      overflow: "hidden",
      position: "relative",
      boxShadow: "var(--app-shadow-card)",
      border: `1px solid ${token.colorBorderSecondary}`,
      ...cssVars({
        "--app-domain-card-radius": `${radius || 12}px`,
        "--app-domain-card-bar": barColor,
        "--app-domain-card-badge-bg": badgeBg,
        "--app-domain-card-header-border": token.colorBorderSecondary,
        "--app-domain-card-title-color": token.colorText,
      }),
      ...extraStyle,
    }),
    [radius, barColor, badgeBg, extraStyle, token],
  );

  return (
    <Card
      size="small"
      className={`${cardClasses} ${styles["app-domain-group-card"]}${className ? ` ${className}` : ""}`}
      classNames={{
        body: `${styles["app-domain-group-card__body"]}${bodyClassName ? ` ${bodyClassName}` : ""}`,
      }}
      style={style}
    >
      {accentBarPosition === "left" && (
        <Typography.Text aria-hidden className={styles["app-accent-bar--left"]} />
      )}
      {accentBarPosition === "top" && (
        <Typography.Text aria-hidden className={styles["app-accent-bar--top"]} />
      )}

      <Flex className={styles["app-domain-group-header-wrap"]}>{header}</Flex>

      {collapsed ? collapsedSummary : children}
      {!collapsed && ghostDropZone}
      {footer}
    </Card>
  );
}
