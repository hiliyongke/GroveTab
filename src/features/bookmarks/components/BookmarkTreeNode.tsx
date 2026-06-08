/**
 * BookmarkTreeNode — 书签树节点（递归组件）
 *
 * 性能优化：
 *   - React.memo + 自定义比较函数，仅在 props 变化时重渲染
 *   - 右键菜单回调通过 props 注入，避免每个节点新建函数
 *   - 折叠状态由父级集中管理
 *
 * 可访问性：
 *   - role="treeitem" / aria-expanded（文件夹）
 *   - 键盘：Enter 打开/折叠，Delete 提示删除
 *   - 焦点样式由 CSS 提供
 */

import { memo, useCallback, useMemo } from "react";
import { Button, Dropdown, Popconfirm, Space, Tooltip } from "antd";
import type { MenuProps } from "antd";
import {
  Folder,
  FolderOpen,
  Globe,
  ExternalLink,
  Edit2,
  Trash2,
  BookmarkPlus,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import { feedback } from "@/shared/ui/feedback";
import type { BookmarkNode } from "@/chrome/bookmarks";
import { isFolder, getFaviconUrl } from "../utils/bookmark-tree";
import styles from "../styles/BookmarkTree.module.less";

interface NodeCallbacks {
  onToggleCollapse: (id: string) => void;
  onContextMenu: (node: BookmarkNode) => MenuProps;
  onDelete: (id: string, title: string) => void;
  onDragStart: (e: React.DragEvent, node: BookmarkNode) => void;
  onDragOver: (e: React.DragEvent, node: BookmarkNode) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, node: BookmarkNode) => void;
  onAddChild: (parentId: string) => void;
  onEdit: (node: BookmarkNode) => void;
}

interface Props extends NodeCallbacks {
  node: BookmarkNode;
  depth: number;
  collapsed: boolean;
  dragOverId: string | null;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  children?: React.ReactNode;
}

function BookmarkTreeNodeImpl({
  node,
  depth,
  collapsed,
  dragOverId,
  selectionMode,
  selected,
  onToggleCollapse,
  onContextMenu,
  onDelete,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onAddChild,
  onEdit,
  onToggleSelect,
  children,
}: Props) {
  const { t } = useT();
  const folder = isFolder(node);
  const indent = depth * 20;

  const handleClick = useCallback(() => {
    if (selectionMode) {
      onToggleSelect(node.id);
      return;
    }
    if (folder) onToggleCollapse(node.id);
    else if (node.url !== undefined) window.open(node.url, "_blank", "noopener,noreferrer");
  }, [selectionMode, onToggleSelect, folder, onToggleCollapse, node]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (!selectionMode) {
          e.preventDefault();
          onDelete(node.id, node.title);
        }
      }
    },
    [handleClick, selectionMode, onDelete, node],
  );

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (node.url === undefined) return;
      void navigator.clipboard
        .writeText(node.url)
        .then(() => feedback.success(t("已复制链接")))
        .catch(() => feedback.warning(t("复制失败")));
    },
    [node.url, t],
  );

  const isDragOver = dragOverId === node.id;

  const nodeClass = useMemo(
    () =>
      [
        styles["tree-node"],
        isDragOver ? styles["tree-node--dragover"] : "",
        selected ? styles["tree-node--selected"] : "",
        selectionMode ? styles["tree-node--selection"] : "",
      ]
        .filter(Boolean)
        .join(" "),
    [isDragOver, selected, selectionMode],
  );

  return (
    <div className={styles["tree-node-wrap"]}>
      <Dropdown menu={onContextMenu(node)} trigger={["contextMenu"]}>
        <div
          className={nodeClass}
          style={{ paddingLeft: indent + 8 }}
          draggable
          role="treeitem"
          aria-expanded={folder ? !collapsed : undefined}
          aria-selected={selectionMode ? selected : undefined}
          tabIndex={0}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onDragStart={(e) => onDragStart(e, node)}
          onDragOver={(e) => onDragOver(e, node)}
          onDragLeave={onDragLeave}
          onDrop={(e) => onDrop(e, node)}
        >
          {selectionMode && (
            <input
              type="checkbox"
              className={styles["tree-node__checkbox"]}
              checked={selected}
              onChange={() => onToggleSelect(node.id)}
              onClick={(e) => e.stopPropagation()}
              aria-label={t("选择 {title}", { title: node.title })}
            />
          )}
          {folder ? (
            collapsed ? (
              <Folder size={16} className={styles["tree-node__icon--folder-closed"]} />
            ) : (
              <FolderOpen size={16} className={styles["tree-node__icon--folder-open"]} />
            )
          ) : node.url !== undefined ? (
            <img
              src={getFaviconUrl(node.url)}
              alt=""
              width={16}
              height={16}
              className={styles["tree-node__favicon"]}
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <Globe size={16} className={styles["tree-node__icon--globe"]} />
          )}
          <span className={styles["tree-node__title"]}>{node.title}</span>
          {folder && (
            <ChevronRight
              size={12}
              className={`${styles["tree-node__chevron"]} ${
                collapsed ? "" : styles["tree-node__chevron--open"]
              }`}
            />
          )}
          <Space size={2} className={styles["tree-node__actions"]}>
            {folder && (
              <Tooltip title={t("在此添加书签")}>
                <Button
                  type="text"
                  size="small"
                  icon={<BookmarkPlus size={ICON_SIZE.MICRO} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddChild(node.id);
                  }}
                />
              </Tooltip>
            )}
            {node.url !== undefined && (
              <Tooltip title={t("复制链接")}>
                <Button
                  type="text"
                  size="small"
                  icon={<Copy size={ICON_SIZE.MICRO} />}
                  onClick={handleCopy}
                />
              </Tooltip>
            )}
            {node.url !== undefined && (
              <Tooltip title={t("打开")}>
                <Button
                  type="text"
                  size="small"
                  icon={<ExternalLink size={ICON_SIZE.MICRO} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(node.url, "_blank", "noopener,noreferrer");
                  }}
                />
              </Tooltip>
            )}
            <Tooltip title={t("编辑")}>
              <Button
                type="text"
                size="small"
                icon={<Edit2 size={ICON_SIZE.MICRO} />}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(node);
                }}
              />
            </Tooltip>
            <Popconfirm
              title={t("确定删除吗？")}
              okText={t("删除")}
              cancelText={t("取消")}
              onConfirm={(e) => {
                e?.stopPropagation();
                onDelete(node.id, node.title);
              }}
              onCancel={(e) => e?.stopPropagation()}
            >
              <Tooltip title={t("删除")}>
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<Trash2 size={ICON_SIZE.MICRO} />}
                  onClick={(e) => e.stopPropagation()}
                />
              </Tooltip>
            </Popconfirm>
          </Space>
          {/* 隐藏的复制成功指示器供样式使用 */}
          <Check size={0} aria-hidden />
        </div>
      </Dropdown>
      {folder && !collapsed && children}
    </div>
  );
}

/**
 * memo 包装：仅在关键 props 变化时重渲染。
 * 忽略 children 引用变化（父级用 useMemo 稳定 children 即可）。
 */
export const BookmarkTreeNode = memo(BookmarkTreeNodeImpl, (prev, next) => {
  return (
    prev.node === next.node &&
    prev.depth === next.depth &&
    prev.collapsed === next.collapsed &&
    prev.dragOverId === next.dragOverId &&
    prev.selectionMode === next.selectionMode &&
    prev.selected === next.selected &&
    prev.onContextMenu === next.onContextMenu &&
    prev.onDelete === next.onDelete &&
    prev.onDragStart === next.onDragStart &&
    prev.onDragOver === next.onDragOver &&
    prev.onDragLeave === next.onDragLeave &&
    prev.onDrop === next.onDrop &&
    prev.onAddChild === next.onAddChild &&
    prev.onEdit === next.onEdit &&
    prev.onToggleCollapse === next.onToggleCollapse &&
    prev.onToggleSelect === next.onToggleSelect
  );
});
