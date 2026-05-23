/**
 * 表单字段包装 —— label + control + 可选 hint
 *
 * 抽屉模式适配：
 *   - label 使用小号字体作为分组标题
 *   - hint 使用更柔和的颜色
 *   - 间距紧凑但不拥挤
 */

interface FieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

/**
 * 表单字段包装组件
 *
 * 统一渲染设置项的 label、控件和提示文本。
 *
 * @param props - 组件属性
 * @param props.label - 字段标签
 * @param props.hint - 提示文本（可选）
 * @param props.children - 表单控件
 * @returns 表单字段包装组件 JSX 元素
 */
export function Field({ label, hint, children }: FieldProps) {
  return (
    <div className="settings-field">
      <div className="settings-field__label">
        {label}
      </div>
      {children}
      {hint && (
        <p className="settings-field__hint">
          {hint}
        </p>
      )}
    </div>
  );
}
