/**
 * SearchResultList 组件
 *
 * 渲染搜索结果列表，包含多个 section
 */

import type { GlobalToken } from "antd/es/theme/interface";
import { SearchResultItem } from "./SearchResultItem";
import type { UniversalSearchItem, SearchSection } from "../types";
import styles from "../SearchBox.module.less";

interface SearchResultListProps {
  /** 搜索结果区块列表 */
  sections: SearchSection[];
  /** 扁平化的搜索结果项列表 */
  flatItems: UniversalSearchItem[];
  /** 当前高亮项的索引 */
  activeIndex: number;
  /** 搜索查询字符串（用于高亮） */
  normalizedQuery: string;
  /** 激活（点击/回车）回调 */
  onActivate: (item: UniversalSearchItem) => void;
  /** 鼠标悬停回调 */
  onHover: (index: number) => void;
  /** Ant Design 主题 token */
  token: GlobalToken;
  /** 国际化函数 */
  t: (key: string, vars?: Record<string, string>) => string;
  /** 空状态配置 */
  emptyState: {
    isLoading: boolean;
    isEmpty: boolean;
    title: string;
    hints?: string[];
  };
}

/**
 * 搜索结果列表组件
 *
 * @param props - 组件属性
 * @param props.sections
 * @param props.flatItems
 * @param props.activeIndex
 * @param props.normalizedQuery
 * @param props.onActivate
 * @param props.onHover
 * @param props.token
 * @param props.t
 * @param props.emptyState
 * @returns JSX 元素
 */
export function SearchResultList({
  sections,
  flatItems,
  activeIndex,
  normalizedQuery,
  onActivate,
  onHover,
  token,
  t,
  emptyState,
}: SearchResultListProps) {
  if (flatItems.length === 0) {
    return <div className={styles["search-box-empty"]}>{emptyState.title}</div>;
  }

  return (
    <div className={styles["search-box-list-area"]}>
      {sections.map((section) => {
        const startIndex = flatItems.findIndex((item) => item.id === section.items[0]?.id);

        return (
          <section key={section.key} className={styles["search-box-section"]}>
            <div className={styles["search-box-section-header"]}>
              <span>{section.title}</span>
              <span className={styles["search-box-section-count"]}>{section.items.length}</span>
            </div>
            <ul role="listbox" className={styles["search-box-list"]}>
              {section.items.map((item, offset) => {
                const itemIndex = startIndex + offset;
                return (
                  <SearchResultItem
                    key={item.id}
                    item={item}
                    index={itemIndex}
                    active={itemIndex === activeIndex}
                    normalizedQuery={normalizedQuery}
                    onActivate={onActivate}
                    onHover={onHover}
                    token={token}
                    t={t}
                  />
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
