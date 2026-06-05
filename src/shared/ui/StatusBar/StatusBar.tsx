/**
 * StatusBar —— 底部全宽持久消息层
 *
 * UX-P0-07：承载持久消息（选择模式提示、整理建议等）
 * z-index: 1000（Toast=1100, Modal=1200）
 */

import { Button, Typography } from "antd";
import { X, Info, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { useStatusBarStore, type StatusBarMessage } from "@/shared/store/status-bar-slice";
import styles from "./StatusBar.module.less";

const { Text } = Typography;

/** 每种消息类型的视觉配置 — 颜色使用语义化设计 token */
const TYPE_CONFIG: Record<
  StatusBarMessage["type"],
  { icon: typeof Info; color: string; bg: string }
> = {
  info: { icon: Info, color: "var(--ant-color-primary)", bg: "var(--ant-color-primary-bg, color-mix(in srgb, #1677ff 12%, transparent))" },
  success: { icon: CheckCircle, color: "var(--ant-color-success)", bg: "var(--ant-color-success-bg, color-mix(in srgb, #52c41a 15%, transparent))" },
  warning: { icon: AlertTriangle, color: "var(--ant-color-warning)", bg: "var(--ant-color-warning-bg, color-mix(in srgb, #faad14 15%, transparent))" },
  error: { icon: XCircle, color: "var(--ant-color-error)", bg: "var(--ant-color-error-bg, color-mix(in srgb, #ff4d4f 12%, transparent))" },
};

export function StatusBar() {
  const messages = useStatusBarStore((s) => s.messages);
  const removeMessage = useStatusBarStore((s) => s.removeMessage);
  const current = messages[0]; // 只显示第一条

  if (!current) return null;

  const config = TYPE_CONFIG[current.type];
  const Icon = config.icon;

  return (
    <div
      className={styles["status-bar"]}
      style={{
        "--status-bar-bg": config.bg,
        "--status-bar-color": config.color,
        "--status-bar-border": `color-mix(in srgb, ${config.color} 20%, transparent)`,
      } as React.CSSProperties}
    >
      <Icon size={14} className={styles["status-bar__icon"]} />
      <Text className={styles["status-bar__text"]}>
        {current.content}
      </Text>
      {current.action && (
        <Button
          type="link"
          size="small"
          className={styles["status-bar__action"]}
          onClick={current.action.onClick}
        >
          {current.action.label}
        </Button>
      )}
      <button
        type="button"
        className={styles["status-bar__dismiss"]}
        onClick={() => removeMessage(current.id)}
        aria-label="关闭"
      >
        <X size={12} />
      </button>
    </div>
  );
}
