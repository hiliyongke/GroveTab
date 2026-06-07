/**
 * SmartTagList — 智能标签快速过滤
 *
 * 点击 tag 即可触发搜索（与父级 query 同步）。
 */

import { Tag, Flex } from "antd";
import { useT } from "@/shared/i18n";
import type { BookmarkNode } from "@/chrome/bookmarks";
import { groupBySmartTag } from "../utils/smart-tags";

const MAX_TAGS = 8;

interface Props {
  nodes: BookmarkNode[];
  onSelectTag: (tag: string) => void;
}

export function SmartTagList({ nodes, onSelectTag }: Props) {
  const { t } = useT();
  const groups = groupBySmartTag(nodes).slice(0, MAX_TAGS);
  if (groups.length === 0) return null;

  return (
    <Flex className="bookmark-smart-tags" wrap="wrap" gap={4} role="list" aria-label={t("智能分类")}>
      {groups.map(([tag, items]) => (
        <Tag
          key={tag}
          color="blue"
          className="bookmark-smart-tags__item"
          onClick={() => onSelectTag(tag)}
          role="listitem"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelectTag(tag);
            }
          }}
        >
          {tag} ({items.length})
        </Tag>
      ))}
    </Flex>
  );
}
