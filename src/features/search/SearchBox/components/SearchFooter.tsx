/**
 * SearchFooter 组件
 *
 * 显示搜索框底部的快捷键提示
 */

import { Kbd } from "./Kbd";
import type { ShortcutHint } from "../types";
import styles from "../SearchBox.module.less";

interface SearchFooterProps {
  /** 结果数量 */
  resultCount: number;
  /** 快捷键提示列表 */
  shortcutHints: ShortcutHint[];
  /** 国际化函数 */
  t: (key: string, vars?: Record<string, string>) => string;
}

/**
 * 搜索框底部快捷键提示组件
 *
 * @param props - 组件属性
 * @param props.resultCount
 * @param props.shortcutHints
 * @param props.t
 * @returns JSX 元素
 */
export function SearchFooter({ resultCount, shortcutHints, t }: SearchFooterProps) {
  return (
    <div className={styles["search-box-footer"]}>
      <span className={styles["search-box-status-text"]}>
        {resultCount > 0 ? t("search", { count: resultCount.toString() }) : t("search")}
      </span>
      <div className={styles["search-box-shortcuts"]}>
        {shortcutHints.map((shortcut) => (
          <span key={shortcut.id} className={styles["search-box-shortcut"]}>
            <span className={styles["search-box-shortcut-keys"]}>
              {shortcut.keys.map((key) => (
                <Kbd key={`${shortcut.id}-${key}`}>{key}</Kbd>
              ))}
            </span>
            <span>{shortcut.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
