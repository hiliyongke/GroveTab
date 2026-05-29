import { useState, useMemo } from "react";
import { Button, Tag, Space } from "antd";
import { ChevronDown, Bookmark as BookmarkIcon } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { Typography } from "antd";
import { BookmarkRow } from "./BookmarkRow";
import { SubFolderGroup } from "./SubFolderGroup";
import { countBookmarks } from "@/features/bookmarks/utils/bookmark-helpers";
import type { BookmarkNode } from "@/chrome/bookmarks";
import styles from "@/features/tabs/styles/views.module.less";

function cx(...classNames: Array<string | false | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

interface TopFolderSectionProps {
  folder: BookmarkNode;
  onOpenBookmark: (url: string) => void;
  defaultOpen: boolean;
  resolveTitle: (n: BookmarkNode) => string;
}

/**
 * 顶层文件夹分区（书签栏 / 其他书签 / 移动设备）
 * 设计上不再做卡片包裹，而是用「分区头 + 内容列表」的扁平结构
 */
export function TopFolderSection({
  folder,
  onOpenBookmark,
  defaultOpen,
  resolveTitle,
}: TopFolderSectionProps) {
  const [collapsed, setCollapsed] = useState(!defaultOpen);
  const children = useMemo(() => folder.children ?? [], [folder.children]);
  const bookmarks = useMemo(() => children.filter((c) => !!c.url), [children]);
  const subFolders = useMemo(() => children.filter((c) => !c.url), [children]);
  const total = useMemo(() => countBookmarks(children), [children]);

  if (bookmarks.length === 0 && subFolders.length === 0) return null;
  const title = resolveTitle(folder);

  return (
    <Space direction="vertical" size={0} className={styles["app-bookmark-section"]}>
      <Button
        type="text"
        className={styles["app-bookmark-section__head"]}
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <ChevronDown
          size={ICON_SIZE.MEDIUM}
          className={cx(
            styles["app-bookmark-section__chevron"],
            collapsed && styles["is-collapsed"],
          )}
        />
        <Typography.Text className={styles["app-bookmark-section__badge"]}>
          <BookmarkIcon size={14} />
        </Typography.Text>
        <Typography.Title level={3} className={styles["app-bookmark-section__title"]}>
          {title}
        </Typography.Title>
        <Tag className={styles["app-bookmark-section__count"]}>{total}</Tag>
      </Button>
      {!collapsed && (
        <Space direction="vertical" size={0} className={styles["app-bookmark-section__body"]}>
          {bookmarks.length > 0 && (
            <Space direction="vertical" size={0} className={styles["app-bookmark-section__rows"]}>
              {bookmarks.map((bm) => (
                <BookmarkRow key={bm.id} node={bm} onOpen={onOpenBookmark} />
              ))}
            </Space>
          )}
          {subFolders.map((sf) => (
            <SubFolderGroup
              key={sf.id}
              folder={sf}
              onOpenBookmark={onOpenBookmark}
              depth={1}
              resolveTitle={resolveTitle}
            />
          ))}
        </Space>
      )}
    </Space>
  );
}
