/**
 * 表单字段包装 —— label + control + 可选 hint
 *
 * 抽屉模式适配：
 *   - label 使用小号字体作为分组标题
 *   - hint 使用更柔和的颜色
 *   - 间距紧凑但不拥挤
 */

import { Typography } from "antd";

interface FieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

export function Field({ label, hint, children }: FieldProps) {
  return (
    <div className="settings-field">
      <div className="settings-field__label">{label}</div>
      {children}
      {hint && (
        <Typography.Text className="settings-field__hint" type="secondary">
          {hint}
        </Typography.Text>
      )}
    </div>
  );
}
