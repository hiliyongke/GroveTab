/**
 * AppearancePanel — 共享子组件
 *
 * 提取自 AppearancePanel 的轻量可复用组件：
 *   - ModeBadge：皮肤/渐变预设的深/浅模式标记
 *   - SliderField：标签 + 数值 + Slider + 提示的复合控件
 *   - VisibilityRow：标签 + 提示 + Switch 的显隐控制行
 *   - PresetCard：皮肤/渐变预设卡片
 */

import { Button, Slider, Switch, Flex, Typography } from "antd";
import { MinusCircle, Plus, Sun, Moon, Pencil } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import styles from "../styles/appearance.module.less";

/* ── ModeBadge ── */

export function ModeBadge({ mode }: { mode: "light" | "dark" }) {
  return (
    <span className={`${styles["appearance-mode-badge"]} ${styles[`is-${mode}`]}`}>
      {mode === "dark" ? <Moon size={ICON_SIZE.XS} /> : <Sun size={ICON_SIZE.XS} />}
    </span>
  );
}

/* ── SliderField ── */

export function SliderField({
  label,
  value,
  min,
  max,
  step,
  hint,
  suffix = "px",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  hint: string;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <Flex vertical className={styles["appearance-slider-group"]}>
      <Flex align="center" justify="space-between" className={styles["appearance-slider-header"]}>
        <Typography.Text className={styles["appearance-slider-label"]}>{label}</Typography.Text>
        <Typography.Text className={styles["appearance-slider-value"]}>
          {value}
          {suffix}
        </Typography.Text>
      </Flex>
      <Slider min={min} max={max} step={step} value={value} onChange={onChange} />
      {hint !== "" && (
        <Typography.Text className={styles["appearance-slider-hint"]}>{hint}</Typography.Text>
      )}
    </Flex>
  );
}

/* ── VisibilityRow ── */

export function VisibilityRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Flex align="center" justify="space-between" className={styles["appearance-visibility-row"]}>
      <Flex vertical>
        <Typography.Text className={styles["appearance-visibility-title"]}>{label}</Typography.Text>
        <Typography.Text className={styles["appearance-visibility-hint"]}>{hint}</Typography.Text>
      </Flex>
      <Switch size="small" checked={checked} onChange={onChange} />
    </Flex>
  );
}

/* ── PresetCard ── */

export function PresetCard({
  selected,
  preview,
  label,
  description,
  onClick,
}: {
  selected: boolean;
  preview: React.ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
}) {
  return (
    <Button
      htmlType="button"
      title={description ? `${label} · ${description}` : label}
      onClick={onClick}
      className={`${styles["appearance-preset-card"]}${selected ? ` ${styles["is-selected"]}` : ""}`}
    >
      {preview}
      <Flex vertical className={styles["appearance-preset-meta"]}>
        <Typography.Text
          className={`${styles["appearance-preset-title"]}${selected ? ` ${styles["is-selected"]}` : ""}`}
        >
          {label}
        </Typography.Text>
        {description && (
          <Typography.Text className={styles["appearance-preset-description"]}>
            {description}
          </Typography.Text>
        )}
      </Flex>
    </Button>
  );
}

/* ── Re-export icons used by gradient editor ── */

export { MinusCircle, Plus, Pencil };
export { ICON_SIZE };
