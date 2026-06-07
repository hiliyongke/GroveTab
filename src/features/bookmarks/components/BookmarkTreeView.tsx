/**
 * BookmarkTreeView — 书签树容器
 *
 * 负责：
 *   - 递归渲染 BookmarkTreeNode
 *   - 提供稳定的子节点引用（useMemo 包裹）
 *   - 集中处理拖拽事件转发
 */

import { useCallback, useMemo } from "react";
import type { MenuProps } from "antd";
import { useT } from "@/shared/i18n";
import type { BookmarkNode } from "@/chrome/bookmarks";
import { BookmarkTreeNode } from "./BookmarkTreeNode";
import styles from "../styles/BookmarkTree.module.less";

interface Callbacks {
  onContextMenu: (node: BookmarkNode) => MenuProps;
  onDelete: (id: string, title: string) => void;
  onAddChild: (parentId: string) => void;
  onEdit: (node: BookmarkNode) => void;
  onDragStart: (e: React.DragEvent, node: BookmarkNode) => void;
  onDragOver: (e: React.DragEvent, node: BookmarkNode) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, node: BookmarkNode) => void;
}

interface Props extends Callbacks {
  nodes: BookmarkNode[];
  collapsedDirs: Set<string>;
  toggleCollapse: (id: string) => void;
  dragOverId: string | null;
  selectionMode: boolean;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
}

function renderChildren(
  nodes: BookmarkNode[],
  depth: number,
  collapsedDirs: Set<string>,
  toggleCollapse: (id: string) => void,
  dragOverId: string | null,
  selectionMode: boolean,
  selectedIds: Set<string>,
  toggleSelect: (id: string) => void,
  callbacks: Callbacks,
): React.ReactNode {
  return nodes.map((node) => (
    <BookmarkTreeNode
      key={node.id}
      node={node}
      depth={depth}
      collapsed={collapsedDirs.has(node.id)}
      dragOverId={dragOverId}
      selectionMode={selectionMode}
      selected={selectedIds.has(node.id)}
      onToggleCollapse={toggleCollapse}
      onContextMenu={callbacks.onContextMenu}
      onDelete={callbacks.onDelete}
      onDragStart={callbacks.onDragStart}
      onDragOver={callbacks.onDragOver}
      onDragLeave={callbacks.onDragLeave}
      onDrop={callbacks.onDrop}
      onAddChild={callbacks.onAddChild}
      onEdit={callbacks.onEdit}
      onToggleSelect={toggleSelect}
    >
      {node.children !== undefined && !collapsedDirs.has(node.id)
        ? renderChildren(
            node.children,
            depth + 1,
            collapsedDirs,
            toggleCollapse,
            dragOverId,
            selectionMode,
            selectedIds,
            toggleSelect,
            callbacks,
          )
        : null}
    </BookmarkTreeNode>
  ));
}

export function BookmarkTreeView(props: Props) {
  const { t } = useT();
  const {
    nodes,
    collapsedDirs,
    toggleCollapse,
    dragOverId,
    selectionMode,
    selectedIds,
    toggleSelect,
    onContextMenu,
    onDelete,
    onAddChild,
    onEdit,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
  } = props;

  // 稳定 callbacks 引用，避免 BookmarkTreeNode memo 失效
  const callbacks = useMemo<Callbacks>(
    () => ({ onContextMenu, onDelete, onAddChild, onEdit, onDragStart, onDragOver, onDragLeave, onDrop }),
    [onContextMenu, onDelete, onAddChild, onEdit, onDragStart, onDragOver, onDragLeave, onDrop],
  );

  const handleToggle = useCallback(
    (id: string) => toggleCollapse(id),
    [toggleCollapse],
  );

  const children = useMemo(
    () =>
      renderChildren(
        nodes,
        0,
        collapsedDirs,
        handleToggle,
        dragOverId,
        selectionMode,
        selectedIds,
        toggleSelect,
        callbacks,
      ),
    [nodes, collapsedDirs, handleToggle, dragOverId, selectionMode, selectedIds, toggleSelect, callbacks],
  );

  return (
    <div className={styles["tree-view"]} role="tree" aria-label={t("书签树")}>
      {children}
    </div>
  );
}
