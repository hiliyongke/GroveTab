/**
 * CSS 自定义属性工具函数
 *
 * 用于安全地创建包含 CSS 变量的样式对象，
 * 替代 `'--xxx' as string` 非安全类型断言。
 */

import type { CSSProperties } from 'react';

/**
 * 将 CSS 自定义属性键值对转换为 React.CSSProperties 对象。
 *
 * @example
 * ```tsx
 * const style = cssVars({
 *   '--app-tab-primary': token.colorPrimary,
 *   '--app-tab-text': token.colorText,
 * });
 * ```
 */
export function cssVars(vars: Record<string, string | undefined>): CSSProperties {
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(vars)) {
    if (value !== undefined) {
      filtered[key] = value;
    }
  }
  return filtered;
}
