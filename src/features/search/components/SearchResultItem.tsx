import type { CSSProperties, ReactNode } from "react";
import { Tag, theme } from "antd";
import {
  LayoutGrid,
  Clock,
  Flame,
  Globe,
  Link,
  RotateCcw,
  History,
  Unlock,
  Search,
  CornerDownLeft,
} from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import type { UniversalSearchItem, IconRole } from "../types";
import { SearchHighlight } from "@/shared/ui/SearchHighlight";
import { iconColor, iconColorAlpha } from "@/shared/utils/icon-colors";
import styles from "../SearchBox.module.less";

interface SearchResultItemProps {
  item: UniversalSearchItem;
  index: number;
  active: boolean;
  normalizedQuery: string;
  onActivate: (item: UniversalSearchItem) => void;
  onMouseEnter: (index: number) => void;
}

function getItemIconMeta(item: UniversalSearchItem): { icon: ReactNode; iconRole: IconRole } {
  switch (item.type) {
    case "tab":
      return { icon: <LayoutGrid size={ICON_SIZE.TINY} />, iconRole: "tab" };
    case "history":
      return { icon: <Link size={ICON_SIZE.TINY} />, iconRole: "history" };
    case "closed":
      return { icon: <RotateCcw size={ICON_SIZE.TINY} />, iconRole: "history" };
    case "command":
      return { icon: <History size={ICON_SIZE.TINY} />, iconRole: "history" };
    case "web":
      return { icon: <Globe size={ICON_SIZE.TINY} />, iconRole: "web" };
    case "permission":
      return { icon: <Unlock size={ICON_SIZE.TINY} />, iconRole: "permission" };
    case "suggestion":
      return item.source === "hot"
        ? { icon: <Flame size={ICON_SIZE.TINY} />, iconRole: "hot" }
        : { icon: <Clock size={ICON_SIZE.TINY} />, iconRole: "recent" };
    default:
      return { icon: <Search size={ICON_SIZE.TINY} />, iconRole: "search" };
  }
}

function cssVars(vars: Record<string, string>): CSSProperties {
  return vars;
}

export function SearchResultItem({
  item,
  index,
  active,
  normalizedQuery,
  onActivate,
  onMouseEnter,
}: SearchResultItemProps) {
  const { token } = theme.useToken();
  const { icon, iconRole } = getItemIconMeta(item);
  const titleNode = (
    <SearchHighlight text={item.title} query={normalizedQuery} keyPrefix={item.id + "-title"} />
  );
  const subtitleNode = (
    <SearchHighlight
      text={item.subtitle}
      query={normalizedQuery}
      keyPrefix={item.id + "-subtitle"}
    />
  );

  const itemVars = cssVars({
    "--searchbox-item-icon-bg": iconColorAlpha(iconRole, token, active ? 0.2 : 0.1),
    "--searchbox-item-icon-color": iconColor(iconRole, token),
  });

  return (
    <li
      key={item.id}
      role="option"
      aria-selected={active}
      onMouseEnter={() => onMouseEnter(index)}
      onClick={() => onActivate(item)}
      className={`${styles["search-box-item"]} ${active ? styles["is-active"] : ""}`}
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
            <span className={styles["search-box-tag-list"]} aria-label="Matched tags">
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
              {item.source === "hot" ? "Hot" : "Recent"}
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
