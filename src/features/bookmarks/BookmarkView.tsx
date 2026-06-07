/**
 * BookmarkView — 书签管理视图（v2.0 重构版）
 *
 * 模块结构：
 *   - utils/        纯函数（树操作、IO、智能标签、链接检测）
 *   - hooks/        状态管理（树加载、偏好、链接检测、重复查找）
 *   - components/   展示组件（工具栏、选择栏、统计、智能标签、树、模态框）
 *   - styles/       共享样式
 *
 * 设计目标：
 *   - 关注点分离：主组件仅做编排，业务逻辑下沉到 hooks
 *   - 可访问性：所有可交互元素支持键盘 + ARIA
 *   - 性能：节点 memo、回调稳定、拖拽增量更新
 *   - 体验：聚焦反馈、loading 骨架、明确操作反馈
 */

import { useCallback, useDeferredValue, useMemo, useRef, useState } from "react";
import { Flex, Spin, message, Modal } from "antd";
import type { MenuProps, UploadProps } from "antd";
import {
  ExternalLink,
  Edit2,
  Trash2,
  BookmarkPlus,
} from "lucide-react";
import {
  createBookmark,
  moveBookmark,
  removeBookmark,
  updateBookmark,
  type BookmarkNode,
} from "@/chrome/bookmarks";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import { FeatureEmptyState } from "@/shared/ui/FeatureEmptyState";
import { feedback } from "@/shared/ui/feedback";

import { useBookmarkTree } from "./hooks/use-bookmark-tree";
import { useBookmarkViewPrefs } from "./hooks/use-bookmark-view-prefs";
import { useLinkChecker } from "./hooks/use-link-checker";
import { useDuplicateFinder } from "./hooks/use-duplicate-finder";
import {
  buildFlatList,
  collectUrlBookmarks,
  isFolder,
  searchTree,
} from "./utils/bookmark-tree";
import { downloadFile, parseImport, toMarkdown, toNetscapeHtml } from "./utils/bookmark-io";

import { BookmarkToolbar } from "./components/BookmarkToolbar";
import { BookmarkSelectionBar } from "./components/BookmarkSelectionBar";
import { BookmarkStatsBar } from "./components/BookmarkStatsBar";
import { SmartTagList } from "./components/SmartTagList";
import { BookmarkRecentList } from "./components/BookmarkRecentList";
import { BookmarkSearchResults } from "./components/BookmarkSearchResults";
import { BookmarkTreeView } from "./components/BookmarkTreeView";
import { BookmarkEditModal } from "./components/BookmarkEditModal";
import { NewFolderModal } from "./components/NewFolderModal";
import { BrokenLinksModal } from "./components/BrokenLinksModal";
import { DuplicatesModal } from "./components/DuplicatesModal";

import styles from "./BookmarkView.module.less";

// ─── Edit modal state ─────────────────────────────────────────
interface EditState {
  open: boolean;
  isNew: boolean;
  node?: BookmarkNode;
  parentId?: string;
}

const EMPTY_EDIT: EditState = { open: false, isNew: false };

export function BookmarkView() {
  const { t } = useT();

  // ── 数据 ──
  const { tree, loading, permissionDenied, refresh, requestPermission, invalidate } =
    useBookmarkTree();

  // ── 视图偏好 ──
  const { viewTab, setViewTab, sortMode, setSortMode, collapsedDirs, toggleCollapsed } =
    useBookmarkViewPrefs();

  // ── 工具状态 ──
  const linkChecker = useLinkChecker();
  const dupFinder = useDuplicateFinder();

  // ── 局部 UI 状态 ──
  const [query, setQuery] = useState("");
  /** 延迟值：搜索/过滤使用，让输入保持流畅（不阻塞 keystroke） */
  const deferredQuery = useDeferredValue(query);
  const [editModal, setEditModal] = useState<EditState>(EMPTY_EDIT);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBrokenModal, setShowBrokenModal] = useState(false);
  const [showDupModal, setShowDupModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const isSearching = deferredQuery.trim().length > 0;

  // ── 排序 ──
  // 关键：原地的 children 数组重新排序，但**节点对象本身保持引用稳定**。
  // 这样 BookmarkTreeNode 的 React.memo 才能在排序时不重渲染整棵树。
  const sortedTree = useMemo(() => {
    if (sortMode === "default") return tree;
    const walk = (nodes: BookmarkNode[]): BookmarkNode[] => {
      const arr = [...nodes];
      arr.sort((a, b) => {
        const aFolder = isFolder(a);
        const bFolder = isFolder(b);
        if (aFolder !== bFolder) return aFolder ? -1 : 1;
        if (sortMode === "name") return a.title.localeCompare(b.title);
        return 0;
      });
      // 原地修改 children 引用，**不**新建节点对象
      for (const n of arr) {
        if (n.children !== undefined) {
          (n as { children: BookmarkNode[] }).children = walk(n.children);
        }
      }
      return arr;
    };
    return walk(tree);
  }, [tree, sortMode]);

  // ── 统计 ──
  const stats = useMemo(() => {
    let total = 0;
    let folders = 0;
    const walk = (nodes: BookmarkNode[]): void => {
      for (const n of nodes) {
        if (n.url !== undefined) total++;
        else folders++;
        if (n.children) walk(n.children);
      }
    };
    walk(tree);
    return { total, folders };
  }, [tree]);

  // ── 搜索 ──
  const searchResults = useMemo(() => {
    if (!isSearching) return { nodes: [] as BookmarkNode[], flat: [] as ReturnType<typeof buildFlatList> };
    const nodes = searchTree(tree, deferredQuery.trim());
    return { nodes, flat: buildFlatList(nodes) };
  }, [deferredQuery, tree, isSearching]);

  // ── 全部 URL 节点 ──
  const urlNodes = useMemo(() => collectUrlBookmarks(tree), [tree]);

  // ── CRUD ──
  const reloadAfterChange = useCallback(async (): Promise<void> => {
    invalidate();
    await refresh();
  }, [invalidate, refresh]);

  const handleCreate = useCallback(
    async (title: string, url: string, parentId?: string): Promise<void> => {
      // 重复 URL 检测
      const normalized = url.trim().toLowerCase();
      const dup = urlNodes.find(
        (n) => n.url !== undefined && n.url.toLowerCase() === normalized,
      );
      if (dup !== undefined) {
        message.warning(t("该书签已存在 : {title}", { title: dup.title }));
        return;
      }
      await createBookmark({ title, url, parentId });
      await reloadAfterChange();
      feedback.success(t("创建成功"));
      setEditModal(EMPTY_EDIT);
    },
    [urlNodes, reloadAfterChange, t],
  );

  const handleEdit = useCallback(
    async (id: string, title: string, url: string): Promise<void> => {
      await updateBookmark(id, { title, url });
      await reloadAfterChange();
      feedback.success(t("编辑成功"));
      setEditModal(EMPTY_EDIT);
    },
    [reloadAfterChange, t],
  );

  const handleDelete = useCallback(
    async (id: string, title: string): Promise<void> => {
      const ok = await removeBookmark(id);
      if (ok) {
        feedback.success(t("已删除「{title}」", { title }));
        await reloadAfterChange();
      }
    },
    [reloadAfterChange, t],
  );

  const handleCreateFolder = useCallback(
    async (name: string): Promise<void> => {
      await createBookmark({ title: name });
      await reloadAfterChange();
      feedback.success(t("文件夹已创建"));
      setNewFolderOpen(false);
    },
    [reloadAfterChange, t],
  );

  const handleBatchDelete = useCallback(async (): Promise<void> => {
    const ids = Array.from(selectedIds);
    let count = 0;
    for (const id of ids) {
      const ok = await removeBookmark(id);
      if (ok) count++;
    }
    feedback.success(t("已批量删除 {n} 项", { n: count }));
    setSelectedIds(new Set());
    setSelectionMode(false);
    await reloadAfterChange();
  }, [selectedIds, reloadAfterChange, t]);

  // ── 拖拽 ──
  const handleDragStart = useCallback((e: React.DragEvent, node: BookmarkNode) => {
    e.dataTransfer.setData("text/plain", node.id);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  // dragOverId 在拖拽时会被频繁触发（mousemove 频率），
  // 用 ref 比较新旧值，**仅在变化时** setState，避免整树重渲染。
  const dragOverIdRef = useRef<string | null>(null);
  const handleDragOver = useCallback((e: React.DragEvent, node: BookmarkNode) => {
    if (!isFolder(node)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIdRef.current !== node.id) {
      dragOverIdRef.current = node.id;
      setDragOverId(node.id);
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    if (dragOverIdRef.current !== null) {
      dragOverIdRef.current = null;
      setDragOverId(null);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetFolder: BookmarkNode): Promise<void> => {
      e.preventDefault();
      setDragOverId(null);
      if (!isFolder(targetFolder)) return;
      const draggedId = e.dataTransfer.getData("text/plain");
      if (draggedId.length === 0) return;
      if (draggedId === targetFolder.id) return;
      await moveBookmark(draggedId, targetFolder.id);
      await reloadAfterChange();
      feedback.success(t("已移动"));
    },
    [reloadAfterChange, t],
  );

  // ── 多选 ──
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const all: string[] = [];
    const walk = (nodes: BookmarkNode[]): void => {
      for (const n of nodes) {
        all.push(n.id);
        if (n.children) walk(n.children);
      }
    };
    walk(tree);
    setSelectedIds(new Set(all));
  }, [tree]);

  // ── 导出 ──
  const handleExport = useCallback(
    (format: "html" | "json" | "md") => {
      let content = "";
      let filename = "";
      let mime = "";
      switch (format) {
        case "html":
          content = `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n${toNetscapeHtml(tree)}</DL><p>\n`;
          filename = "bookmarks.html";
          mime = "text/html";
          break;
        case "json":
          content = JSON.stringify(tree, null, 2);
          filename = "bookmarks.json";
          mime = "application/json";
          break;
        case "md":
          content = toMarkdown(tree);
          filename = "bookmarks.md";
          mime = "text/markdown";
          break;
      }
      downloadFile(filename, mime, content);
      feedback.success(t("导出成功"));
    },
    [tree, t],
  );

  // ── 导入 ──
  const handleImport: UploadProps["beforeUpload"] = useCallback(
    (file) => {
      setImportLoading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text !== "string") {
          setImportLoading(false);
          feedback.warning(t("未识别到书签"));
          return;
        }
        const imported = parseImport(text);
        if (imported.length === 0) {
          setImportLoading(false);
          feedback.warning(t("未识别到书签"));
          return;
        }
        Modal.confirm({
          title: t("导入书签"),
          content: t("识别到 {n} 个书签，确认导入？", { n: imported.length }),
          okText: t("导入"),
          cancelText: t("取消"),
          onOk: async () => {
            let count = 0;
            for (const item of imported) {
              const created = await createBookmark(item);
              if (created !== null) count++;
            }
            await reloadAfterChange();
            feedback.success(t("已导入 {n} 个书签", { n: count }));
            setImportLoading(false);
          },
          onCancel: () => setImportLoading(false),
        });
      };
      reader.onerror = () => {
        setImportLoading(false);
        feedback.error(t("文件读取失败"));
      };
      reader.readAsText(file);
      return false;
    },
    [reloadAfterChange, t],
  );

  // ── 工具操作 ──
  const runLinkCheck = useCallback(() => {
    if (urlNodes.length === 0) {
      feedback.info(t("没有可检测的网址书签"));
      return;
    }
    // 先打开 modal，再启动检测 —— 用户能立即看到流式预览
    setShowBrokenModal(true);
    void linkChecker.run(
      urlNodes.map((n) => ({ id: n.id, title: n.title, url: n.url ?? "" })),
    );
  }, [linkChecker, urlNodes, t]);

  const findDuplicatesImpl = useCallback(() => {
    dupFinder.compute(tree);
    setShowDupModal(true);
  }, [dupFinder, tree]);

  // ── 右键菜单 ──
  const nodeContextMenu = useCallback(
    (node: BookmarkNode): MenuProps => ({
      items: [
        ...(node.url !== undefined
          ? [
              {
                key: "open",
                label: t("打开"),
                icon: <ExternalLink size={ICON_SIZE.SMALL} />,
                onClick: () =>
                  window.open(node.url, "_blank", "noopener,noreferrer"),
              },
            ]
          : []),
        { type: "divider" as const },
        {
          key: "edit",
          label: t("编辑"),
          icon: <Edit2 size={ICON_SIZE.SMALL} />,
          onClick: () => setEditModal({ open: true, node, isNew: false }),
        },
        ...(isFolder(node)
          ? [
              {
                key: "add",
                label: t("在此添加书签"),
                icon: <BookmarkPlus size={ICON_SIZE.SMALL} />,
                onClick: () => setEditModal({ open: true, isNew: true, parentId: node.id }),
              },
            ]
          : [
              {
                key: "add",
                label: t("在父文件夹添加书签"),
                icon: <BookmarkPlus size={ICON_SIZE.SMALL} />,
                onClick: () =>
                  setEditModal({ open: true, isNew: true, parentId: node.parentId }),
              },
            ]),
        { type: "divider" as const },
        {
          key: "delete",
          label: t("删除"),
          icon: <Trash2 size={ICON_SIZE.SMALL} />,
          danger: true,
          onClick: () => void handleDelete(node.id, node.title),
        },
      ],
    }),
    [t, handleDelete],
  );

  // ── 渲染分支 ──

  if (loading && tree.length === 0) {
    return (
      <Flex justify="center" align="center" className={styles["bookmark-loading"]}>
        <Spin />
      </Flex>
    );
  }

  if (permissionDenied) {
    return (
      <Flex vertical align="center" className={styles["bookmark-loading"]}>
        <FeatureEmptyState
          title={t("需要书签权限")}
          description={t("书签管理功能需要浏览器书签权限")}
          actions={[
            { text: t("授予权限"), onClick: () => void requestPermission(), type: "primary" },
          ]}
        />
      </Flex>
    );
  }

  return (
    <div className={styles["bookmark-view"]}>
      <BookmarkToolbar
        query={query}
        onQueryChange={setQuery}
        viewTab={viewTab}
        onViewTabChange={setViewTab}
        sortMode={sortMode}
        onSortChange={setSortMode}
        onAddBookmark={() => setEditModal({ open: true, isNew: true })}
        onAddFolder={() => setNewFolderOpen(true)}
        onExport={handleExport}
        onImport={handleImport}
        selectionMode={selectionMode}
        onToggleSelection={() => {
          setSelectionMode((v) => !v);
          setSelectedIds(new Set());
        }}
        showSelection={viewTab === "tree" && !isSearching}
        onCheckLinks={runLinkCheck}
        onFindDuplicates={findDuplicatesImpl}
        linkCheckRunning={linkChecker.running}
        importLoading={importLoading}
      />

      {selectionMode && selectedIds.size > 0 && (
        <BookmarkSelectionBar
          count={selectedIds.size}
          onSelectAll={handleSelectAll}
          onClear={() => setSelectedIds(new Set())}
          onBatchDelete={() => void handleBatchDelete()}
        />
      )}

      <BookmarkStatsBar
        total={stats.total}
        folders={stats.folders}
        linkCheckRunning={linkChecker.running}
        linkCheckChecked={linkChecker.checked}
        linkCheckTotal={linkChecker.total}
        brokenCount={linkChecker.broken.length}
        onShowBroken={() => setShowBrokenModal(true)}
      />

      {viewTab === "tree" && !isSearching && sortedTree.length > 0 && (
        <SmartTagList nodes={sortedTree} onSelectTag={setQuery} />
      )}

      {viewTab === "recent" && !isSearching && <BookmarkRecentList />}

      {isSearching && (
        <BookmarkSearchResults flat={searchResults.flat} emptyHint={t("未找到匹配的书签")} />
      )}

      {viewTab === "tree" &&
        !isSearching &&
        (sortedTree.length === 0 ? (
          <FeatureEmptyState
            title={t("暂无书签")}
            description={t("点击上方按钮添加书签，或导入书签文件")}
            hints={[
              t("支持拖拽移动书签"),
              t("文件夹可嵌套管理"),
              t("支持 HTML / JSON / Markdown 导入导出"),
            ]}
            actions={[
              {
                text: t("添加书签"),
                onClick: () => setEditModal({ open: true, isNew: true }),
                type: "primary",
              },
              { text: t("新建文件夹"), onClick: () => setNewFolderOpen(true) },
            ]}
          />
        ) : (
          <BookmarkTreeView
            nodes={sortedTree}
            collapsedDirs={collapsedDirs}
            toggleCollapse={toggleCollapsed}
            dragOverId={dragOverId}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            toggleSelect={handleToggleSelect}
            onContextMenu={nodeContextMenu}
            onDelete={(id, title) => void handleDelete(id, title)}
            onAddChild={(parentId) =>
              setEditModal({ open: true, isNew: true, parentId })
            }
            onEdit={(node) => setEditModal({ open: true, node, isNew: false })}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e, node) => void handleDrop(e, node)}
          />
        ))}

      <BookmarkEditModal
        open={editModal.open}
        isNew={editModal.isNew}
        initialTitle={editModal.node?.title}
        initialUrl={editModal.node?.url}
        onClose={() => setEditModal(EMPTY_EDIT)}
        onSave={async (title, url) => {
          if (editModal.isNew) {
            await handleCreate(title, url, editModal.parentId);
          } else if (editModal.node !== undefined) {
            await handleEdit(editModal.node.id, title, url);
          }
        }}
      />

      <NewFolderModal
        open={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        onSave={(name) => handleCreateFolder(name)}
      />

      <BrokenLinksModal
        open={showBrokenModal}
        partialResults={linkChecker.partialResults}
        broken={linkChecker.broken}
        total={linkChecker.total}
        checked={linkChecker.checked}
        running={linkChecker.running}
        totalDurationMs={linkChecker.totalDurationMs}
        onClose={() => {
          // 关闭时若正在检测，给个温和提示
          if (linkChecker.running) {
            linkChecker.cancel();
          }
          setShowBrokenModal(false);
        }}
        onCancel={() => linkChecker.cancel()}
        onDeleteOne={async (id) => {
          await handleDelete(id, "");
        }}
        onDeleteAll={async () => {
          for (const item of linkChecker.broken) {
            await handleDelete(item.bookmarkId, item.title);
          }
          linkChecker.reset();
          setShowBrokenModal(false);
        }}
      />

      <DuplicatesModal
        open={showDupModal}
        groups={dupFinder.duplicates}
        onClose={() => setShowDupModal(false)}
        onRemoveGroup={async (group) => {
          const count = await dupFinder.removeGroup(group);
          if (count > 0) await reloadAfterChange();
          return count;
        }}
        onRemoveAll={async () => {
          const count = await dupFinder.removeAll();
          if (count > 0) await reloadAfterChange();
          return count;
        }}
      />
    </div>
  );
}
