/**
 * 搜索结果项组件
 *
 * 渲染单个搜索结果项，支持多种类型（tab、history、closed、suggestion、web、permission、command）
 */

import { Tag } from "antd";
import type { GlobalToken } from "antd/es/theme/interface";
import { CornerDownLeft } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { iconColor, iconColorAlpha } from "@/shared/utils/icon-colors";
import { cx, cssVars, getItemIconMeta } from "../utils/searchUtils";
import { renderHighlightedText } from "../utils/highlightUtils";
import type { UniversalSearchItem } from "../types";
import styles from "../SearchBox.module.less";

interface SearchResultItemProps {
  /** 搜索结果项数据 */
  item: UniversalSearchItem;
  /** 当前项的索引 */
  index: number;
  /** 是否高亮（当前选中） */
  active: boolean;
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
}

/**
 * 搜索结果项组件
 *
 * @param props - 组件属性
 * @param props.item
 * @param props.index
 * @param props.active
 * @param props.normalizedQuery
 * @param props.onActivate
 * @param props.onHover
 * @param props.token
 * @param props.t
 * @returns JSX 元素
 */
export function SearchResultItem({
  item,
  index,
  active,
  normalizedQuery,
  onActivate,
  onHover,
  token,
  t,
}: SearchResultItemProps) {
  const { icon, iconRole } = getItemIconMeta(item);
  const titleNode = renderHighlightedText(item.title, normalizedQuery, item.id + "-title");
  const subtitleNode = renderHighlightedText(item.subtitle, normalizedQuery, item.id + "-subtitle");
  const itemVars = cssVars({
    "--searchbox-item-icon-bg": iconColorAlpha(iconRole, token, active ? 0.2 : 0.1),
    "--searchbox-item-icon-color": iconColor(iconRole, token),
  });

  return (
    <li
      role="option"
      aria-selected={active}
      onMouseEnter={() => onHover(index)}
      onClick={() => onActivate(item)}
      className={cx(styles["search-box-item"], active && styles["is-active"])}
      style={itemVars}
    >
      {item.type === "tab" && item.tab.favIconUrl !== "" ? (
        <img
          src={item.tab.favIconUrl}
          alt=""
          className={styles["search-box-item-favicon"]}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <span className={styles["search-box-item-icon"]}>{icon}</span>
      )}
      <div className={styles["search-box-item-main"]}>
        <div className={styles["search-box-item-head"]}>
          <div className={styles["search-box-item-title"]}>{titleNode}</div>
          {item.type === "tab" && item.badge !== undefined && (
            <Tag className={styles["search-box-tag"]}>{item.badge}</Tag>
          )}
          {item.type === "tab" && item.matchedTags !== undefined && item.matchedTags.length > 0 && (
            <span className={styles["search-box-tag-list"]} aria-label={t("search")}>
              {item.matchedTags.slice(0, 3).map((tag) => (
                <Tag key={tag} className={styles["search-box-tag"]} color="blue">
                  {tag}
                </Tag>
              ))}
            </span>
          )}
          {item.type === "suggestion" && (
            <Tag
              className={styles["search-box-tag"]}
              color={item.source === "hot" ? "gold" : "default"}
            >
              {item.source === "hot" ? t("search.sourceHot") : t("search.sourceRecent")}
            </Tag>
          )}
        </div>
        <div className={styles["search-box-item-subtitle"]}>{subtitleNode}</div>
      </div>
      {active && (
        <CornerDownLeft size={ICON_SIZE.SMALL} className={styles["search-box-enter-icon"]} />
      )}
    </li>
  );
}
