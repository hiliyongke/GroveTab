/**
 * BookmarkView — 书签视图（v3 视觉打磨）
 *
 * 设计要点：
 *   - 扁平化层级：顶层文件夹（书签栏 / 其他书签 / 移动设备）作为「分区标题」展开，不嵌套卡片
 *   - 子文件夹作为「次级分组」带缩进展示，避免「卡中卡」视觉嵌套
 *   - 书签行项：左侧身份色条 + favicon + 标题/hostname + 末端外链图标
 *   - Chrome 默认文件夹做 i18n 映射，不再出现「未命名文件夹」
 *   - 搜索结果走独立通道
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { Input, Button, Tag, Spin, Tooltip, Segmented, Flex, Space } from "antd";
import {
  BookOpen,
  Search,
  Plus,
  Wrench,
  ChevronDown,
  Folder,
  ExternalLink,
  Bookmark as BookmarkIcon,
  List as ListIcon,
  Network,
  GitBranch,
} from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import {
  getBookmarkTree,
  searchBookmarks,
  createBookmark,
  requestBookmarksPermission,
  hasBookmarksPermission,
  type BookmarkNode,
} from "@/chrome/bookmarks";
import { createTab, getFaviconUrl } from "@/chrome";
import { useTabsStore } from "@/store";
import { useT } from "@/shared/i18n";
import { feedback } from "@/shared/ui/feedback";
import { translate } from "@/shared/i18n/core";
import { BookmarkToolsModal } from "@/features/bookmarks/BookmarkToolsModal";
import { isSafeExternalUrl } from "@/shared/utils/url-safety";
import { useAccent } from "@/shared/hooks/use-accent";
import { FeatureEmptyState } from "@/shared/ui/FeatureEmptyState";
import { BookmarkTreeView } from "./BookmarkTreeView";
import styles from "./BookmarkView.module.less";

/**
 * 合并 CSS 类名
 *
 * 过滤掉 falsy 值（false、undefined、空字符串），用空格连接。
 *
 * @param classNames - CSS 类名列表
 * @returns 合并后的类名字符串
 */
function cx(...classNames: Array<string | false | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

/** 视图模式：列表 / 脈图（横向）/ 架构图（垂直） */
type BookmarkLayout = "list" | "mindmap" | "orgchart";

/**
 * 从 URL 提取 hostname 做展示和取色键
 *
 * @param url - 待提取的 URL
 * @returns hostname 或原始 URL（解析失败时）
 */
function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * 从标题/URL 提取首字母作为 favicon 回退
 *
 * @param title - 书签标题
 * @param url - 书签 URL
 * @returns 首字母大写
 */
function getFallbackLetter(title: string, url: string): string {
  if (title) return title.charAt(0).toUpperCase();
  try {
    return new URL(url).hostname.charAt(0).toUpperCase();
  } catch {
    return "?";
  }
}

/**
 * Chrome 默认根级文件夹的 ID 与友好名映射
 * 0: 根  1: 书签栏  2: 其他书签  3: 移动设备书签
 *
 * @param node - 书签节点
 * @param t - 国际化翻译函数
 * @returns 解析后的文件夹标题
 */
function resolveFolderTitle(node: BookmarkNode, t: (key: string) => string): string {
  if (node.title?.trim()) return node.title;
  switch (node.id) {
    case "1":
      return t("bookmark.folder.bar");
    case "2":
      return t("bookmark.folder.others");
    case "3":
      return t("bookmark.folder.mobile");
    default:
      return t("bookmark.folder.unnamed");
  }
}

/**
 * 递归统计书签总数
 *
 * 遍历书签树，统计所有包含 URL 的叶节点数量。
 *
 * @param nodes - 书签节点数组
 * @returns 书签总数
 */
function countBookmarks(nodes: BookmarkNode[] | undefined): number {
  if (!nodes) return 0;
  return nodes.reduce((sum, n) => {
    if (n.url) return sum + 1;
    return sum + countBookmarks(n.children);
  }, 0);
}

// ── 子组件 ──

/**
 * 单个书签行项组件
 *
 * 渲染书签的单个行项目，包含 favicon、标题和访问链接。
 *
 * @param props - 组件属性
 * @param props.node - 书签节点
 * @param props.onOpen - 打开书签回调
 * @param props.highlight - 高亮文本的函数（可选）
 * @returns 书签行项 JSX 元素
 */
function BookmarkRow({
  node,
  onOpen,
  highlight,
}: {
  node: BookmarkNode;
  onOpen: (url: string) => void;
  highlight?: (text: string) => React.ReactNode;
}) {
  const url = node.url ?? "";
  const hostname = getHostname(url);
  const faviconUrl = getFaviconUrl(url);
  const accent = useAccent(faviconUrl || undefined, hostname);
  const [faviconError, setFaviconError] = useState(false);

  const handleClick = useCallback(() => {
    if (url) onOpen(url);
  }, [url, onOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && url) onOpen(url);
    },
    [url, onOpen],
  );

  const titleText = node.title || hostname;

  // Memoize style objects to avoid recreating on each render
  const rowStyle = useMemo<React.CSSProperties>(
    () => ({ "--app-bm-accent": accent.bar }) as React.CSSProperties,
    [accent.bar],
  );
  const fallbackStyle = useMemo<React.CSSProperties>(
    () => ({ background: accent.soft, color: accent.text }),
    [accent.soft, accent.text],
  );

  return (
    <Flex
      className={styles["app-bookmark-row"]}
      style={rowStyle}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      title={`${titleText}\n${url}`}
      align="center"
      gap={8}
    >
      <span className={styles["app-bookmark-row__bar"]} />
      {faviconUrl && !faviconError ? (
        <img
          src={faviconUrl}
          alt=""
          className={styles["app-bookmark-row__favicon"]}
          onError={() => setFaviconError(true)}
        />
      ) : (
        <span className={styles["app-bookmark-row__favicon-fallback"]} style={fallbackStyle}>
          {getFallbackLetter(node.title ?? "", url)}
        </span>
      )}
      <div className={styles["app-bookmark-row__main"]}>
        <div className={styles["app-bookmark-row__title"]}>
          {highlight ? highlight(titleText) : titleText}
        </div>
        <div className={styles["app-bookmark-row__hostname"]}>
          {highlight ? highlight(hostname) : hostname}
        </div>
      </div>
      <ExternalLink size={ICON_SIZE.SMALL} className={styles["app-bookmark-row__action"]} />
    </Flex>
  );
}

/**
 * 子文件夹分组（次级标题样式，无卡片包裹，用左侧缩进 + 折叠头表达层级）
 * @param root0
 * @param root0.folder - 文件夹节点
 * @param root0.onOpenBookmark - 打开书签回调
 * @param root0.depth - 嵌套深度
 * @param root0.resolveTitle - 标题解析函数
 * @returns {JSX.Element} 分组元素
 */
function SubFolderGroup({
  folder,
  onOpenBookmark,
  depth,
  resolveTitle,
}: {
  folder: BookmarkNode;
  onOpenBookmark: (url: string) => void;
  depth: number;
  resolveTitle: (n: BookmarkNode) => string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const children = useMemo(() => folder.children ?? [], [folder.children]);
  const bookmarks = useMemo(() => children.filter((c) => !!c.url), [children]);
  const subFolders = useMemo(() => children.filter((c) => !c.url), [children]);
  const total = useMemo(() => countBookmarks(children), [children]);

  if (bookmarks.length === 0 && subFolders.length === 0) return null;
  const title = resolveTitle(folder);

  return (
    <div
      className={styles["app-bookmark-subgroup"]}
      style={{ "--app-bm-depth": depth } as React.CSSProperties}
    >
      <Flex
        className={styles["app-bookmark-subgroup__head"]}
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setCollapsed((c) => !c);
          }
        }}
        align="center"
        gap={6}
      >
        <ChevronDown
          size={ICON_SIZE.SMALL}
          className={cx(
            styles["app-bookmark-subgroup__chevron"],
            collapsed && styles["is-collapsed"],
          )}
        />
        <Folder size={ICON_SIZE.SMALL} className={styles["app-bookmark-subgroup__icon"]} />
        <span className={styles["app-bookmark-subgroup__title"]}>{title}</span>
        <span className={styles["app-bookmark-subgroup__count"]}>{total}</span>
      </Flex>
      {!collapsed && (
        <div className={styles["app-bookmark-subgroup__body"]}>
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
        </div>
      )}
    </div>
  );
}

/**
 * 顶层文件夹分区（书签栏 / 其他书签 / 移动设备）
 * 设计上不再做卡片包裹，而是用「分区头 + 内容列表」的扁平结构
 * @param root0
 * @param root0.folder
 * @param root0.onOpenBookmark
 * @param root0.defaultOpen
 * @param root0.resolveTitle
 * @returns {JSX.Element} 顶层文件夹分区 JSX 元素
 */
function TopFolderSection({
  folder,
  onOpenBookmark,
  defaultOpen,
  resolveTitle,
}: {
  folder: BookmarkNode;
  onOpenBookmark: (url: string) => void;
  defaultOpen: boolean;
  resolveTitle: (n: BookmarkNode) => string;
}) {
  const [collapsed, setCollapsed] = useState(!defaultOpen);
  const children = useMemo(() => folder.children ?? [], [folder.children]);
  const bookmarks = useMemo(() => children.filter((c) => !!c.url), [children]);
  const subFolders = useMemo(() => children.filter((c) => !c.url), [children]);
  const total = useMemo(() => countBookmarks(children), [children]);

  if (bookmarks.length === 0 && subFolders.length === 0) return null;
  const title = resolveTitle(folder);

  return (
    <section className={styles["app-bookmark-section"]}>
      <Flex
        className={styles["app-bookmark-section__head"]}
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setCollapsed((c) => !c);
          }
        }}
        align="center"
        gap={8}
      >
        <ChevronDown
          size={ICON_SIZE.MEDIUM}
          className={cx(
            styles["app-bookmark-section__chevron"],
            collapsed && styles["is-collapsed"],
          )}
        />
        <span className={styles["app-bookmark-section__badge"]}>
          <BookmarkIcon size={14} />
        </span>
        <h3 className={styles["app-bookmark-section__title"]}>{title}</h3>
        <Tag className={styles["app-bookmark-section__count"]} bordered={false}>
          {total}
        </Tag>
      </Flex>
      {!collapsed && (
        <div className={styles["app-bookmark-section__body"]}>
          {bookmarks.length > 0 && (
            <div className={styles["app-bookmark-section__rows"]}>
              {bookmarks.map((bm) => (
                <BookmarkRow key={bm.id} node={bm} onOpen={onOpenBookmark} />
              ))}
            </div>
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
        </div>
      )}
    </section>
  );
}

// ── 主组件 ──

/**
 * 书签视图主组件
 *
 * 展示用户书签，支持搜索、权限请求和多种布局展示。
 *
 * @returns {JSX.Element} 书签视图 JSX 元素
 */
export function BookmarkView() {
  const [hasPermission, setHasPermission] = useState(false);
  const [checking, setChecking] = useState(true);
  const [bookmarks, setBookmarks] = useState<BookmarkNode[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<BookmarkNode[]>([]);
  const [searching, setSearching] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [layout, setLayout] = useState<BookmarkLayout>("list");
  const tabs = useTabsStore((s) => s.tabs);
  const { t } = useT();

  /** 解析文件夹标题（支持 Chrome 默认文件夹） */
  const resolveTitle = useCallback((n: BookmarkNode) => resolveFolderTitle(n, t), [t]);

  /** 检查权限 */
  useEffect(() => {
    void hasBookmarksPermission().then((has) => {
      setHasPermission(has);
      setChecking(false);
      if (has) {
        void getBookmarkTree().then(setBookmarks);
      }
    });
  }, []);

  /**
   * 请求书签读取权限
   *
   * 请求浏览器书签权限，成功后加载书签树。
   *
   * @returns 无返回值
   */
  const handleRequestPermission = useCallback(async () => {
    const granted = await requestBookmarksPermission();
    if (granted) {
      setHasPermission(true);
      const tree = await getBookmarkTree();
      setBookmarks(tree);
    } else {
      feedback.error(translate("bookmark.permissionDenied"));
    }
  }, []);

  /**
   * 执行书签搜索
   *
   * 根据用户输入的查询关键词搜索书签，并更新搜索结果状态。
   *
   * @param query - 搜索查询字符串
   * @returns 无返回值
   */
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const results = await searchBookmarks(query);
    setSearchResults(results);
    setSearching(false);
  }, []);

  /**
   * 打开书签链接
   *
   * 检查 URL 安全性后在新标签页中打开书签。
   *
   * @param url - 要打开的书签 URL
   * @returns 无返回值
   */
  const handleOpenBookmark = useCallback(async (url: string) => {
    if (!isSafeExternalUrl(url)) {
      feedback.error(translate("bookmark.openFailed"));
      return;
    }
    try {
      await createTab({ url });
    } catch (err) {
      feedback.error(translate("bookmark.openFailed"), err);
    }
  }, []);

  /**
   * 同步打开书签（无 async）
   *
   * 封装 handleOpenBookmark 为同步调用，用于事件处理器。
   *
   * @param url - 要打开的书签 URL
   * @returns 无返回值
   */
  const openBookmarkSync = useCallback(
    (url: string) => {
      void handleOpenBookmark(url);
    },
    [handleOpenBookmark],
  );

  /**
   * 将所有非 Chrome 内部标签页添加为书签
   *
   * 遍历当前所有标签页，跳过 chrome:// 和 chrome-extension:// 协议的页面，
   * 将其余页面添加到书签中，并在完成后刷新书签树。
   *
   * @returns 无返回值
   */
  const handleBookmarkAll = useCallback(async () => {
    let count = 0;
    for (const tab of tabs) {
      if (!tab.url.startsWith("chrome://") && !tab.url.startsWith("chrome-extension://")) {
        const result = await createBookmark({ title: tab.title, url: tab.url });
        if (result !== null) count++;
      }
    }
    feedback.success(translate("bookmark.bookmarkedAll", { count }));
    const tree = await getBookmarkTree();
    setBookmarks(tree);
  }, [tabs]);

  /**
   * 顶层分区。Chrome bookmark tree 的根（id=0）只有一个，其 children 才是
   * 「书签栏(1)/其他书签(2)/移动设备书签(3)」。我们把所有第一/二层文件夹拍平作为分区。
   */
  const topSections = useMemo(() => {
    const result: BookmarkNode[] = [];
    const visit = (nodes: BookmarkNode[]) => {
      for (const n of nodes) {
        if (n.url) continue;
        if (n.id === "0") {
          if (n.children) visit(n.children);
          continue;
        }
        result.push(n);
      }
    };
    visit(bookmarks);
    return result.filter((s) => countBookmarks(s.children) > 0);
  }, [bookmarks]);

  /**
   * 创建搜索关键词高亮函数
   *
   * 返回一个函数，该函数根据搜索关键词对文本进行高亮处理。
   *
   * @param query - 搜索关键词
   * @returns 返回接受文本参数并返回高亮 JSX 的函数
   */
  const buildHighlight = useCallback((query: string) => {
    return (text: string): React.ReactNode => {
      const q = query.trim();
      if (!q || !text) return text;
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const parts = text.split(new RegExp(`(${escaped})`, "ig"));
      return parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          // eslint-disable-next-line react/no-array-index-key
          <mark key={i} className={styles["app-bookmark-highlight"]}>
            {part}
          </mark>
        ) : (
          // eslint-disable-next-line react/no-array-index-key
          <span key={i}>{part}</span>
        ),
      );
    };
  }, []);

  /** 总书签数（必须在 early return 之前调用，遵守 hooks 规则） */
  const totalBookmarks = useMemo(
    () => topSections.reduce((sum, s) => sum + countBookmarks(s.children), 0),
    [topSections],
  );

  if (checking) {
    return (
      <div className={styles["app-bookmark-loading-wrap"]}>
        <Spin />
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className={styles["app-bookmark-empty"]}>
        <FeatureEmptyState
          title={t("bookmark.needPermission")}
          icon={<BookOpen size={24} className={styles["app-bookmark-empty-icon"]} />}
          actions={[
            {
              text: t("bookmark.grantPermission"),
              onClick: () => {
                void handleRequestPermission();
              },
            },
          ]}
          hints={[t("bookmark.hint1"), t("bookmark.hint2")]}
        />
      </div>
    );
  }

  return (
    <div className={`app-bookmark-shell ${styles["app-bookmark-shell"]}`}>
      {/* 顶部头：标题 + 统计 + 工具按钮 */}
      <Flex className={styles["app-bookmark-header"]} justify="space-between" align="center">
        <Flex className={styles["app-bookmark-header__title"]} align="center" gap={8}>
          <BookOpen size={ICON_SIZE.MEDIUM} className={styles["app-bookmark-header__icon"]} />
          <span>{t("bookmark.title")}</span>
          {totalBookmarks > 0 && (
            <Tag bordered={false} className={styles["app-bookmark-header__count"]}>
              {totalBookmarks}
            </Tag>
          )}
        </Flex>
        <Space className={styles["app-bookmark-header__actions"]} size="small">
          <Segmented
            size="small"
            value={layout}
            onChange={(v) => setLayout(v as BookmarkLayout)}
            options={[
              {
                value: "list",
                icon: (
                  <Tooltip title={t("bookmark.layout.list")}>
                    <ListIcon size={ICON_SIZE.SMALL} />
                  </Tooltip>
                ),
              },
              {
                value: "mindmap",
                icon: (
                  <Tooltip title={t("bookmark.layout.mindmap")}>
                    <Network size={ICON_SIZE.SMALL} />
                  </Tooltip>
                ),
              },
              {
                value: "orgchart",
                icon: (
                  <Tooltip title={t("bookmark.layout.orgchart")}>
                    <GitBranch size={ICON_SIZE.SMALL} />
                  </Tooltip>
                ),
              },
            ]}
          />
          <Tooltip title={t("bookmark.bookmarkAll")}>
            <Button
              size="small"
              icon={<Plus size={ICON_SIZE.SMALL} />}
              onClick={() => {
                void handleBookmarkAll();
              }}
            >
              {t("bookmark.bookmarkAll")}
            </Button>
          </Tooltip>
          <Tooltip title={t("bookmark.tools.entry")}>
            <Button
              size="small"
              icon={<Wrench size={ICON_SIZE.SMALL} />}
              onClick={() => setToolsOpen(true)}
            >
              {t("bookmark.tools.entry")}
            </Button>
          </Tooltip>
        </Space>
      </Flex>

      {/* 搜索栏 */}
      <div className={styles["app-bookmark-search-wrap"]}>
        <Input
          prefix={<Search size={ICON_SIZE.MEDIUM} className={styles["app-bookmark-search-icon"]} />}
          placeholder={t("bookmark.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => {
            void handleSearch(e.target.value);
          }}
          allowClear
          size="large"
          className={styles["app-bookmark-search"]}
        />
      </div>

      {/* 结果区 */}
      <div className={`app-bookmark-result ${styles["app-bookmark-result"]}`}>
        {searchQuery ? (
          searching ? (
            <div className={styles["app-bookmark-loading-wrap"]}>
              <Spin />
            </div>
          ) : searchResults.length === 0 ? (
            <div className={styles["app-bookmark-result-empty"]}>
              <FeatureEmptyState
                title={t("bookmark.noResults")}
                size="small"
                icon={<Search size={20} />}
                hints={[t("bookmark.searchHint1"), t("bookmark.searchHint2")]}
              />
            </div>
          ) : (
            <div className={styles["app-bookmark-search-results"]}>
              <div className={styles["app-bookmark-search-meta"]}>
                {t("bookmark.searchCount", { count: searchResults.length })}
              </div>
              <div className={styles["app-bookmark-search-list"]}>
                {searchResults.map((item) => (
                  <BookmarkRow
                    key={item.id}
                    node={item}
                    onOpen={openBookmarkSync}
                    highlight={buildHighlight(searchQuery)}
                  />
                ))}
              </div>
            </div>
          )
        ) : topSections.length === 0 ? (
          <div className={styles["app-bookmark-result-empty"]}>
            <FeatureEmptyState
              title={t("bookmark.emptyTitle")}
              icon={<BookOpen size={20} />}
              size="small"
              hints={[t("bookmark.hint1"), t("bookmark.hint2")]}
            />
          </div>
        ) : layout === "mindmap" ? (
          <BookmarkTreeView
            topSections={topSections}
            onOpenBookmark={openBookmarkSync}
            resolveTitle={resolveTitle}
            orientation="horizontal"
          />
        ) : layout === "orgchart" ? (
          <BookmarkTreeView
            topSections={topSections}
            onOpenBookmark={openBookmarkSync}
            resolveTitle={resolveTitle}
            orientation="vertical"
          />
        ) : (
          <div className={styles["app-bookmark-sections"]}>
            {topSections.map((section, idx) => (
              <TopFolderSection
                key={section.id}
                folder={section}
                onOpenBookmark={openBookmarkSync}
                defaultOpen={idx === 0 || topSections.length <= 2}
                resolveTitle={resolveTitle}
              />
            ))}
          </div>
        )}
      </div>

      <BookmarkToolsModal
        open={toolsOpen}
        onClose={() => setToolsOpen(false)}
        onMutated={() => {
          void getBookmarkTree().then(setBookmarks);
        }}
      />
    </div>
  );
}
