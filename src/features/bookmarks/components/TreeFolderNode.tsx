/**
 * 文件夹节点（可折叠/展开）
 *
 * - horizontal：自身在左，children 在右
 * - vertical  ：自身在上，children 在下
 */

import { useState, useRef, useCallback, useMemo, useContext } from "react";
import { Button, Typography, Flex } from "antd";
import { Folder, FolderOpen, ChevronRight, ChevronDown } from "lucide-react";
import type { BookmarkNode } from "@/chrome/bookmarks";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import { countBookmarks, sortChildrenByType } from "../utils/tree-helpers";
import { CenterOnExpandContext } from "../hooks/use-center-on-expand";
import { TreeLeafNode } from "./TreeLeafNode";
import styles from "../styles/bookmark-tree.module.less";

interface TreeFolderNodeProps {
  folder: BookmarkNode;
  onOpenBookmark: (url: string) => void;
  resolveTitle: (n: BookmarkNode) => string;
  defaultExpanded: boolean;
  depth: number;
  orientation: "horizontal" | "vertical";
}

export function TreeFolderNode({
  folder,
  onOpenBookmark,
  resolveTitle,
  defaultExpanded,
  depth,
  orientation,
}: TreeFolderNodeProps) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const folderBtnRef = useRef<HTMLButtonElement | null>(null);
  const centerOnExpand = useContext(CenterOnExpandContext);
  const children = useMemo(() => folder.children ?? [], [folder.children]);
  const total = useMemo(() => countBookmarks(children), [children]);
  const folderCount = useMemo(() => children.filter((c) => !c.url).length, [children]);
  const linkCount = total;

  const title = resolveTitle(folder);
  const isEmpty = children.length === 0;

  // 排序：文件夹优先，然后是书签，保持 Chrome 默认顺序
  const orderedChildren = useMemo(() => sortChildrenByType(children), [children]);

  const handleToggle = useCallback(() => {
    if (isEmpty) return;
    setExpanded((prev) => {
      const next = !prev;
      // 仅在「即将展开」时把节点居中，避免折叠也跳动
      if (next && folderBtnRef.current && centerOnExpand) {
        // 等子树渲染后再居中，确保几何位置稳定
        requestAnimationFrame(() => {
          if (folderBtnRef.current) centerOnExpand(folderBtnRef.current);
        });
      }
      return next;
    });
  }, [isEmpty, centerOnExpand]);

  return (
    <Flex className={styles.folderWrap} data-depth={depth}>
      <Button
        ref={folderBtnRef}
        type="text"
        className={`${styles.folder}${expanded ? ` ${styles.folderIsExpanded}` : ""}${isEmpty ? ` ${styles.folderIsEmpty}` : ""}`}
        onClick={handleToggle}
        aria-expanded={expanded}
        title={title}
      >
        <Flex align="center" justify="center" className={styles.folderIcon}>
          {expanded ? <FolderOpen size={ICON_SIZE.SMALL} /> : <Folder size={ICON_SIZE.SMALL} />}
        </Flex>
        <Flex vertical className={styles.folderText}>
          <Typography.Text className={styles.folderTitle}>{title}</Typography.Text>
          <Flex className={styles.folderMeta}>
            {folderCount > 0 && (
              <Typography.Text className={`${styles.folderStat}`}>📁 {folderCount}</Typography.Text>
            )}
            {linkCount > 0 && (
              <Typography.Text className={`${styles.folderStat}`}>🔗 {linkCount}</Typography.Text>
            )}
            {isEmpty && (
              <Typography.Text className={`${styles.folderStat} ${styles.folderStatIsMuted}`}>
                {t("空")}
              </Typography.Text>
            )}
          </Flex>
        </Flex>
        {!isEmpty &&
          (orientation === "horizontal" ? (
            <ChevronRight
              size={ICON_SIZE.SMALL}
              className={`${styles.folderChevron}${expanded ? ` ${styles.folderChevronIsExpanded}` : ""}`}
            />
          ) : (
            <ChevronDown
              size={ICON_SIZE.SMALL}
              className={`${styles.folderChevron} is-vertical${expanded ? ` ${styles.folderChevronIsExpanded}` : ""}`}
            />
          ))}
      </Button>

      {expanded && !isEmpty && (
        <Flex className={styles.children} role="group">
          {/* 横向（脑图）模式：仍用 SVG 贝塞尔曲线；垂直（组织架构图）模式：用纯 CSS 伪元素绘制直角连线，永不错位 */}
          {orientation === "horizontal" && (
            <svg
              className={styles.connector}
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
              aria-hidden="true"
            >
              {orderedChildren.map((_, idx) => {
                const childCount = orderedChildren.length;
                const cross = childCount === 1 ? 50 : (idx + 0.5) * (100 / childCount);
                const d = `M 0 50 C 50 50, 50 ${cross}, 100 ${cross}`;
                return (
                  <path
                    key={idx}
                    className={styles.connectorPath}
                    d={d}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>
          )}

          <Flex
            className={`${styles.childrenCol}${orderedChildren.length === 1 ? ` ${styles.childrenColIsSingle}` : ""}`}
          >
            {orderedChildren.map((child) =>
              child.url ? (
                <TreeLeafNode key={child.id} node={child} onOpen={onOpenBookmark} />
              ) : (
                <TreeFolderNode
                  key={child.id}
                  folder={child}
                  onOpenBookmark={onOpenBookmark}
                  resolveTitle={resolveTitle}
                  defaultExpanded={false}
                  depth={depth + 1}
                  orientation={orientation}
                />
              ),
            )}
          </Flex>
        </Flex>
      )}
    </Flex>
  );
}
