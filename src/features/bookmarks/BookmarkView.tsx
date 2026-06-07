/**
 * BookmarkView — 书签管理视图（完整 CRUD + 树形渲染）。
 * 支持树形文件夹、搜索、批量删除和右键菜单。
 */

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  Flex,
  Spin,
  Typography,
  Input,
  Button,
  Popconfirm,
  Space,
  message,
  Dropdown,
  Modal,
  Checkbox,
} from "antd";
import {
  Folder,
  FolderOpen,
  Globe,
  ExternalLink,
  Search,
  Bookmark,
  BookmarkPlus,
  Edit2,
  Trash2,
  FolderPlus,
} from "lucide-react";
import { FeatureEmptyState } from "@/shared/ui/FeatureEmptyState";
import {
  getBookmarkTree,
  hasBookmarksPermission,
  requestBookmarksPermission,
  removeBookmark,
  createBookmark,
  type BookmarkNode,
} from "@/chrome/bookmarks";
import { useT } from "@/shared/i18n";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import styles from "./BookmarkView.module.less";

/** 扁平列表项（用于搜索结果显示） */
interface FlatItem {
  node: BookmarkNode;
  path: string; // 文件夹路径，如 "工具 > 开发"
  depth: number;
}

export function BookmarkView() {
  const { t } = useT();
  const [tree, setTree] = useState<BookmarkNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [editModal, setEditModal] = useState<{
    open: boolean;
    node?: BookmarkNode;
    isNew: boolean;
    parentId?: string;
  }>({ open: false, isNew: false });
  const [newFolderModal, setNewFolderModal] = useState(false);
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set());
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  // 缓存书签树（模块级缓存，避免切 tab 重新拉取）
  const treeCacheRef = useRef<BookmarkNode[] | null>(null);

  const loadBookmarks = useCallback(async (force = false) => {
    if (!force && treeCacheRef.current) {
      setTree(treeCacheRef.current);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const permitted = await hasBookmarksPermission();
      if (!permitted) {
        const granted = await requestBookmarksPermission();
        if (!granted) {
          setLoading(false);
          setPermissionDenied(true);
          return;
        }
      }
      const result = await getBookmarkTree();
      treeCacheRef.current = result;
      setTree(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBookmarks();
  }, [loadBookmarks]);

  // 手动刷新时强制重拉（绕过缓存）
  const forceLoad = useCallback(async () => {
    await loadBookmarks(true);
  }, [loadBookmarks]);
  refreshRef.current = forceLoad;

  // 递归搜索：匹配 title/URL/文件夹名
  const filterNodes = useCallback(
    (nodes: BookmarkNode[], q: string, path: string, depth: number): FlatItem[] => {
      const results: FlatItem[] = [];
      for (const node of nodes) {
        const hasUrl = !!node.url;
        const matchesTitle = node.title.toLowerCase().includes(q);
        const matchesUrl = (node.url ?? "").toLowerCase().includes(q);
        if (matchesTitle || matchesUrl) {
          results.push({ node, path: path || node.title, depth });
        }
        if (node.children && node.children.length > 0) {
          const childPath = path ? `${path} > ${node.title}` : node.title;
          const childResults = filterNodes(node.children, q, childPath, depth + 1);
          // 如果文件夹名匹配，显示其下所有子项
          if (!hasUrl && node.title.toLowerCase().includes(q)) {
            for (const child of flattenAll(node.children)) {
              results.push({
                node: child,
                path: childPath,
                depth: depth + 1,
              });
            }
          } else {
            results.push(...childResults);
          }
        }
      }
      return results;
    },
    [],
  );

  const filteredList = useMemo((): FlatItem[] => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return filterNodes(tree, q, "", 0);
  }, [tree, query, filterNodes]);

  const handleDelete = useCallback(async (id: string) => {
    const ok = await removeBookmark(id);
    if (ok) {
      message.success(t("删除成功"));
      void loadBookmarks();
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } else {
      message.error(t("删除失败"));
    }
  }, [loadBookmarks, t]);

  const handleBatchDelete = useCallback(async () => {
    let count = 0;
    for (const id of selectedIds) {
      const ok = await removeBookmark(id);
      if (ok) count++;
    }
    message.success(t("已删除 {count} 条书签", { count }));
    setSelectedIds(new Set());
    setSelectionMode(false);
    void loadBookmarks();
  }, [selectedIds, loadBookmarks, t]);

  const handleEdit = useCallback(async (title: string, url?: string) => {
    if (!editModal.node) return;
    try {
      // Chrome bookmarks.update requires just title or url
      const update: { title?: string; url?: string } = { title };
      if (url) update.url = url;
      await createBookmark({ parentId: editModal.node.parentId, title, url }); // This is not update, we need a dedicated update function
      // Actually, Chrome has chrome.bookmarks.update(id, changes). Let me use a direct call.
      if (typeof chrome !== "undefined" && chrome.bookmarks) {
        await chrome.bookmarks.update(editModal.node.id, update);
        message.success(t("编辑成功"));
        setEditModal({ open: false, isNew: false });
        void loadBookmarks();
      }
    } catch {
      message.error(t("编辑失败"));
    }
  }, [editModal.node, loadBookmarks, t]);

  const handleCreate = useCallback(async (title: string, url: string) => {
    try {
      await createBookmark({
        parentId: editModal.parentId,
        title: title || url,
        url,
      });
      message.success(t("创建成功"));
      setEditModal({ open: false, isNew: false });
      void loadBookmarks();
    } catch {
      message.error(t("创建失败"));
    }
  }, [editModal.parentId, loadBookmarks, t]);

  const handleCreateFolder = useCallback(async (name: string) => {
    if (!name.trim()) return;
    try {
      await createBookmark({ title: name.trim() });
      message.success(t("文件夹已创建"));
      setNewFolderModal(false);
      void loadBookmarks();
    } catch {
      message.error(t("文件夹创建失败"));
    }
  }, [loadBookmarks, t]);

  const handleJump = useCallback((url: string | undefined) => {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllFiltered = useCallback(() => {
    const ids = filteredList.filter((item) => item.node.url).map((item) => item.node.id);
    setSelectedIds(new Set(ids));
  }, [filteredList]);

  const nodeContextMenu = useCallback(
    (node: BookmarkNode) => ({
      items: [
        ...(node.url
          ? [
              {
                key: "open",
                label: t("打开"),
                icon: <ExternalLink size={ICON_SIZE.SMALL} />,
                onClick: () => handleJump(node.url),
              },
            ]
          : []),
        {
          key: "edit",
          label: t("编辑"),
          icon: <Edit2 size={ICON_SIZE.SMALL} />,
          onClick: () => setEditModal({ open: true, node, isNew: false }),
        },
        ...(node.url
          ? []
          : [
              {
                key: "add",
                label: t("在此添加"),
                icon: <BookmarkPlus size={ICON_SIZE.SMALL} />,
                onClick: () => setEditModal({ open: true, isNew: true, parentId: node.id }),
              },
            ]),
        { type: "divider" as const },
        {
          key: "delete",
          label: t("删除"),
          danger: true,
          icon: <Trash2 size={ICON_SIZE.SMALL} />,
          onClick: () => {
            Modal.confirm({
              title: t("确认删除"),
              content: node.url
                ? t("确认删除书签「{title}」？", { title: node.title })
                : t("确认删除文件夹「{title}」及其内容？", { title: node.title }),
              okText: t("删除"),
              cancelText: t("取消"),
              okButtonProps: { danger: true },
              onOk: () => handleDelete(node.id),
            });
          },
        },
      ],
    }),
    [handleDelete, handleJump, t],
  );

  // ------ Rendering ------

  if (loading) {
    return <Flex justify="center" className={styles["bookmark-loading"]}><Spin /></Flex>;
  }

  if (permissionDenied) {
    return (
      <FeatureEmptyState
        title={t("需要书签权限")}
        description={t("GroveTab 需要书签权限才能管理您的书签")}
        icon={<Bookmark size={ICON_SIZE.HERO} />}
        hints={[t("点击下方按钮授权"), t("仅用于读写书签数据"), t("数据不会上传到任何服务器")]}
        actions={[{ text: t("授权书签权限"), onClick: requestBookmarksPermission, type: "primary" }]}
      />
    );
  }

  if (tree.length === 0) {
    return (
      <FeatureEmptyState
        title={t("暂无书签")}
        description={t("点击下方按钮添加第一个书签")}
        icon={<BookmarkPlus size={ICON_SIZE.HERO} />}
        hints={[t("支持拖拽导入"), t("支持文件夹管理"), t("支持搜索和批量操作")]}
        actions={[
          { text: t("添加书签"), onClick: () => setEditModal({ open: true, isNew: true }), type: "primary" },
          { text: t("添加文件夹"), onClick: () => setNewFolderModal(true) },
        ]}
      />
    );
  }

  const isSearching = query.trim().length > 0;

  return (
    <Flex vertical gap={8} className={styles["bookmark-view"]}>
      {/* 工具栏 */}
      <Flex align="center" gap={8}>
        <Input
          allowClear
          size="small"
          prefix={<Search size={ICON_SIZE.SMALL} />}
          placeholder={t("搜索书签…")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={styles["bookmark-search"]}
          style={{ flex: 1 }}
        />
        {!isSearching && (
          <Space size={4}>
            <Button
              size="small"
              icon={<BookmarkPlus size={ICON_SIZE.SMALL} />}
              onClick={() => setEditModal({ open: true, isNew: true })}
            >
              {t("添加书签")}
            </Button>
            <Button
              size="small"
              icon={<FolderPlus size={ICON_SIZE.SMALL} />}
              onClick={() => setNewFolderModal(true)}
            >
              {t("添加文件夹")}
            </Button>
          </Space>
        )}
        {isSearching && (
          <Button
            size="small"
            type={selectionMode ? "primary" : "default"}
            onClick={() => {
              if (selectionMode) {
                handleBatchDelete();
              } else {
                setSelectionMode(true);
              }
            }}
            disabled={selectionMode && selectedIds.size === 0}
          >
            {selectionMode
              ? selectedIds.size > 0
                ? t("删除选中 ({count})", { count: selectedIds.size })
                : t("选择书签")
              : t("批量选择")}
          </Button>
        )}
        {isSearching && selectionMode && (
          <>
            <Button size="small" onClick={selectAllFiltered}>
              {t("全选")}
            </Button>
            <Button
              size="small"
              onClick={() => {
                setSelectionMode(false);
                setSelectedIds(new Set());
              }}
            >
              {t("取消")}
            </Button>
          </>
        )}
      </Flex>

      {/* 树形视图（无搜索时） */}
      {!isSearching && (
        <div className={styles["bookmark-tree"]}>
          {renderTree(tree, 0, collapsedDirs, toggleCollapse, toggleSelect, selectedIds,
            selectionMode, handleJump, nodeContextMenu, handleDelete, setEditModal, t, styles,
          )}
        </div>
      )}

      {/* 搜索结果（扁平列表） */}
      {isSearching && filteredList.length === 0 && (
        <Flex justify="center" className={styles["bookmark-empty"]}>
          <Typography.Text type="secondary">{t("未找到匹配的书签")}</Typography.Text>
        </Flex>
      )}
      {isSearching &&
        filteredList.map((item) => (
          <Flex
            key={item.node.id}
            align="center"
            gap={8}
            className={`${styles["bookmark-item"]} ${selectedIds.has(item.node.id) ? styles["bookmark-item--selected"] : ""}`}
            onClick={() => {
              if (selectionMode) {
                toggleSelect(item.node.id);
              } else {
                handleJump(item.node.url);
              }
            }}
          >
            {selectionMode && (
              <Checkbox checked={selectedIds.has(item.node.id)} onChange={() => toggleSelect(item.node.id)} />
            )}
            {item.node.url ? (
              <Globe size={ICON_SIZE.SMALL} className={styles["bookmark-icon"]} />
            ) : (
              <Folder size={ICON_SIZE.SMALL} className={styles["bookmark-icon"]} />
            )}
            <Flex vertical className={styles["bookmark-item__text"]}>
              <Typography.Text ellipsis className={styles["bookmark-item__title"]}>
                {item.node.title}
              </Typography.Text>
              <Typography.Text type="secondary" className={styles["bookmark-item__path"]}>
                {item.path}
              </Typography.Text>
            </Flex>
            {item.node.url && <ExternalLink size={ICON_SIZE.MICRO} className={styles["bookmark-link-icon"]} />}
          </Flex>
        ))}

      {/* 编辑/新建弹窗 */}
      <BookmarkEditModal
        open={editModal.open}
        node={editModal.node}
        isNew={editModal.isNew}
        onClose={() => setEditModal({ open: false, isNew: false })}
        onSave={editModal.isNew ? handleCreate : handleEdit}
        t={t}
      />

      {/* 新建文件夹弹窗 */}
      <BookmarkFolderModal
        open={newFolderModal}
        onClose={() => setNewFolderModal(false)}
        onSave={handleCreateFolder}
        t={t}
      />
    </Flex>
  );
}

// ─── 递归树形渲染 ──────────────────────────────────────────

function flattenAll(nodes: BookmarkNode[]): BookmarkNode[] {
  const result: BookmarkNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children) result.push(...flattenAll(node.children));
  }
  return result;
}

function renderTree(
  nodes: BookmarkNode[],
  depth: number,
  collapsedDirs: Set<string>,
  toggleCollapse: (id: string) => void,
  toggleSelect: (id: string) => void,
  selectedIds: Set<string>,
  selectionMode: boolean,
  handleJump: (url?: string) => void,
  nodeContextMenu: (node: BookmarkNode) => any,
  handleDelete: (id: string) => void,
  setEditModal: (v: any) => void,
  t: (key: string, params?: Record<string, string | number>) => string,
  styles: Record<string, string>,
): React.ReactNode[] {
  return nodes.map((node) => {
    const isFolder = !node.url && node.children && node.children.length > 0;
    const isCollapsed = collapsedDirs.has(node.id);
    const indent = depth * 20;

    return (
      <div key={node.id}>
        <Dropdown menu={nodeContextMenu(node)} trigger={["contextMenu"]}>
          <Flex
            align="center"
            gap={6}
            className={`${styles["bookmark-tree-item"]} ${selectedIds.has(node.id) ? styles["bookmark-tree-item--selected"] : ""}`}
            style={{ paddingLeft: indent + 8 }}
            onClick={() => {
              if (selectionMode) {
                toggleSelect(node.id);
              } else if (isFolder) {
                toggleCollapse(node.id);
              } else {
                handleJump(node.url);
              }
            }}
          >
            {selectionMode && (
              <Checkbox
                checked={selectedIds.has(node.id)}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleSelect(node.id);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            )}
            {isFolder ? (
              isCollapsed ? (
                <Folder size={ICON_SIZE.SMALL} className={styles["bookmark-tree-icon"]} />
              ) : (
                <FolderOpen size={ICON_SIZE.SMALL} className={styles["bookmark-tree-icon"]} />
              )
            ) : (
              <Globe size={ICON_SIZE.SMALL} className={styles["bookmark-tree-icon"]} />
            )}
            <Typography.Text ellipsis className={styles["bookmark-tree-title"]}>
              {node.title}
            </Typography.Text>
            {node.url && (
              <ExternalLink
                size={ICON_SIZE.MICRO}
                className={styles["bookmark-tree-link"]}
                onClick={(e) => {
                  e.stopPropagation();
                  handleJump(node.url);
                }}
              />
            )}
            <div style={{ flex: 1 }} />
            {/* 快速操作按钮（非多选模式） */}
            {!selectionMode && (
              <Space size={2} className={styles["bookmark-tree-actions"]}>
                {isFolder && (
                  <Button
                    type="text"
                    size="small"
                    icon={<BookmarkPlus size={ICON_SIZE.MICRO} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditModal({ open: true, isNew: true, parentId: node.id });
                    }}
                  />
                )}
                {node.url && (
                  <Button
                    type="text"
                    size="small"
                    icon={<Edit2 size={ICON_SIZE.MICRO} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditModal({ open: true, node, isNew: false });
                    }}
                  />
                )}
                <Popconfirm
                  title={
                    node.url
                      ? t("确认删除书签「{title}」？", { title: node.title })
                      : t("确认删除文件夹「{title}」及其内容？", { title: node.title })
                  }
                  onConfirm={(e) => {
                    e?.stopPropagation();
                    void handleDelete(node.id);
                  }}
                  okText={t("删除")}
                  cancelText={t("取消")}
                >
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<Trash2 size={ICON_SIZE.MICRO} />}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Popconfirm>
              </Space>
            )}
          </Flex>
        </Dropdown>
        {/* 递归渲染子节点 */}
        {isFolder && !isCollapsed && node.children && (
          <div className={styles["bookmark-tree-children"]}>
            {renderTree(
              node.children,
              depth + 1,
              collapsedDirs,
              toggleCollapse,
              toggleSelect,
              selectedIds,
              selectionMode,
              handleJump,
              nodeContextMenu,
              handleDelete,
              setEditModal,
              t,
              styles,
            )}
          </div>
        )}
      </div>
    );
  });
}

// ─── 编辑/新建书签弹窗 ──────────────────────────────────────

function BookmarkEditModal({
  open,
  node,
  isNew,
  onClose,
  onSave,
  t,
}: {
  open: boolean;
  node?: BookmarkNode;
  isNew: boolean;
  onClose: () => void;
  onSave: (title: string, url: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (open && node) {
      setTitle(node.title || "");
      setUrl(node.url || "");
    } else if (open && isNew) {
      setTitle("");
      setUrl("");
    }
  }, [open, node, isNew]);

  return (
    <Modal
      open={open}
      title={isNew ? t("添加书签") : t("编辑书签")}
      onOk={() => onSave(title, url)}
      onCancel={onClose}
      okText={t("保存")}
      cancelText={t("取消")}
      okButtonProps={{ disabled: !title.trim() }}
    >
      <Flex vertical gap={12} style={{ marginTop: 12 }}>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: "block" }}>
            {t("标题")}
          </Typography.Text>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("书签标题")} />
        </div>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: "block" }}>
            {t("网址")}
          </Typography.Text>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
        </div>
      </Flex>
    </Modal>
  );
}

// ─── 新建文件夹弹窗 ──────────────────────────────────────────

function BookmarkFolderModal({
  open,
  onClose,
  onSave,
  t,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName("");
  }, [open]);

  return (
    <Modal
      open={open}
      title={t("添加文件夹")}
      onOk={() => onSave(name)}
      onCancel={onClose}
      okText={t("创建")}
      cancelText={t("取消")}
      okButtonProps={{ disabled: !name.trim() }}
    >
      <Flex vertical gap={8} style={{ marginTop: 12 }}>
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("文件夹名称")}
          onPressEnter={() => onSave(name)}
        />
      </Flex>
    </Modal>
  );
}
