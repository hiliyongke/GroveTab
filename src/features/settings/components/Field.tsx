/**
 * 表单字段包装 —— label + control + 可选 hint
 */

import { theme } from 'antd';

interface FieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

export function Field({ label, hint, children }: FieldProps) {
  const { token } = theme.useToken();
  return (
    <div>
      <label
        style={{
          display: 'block',
          marginBottom: 8,
          fontSize: 12,
          fontWeight: 500,
          color: token.colorTextTertiary,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 11.5,
            color: token.colorTextTertiary,
            lineHeight: 1.5,
          }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
