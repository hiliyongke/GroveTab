import { useState, useMemo } from "react";
import { Button, Tag, Space } from "antd";
import { ChevronDown, Folder } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { Typography } from "antd";
import { BookmarkRow } from "./BookmarkRow";
import { countBookmarks } from "@/features/bookmarks/utils/bookmark-helpers";
import type { BookmarkNode } from "@/chrome/bookmarks";
import styles from "@/features/tabs/styles/views.module.less";

function cx(...classNames: Array<string | false | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

interface SubFolderGroupProps {
  folder: BookmarkNode;
  onOpenBookmark: (url: string) => void;
  depth: number;
  resolveTitle: (n: BookmarkNode) => string;
}

/**
 * 子文件夹分组（次级标题样式，无卡片包裹，用左侧缩进 + 折叠头表达层级）
 */
export function SubFolderGroup({
  folder,
  onOpenBookmark,
  depth,
  resolveTitle,
}: SubFolderGroupProps) {
  const [collapsed, setCollapsed] = useState(false);
  const children = useMemo(() => folder.children ?? [], [folder.children]);
  const bookmarks = useMemo(() => children.filter((c) => !!c.url), [children]);
  const subFolders = useMemo(() => children.filter((c) => !c.url), [children]);
  const total = useMemo(() => countBookmarks(children), [children]);

  if (bookmarks.length === 0 && subFolders.length === 0) return null;
  const title = resolveTitle(folder);

  return (
    <Space
      direction="vertical"
      size={0}
      className={styles["app-bookmark-subgroup"]}
      data-depth={depth}
    >
      <Button
        type="text"
        className={styles["app-bookmark-subgroup__head"]}
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <ChevronDown
          size={ICON_SIZE.SMALL}
          className={cx(
            styles["app-bookmark-subgroup__chevron"],
            collapsed && styles["is-collapsed"],
          )}
        />
        <Folder size={ICON_SIZE.SMALL} className={styles["app-bookmark-subgroup__icon"]} />
        <Typography.Text className={styles["app-bookmark-subgroup__title"]}>
          {title}
        </Typography.Text>
        <Tag className={styles["app-bookmark-subgroup__count"]}>{total}</Tag>
      </Button>
      {!collapsed && (
        <Space direction="vertical" size={0} className={styles["app-bookmark-subgroup__body"]}>
          {bookmarks.map((bm) => (
            <BookmarkRow key={bm.id} node={bm} onOpen={onOpenBookmark} />
          ))}
          {subFolders.map((sf) => (
            <SubFolderGroup
              key={sf.id}
              folder={sf}
              onOpenBookmark={onOpenBookmark}
              depth={depth + 1}
              resolveTitle={resolveTitle}
            />
          ))}
        </Space>
      )}
    </Space>
  );
}
