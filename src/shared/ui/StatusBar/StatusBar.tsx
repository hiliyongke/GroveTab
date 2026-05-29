/**
 * StatusBar —— 底部全宽持久消息层
 *
 * UX-P0-07：承载持久消息（选择模式提示、整理建议等）
 * z-index: 1000（Toast=1100, Modal=1200）
 */

import { Button, Typography } from "antd";
import { X, Info, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { useStatusBarStore, type StatusBarMessage } from "@/shared/store/status-bar-slice";

const { Text } = Typography;

const TYPE_CONFIG: Record<
  StatusBarMessage["type"],
  { icon: typeof Info; color: string; bg: string }
> = {
  info: { icon: Info, color: "#1677ff", bg: "#e6f4ff" },
  success: { icon: CheckCircle, color: "#52c41a", bg: "#f6ffed" },
  warning: { icon: AlertTriangle, color: "#faad14", bg: "#fffbe6" },
  error: { icon: XCircle, color: "#ff4d4f", bg: "#fff2f0" },
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
      className="status-bar"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 32,
        background: config.bg,
        borderTop: `1px solid ${config.color}20`,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        gap: 8,
        transition: "all 0.2s ease",
      }}
    >
      <Icon size={14} style={{ color: config.color, flexShrink: 0 }} />
      <Text
        style={{
          fontSize: 12,
          color: config.color,
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {current.content}
      </Text>
      {current.action && (
        <Button
          type="link"
          size="small"
          style={{ fontSize: 12, color: config.color, padding: 0, height: "auto" }}
          onClick={current.action.onClick}
        >
          {current.action.label}
        </Button>
      )}
      <Button
        type="text"
        size="small"
        style={{ padding: 2, height: "auto", minWidth: "auto" }}
        onClick={() => removeMessage(current.id)}
      >
        <X size={12} />
      </Button>
    </div>
  );
}
