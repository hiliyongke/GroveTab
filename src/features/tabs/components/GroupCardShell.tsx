import { Card } from "antd";
import type { CSSProperties, ReactNode } from "react";

import styles from "../styles/items.module.less";

export type GroupCardAccentBarPosition = "left" | "top" | "none";

interface GroupCardShellProps {
  className?: string;
  bodyClassName?: string;
  style?: CSSProperties;
  accentBarPosition?: GroupCardAccentBarPosition;
  header: ReactNode;
  collapsed?: boolean;
  collapsedSummary?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  ghostDropZone?: ReactNode;
}

/**
 * GroupCardShell —— 分组卡片通用结构。
 *
 * 只负责视觉骨架：Card 容器、身份色条、头部、折叠摘要、内容区和末尾占位。
 * 具体业务（域名、窗口、Tab Group）仍由调用方渲染，避免把操作逻辑塞进通用组件。
 */
export function GroupCardShell({
  className,
  bodyClassName,
  style,
  accentBarPosition = "left",
  header,
  collapsed = false,
  collapsedSummary,
  children,
  footer,
  ghostDropZone,
}: GroupCardShellProps) {
  return (
    <Card
      size="small"
      className={`app-card-interactive app-hover-reveal-host ${styles["app-domain-group-card"]}${className ? ` ${className}` : ""}`}
      classNames={{
        body: `${styles["app-domain-group-card__body"]}${bodyClassName ? ` ${bodyClassName}` : ""}`,
      }}
      style={style}
    >
      {accentBarPosition === "left" && (
        <div aria-hidden className={styles["app-accent-bar--left"]} />
      )}
      {accentBarPosition === "top" && <div aria-hidden className={styles["app-accent-bar--top"]} />}

      <div className={styles["app-domain-group-header-wrap"]}>{header}</div>

      {collapsed ? collapsedSummary : children}
      {!collapsed && ghostDropZone}
      {footer}
    </Card>
  );
}
