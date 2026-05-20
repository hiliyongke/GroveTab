/**
 * 表单字段包装 —— label + control + 可选 hint
 *
 * 抽屉模式适配：
 *   - label 使用大写小号字体作为分组标题
 *   - hint 使用更柔和的颜色
 *   - 间距紧凑但不拥挤
 */

interface FieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

export function Field({ label, hint, children }: FieldProps) {
  return (
    <div className="settings-field">
      <label className="settings-field__label">
        {label}
      </label>
      {children}
      {hint && (
        <p className="settings-field__hint">
          {hint}
        </p>
      )}
    </div>
  );
}
