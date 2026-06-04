/**
 * SettingsRows — 设置面板通用行组件
 *
 * 用于设置面板 / 快捷开关面板中的水平布局控制行：
 *   - SwitchRow：左侧 label + 右侧 Switch
 *   - SegmentedRow：左侧 label + 右侧 Segmented
 *   - GroupTitle：分组标题（图标 + 文字）
 *
 * 从 QuickTogglePanel 抽出，供设置面板、UiVisibilitySection 等复用。
 */
import { Flex, Switch, Segmented } from "antd";
import type { ReactNode } from "react";

/* ── GroupTitle ── */

export function GroupTitle({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <Flex align="center" gap="small">
      {icon}
      <span>{label}</span>
    </Flex>
  );
}

/* ── SwitchRow ── */

export interface SwitchRowProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  className?: string;
  labelClassName?: string;
}

export function SwitchRow({ label, checked, onChange, className, labelClassName }: SwitchRowProps) {
  return (
    <Flex align="center" justify="space-between" className={className}>
      <span className={labelClassName}>{label}</span>
      <Switch size="small" checked={checked} onChange={onChange} />
    </Flex>
  );
}

/* ── SegmentedRow ── */

export interface SegmentedRowProps<T extends string> {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  className?: string;
  labelClassName?: string;
  segmentedClassName?: string;
}

export function SegmentedRow<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
  labelClassName,
  segmentedClassName,
}: SegmentedRowProps<T>) {
  return (
    <Flex align="center" justify="space-between" className={className}>
      <span className={labelClassName}>{label}</span>
      <Segmented
        size="small"
        value={value}
        options={options}
        onChange={(v) => onChange(v as T)}
        className={segmentedClassName}
      />
    </Flex>
  );
}
