/**
 * 小键盘提示胶囊组件
 *
 * 用于展示键盘快捷键提示（如 ⌘↵）。
 */

import type { ReactNode } from "react";
import styles from "../SearchBox.module.less";

interface KbdProps {
  children: ReactNode;
}

/**
 * 键盘快捷键提示组件
 *
 * @param props - 组件属性
 * @param props.children - 键盘按键文本
 * @returns JSX 元素
 */
export function Kbd({ children }: KbdProps) {
  return <span className={styles["search-box-kbd"]}>{children}</span>;
}
