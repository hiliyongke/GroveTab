/**
 * ViewToolbar — 统一视图工具栏容器
 *
 * 四个视图工具栏（Tabs / Timeline / Window / TabGroup）共享相同的容器结构：
 *   - 外层 `<Flex align="center" gap="small">` 水平行
 *   - 可选搜索输入框（带标准 Search 图标 + allowClear）
 *   - 中间自由插槽（children）
 *   - 右侧控件组（controls，自动包裹标准间距容器）
 *
 * 抽出后消除 ~60 行重复的容器样板代码。
 */
import { Input, Flex } from "antd";
import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import styles from "../styles/items.module.less";

export interface ViewToolbarProps {
  /** 搜索关键词（受控）。不传则隐藏搜索框。 */
  searchQuery?: string;
  /** 搜索框变化回调 */
  onSearchChange?: (query: string) => void;
  /** 搜索框 placeholder */
  searchPlaceholder?: string;
  /** 搜索框与控件之间的任意内容 */
  children?: ReactNode;
  /** 右侧控件（自动包裹在标准间距 + `app-domain-toolbar-controls` 样式中） */
  controls?: ReactNode;
}

export function ViewToolbar({
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  children,
  controls,
}: ViewToolbarProps) {
  const showSearch = searchQuery !== undefined && onSearchChange !== undefined;

  return (
    <Flex align="center" gap="small" className={styles["app-domain-toolbar"]}>
      {showSearch && (
        <Input
          prefix={<Search size={ICON_SIZE.SMALL} />}
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          allowClear
          className={styles["app-toolbar-search-input"]}
        />
      )}

      {children}

      {controls && (
        <Flex align="center" gap={4} className={styles["app-domain-toolbar-controls"]}>
          {controls}
        </Flex>
      )}
    </Flex>
  );
}
