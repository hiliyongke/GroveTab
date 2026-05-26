/**
 * 表单字段包装 —— label + control + 可选 hint
 *
 * 抽屉模式适配：
 *   - label 使用小号字体作为分组标题
 *   - hint 使用更柔和的颜色
 *   - 间距紧凑但不拥挤
 */

import type { ReactNode } from "react";

import { Flex, Typography } from "antd";

interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

export function Field({ label, hint, children }: FieldProps) {
  return (
    <Flex vertical className="settings-field">
      <Typography.Text className="settings-field__label">{label}</Typography.Text>
      {children}
      {hint && (
        <Typography.Text className="settings-field__hint" type="secondary">
          {hint}
        </Typography.Text>
      )}
    </Flex>
  );
}
