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
import { Input, Button, Tag, Spin, Tooltip, Segmented, Typography, Space } from "antd";
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
import { BookmarkAutoRuleModal } from "@/features/bookmarks/BookmarkAutoRuleModal";
import { useBookmarkSync } from "@/features/bookmarks/hooks/use-bookmark-sync";
import { isSafeExternalUrl } from "@/shared/utils/url-safety";
import { useAccent } from "@/shared/hooks/use-accent";
import { FeatureEmptyState } from "@/shared/ui/FeatureEmptyState";
import { BookmarkTreeView } from "./BookmarkTreeView";
import styles from "@/features/tabs/styles/views.module.less";

function cx(...classNames: Array<string | false | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

/** 视图模式：列表 / 脉图（横向）/ 架构图（垂直） */
type BookmarkLayout = "list" | "mindmap" | "orgchart";

/** 从 URL 提取 hostname 做展示和取色键 */
function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** 从标题/URL 提取首字母作为 favicon 回退 */
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
 */
function resolveFolderTitle(node: BookmarkNode, t: (key: string) => string): string {
  if (node.title?.trim()) return node.title;
  switch (node.id) {
    case "1":
      return t("书签栏");
    case "2":
      return t("其他书签");
    case "3":
      return t("移动设备书签");
    default:
      return t("未命名文件夹");
  }
}

/** 递归统计书签总数 */
function countBookmarks(nodes: BookmarkNode[] | undefined): number {
  if (!nodes) return 0;
  return nodes.reduce((sum, n) => {
    if (n.url) return sum + 1;
    return sum + countBookmarks(n.children);
  }, 0);
}

// ── 子组件 ──

/** 单个书签行项 */
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

  return (
    <Space.Compact
      className={styles["app-bookmark-row"]}
      data-accent={accent.bar}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      title={`${titleText}\n${url}`}
    >
      <Typography.Text className={styles["app-bookmark-row__bar"]} />
      {faviconUrl && !faviconError ? (
        <img
          src={faviconUrl}
          alt=""
          width={18}
          height={18}
          className={styles["app-bookmark-row__favicon"]}
          onError={() => setFaviconError(true)}
        />
      ) : (
        <Typography.Text
          className={styles["app-bookmark-row__favicon-fallback"]}
          data-bg={accent.soft}
          data-color={accent.text}
        >
          {getFallbackLetter(node.title ?? "", url)}
        </Typography.Text>
      )}
      <Space direction="vertical" size={0} className={styles["app-bookmark-row__main"]}>
        <Typography.Text className={styles["app-bookmark-row__title"]}>
          {highlight ? highlight(titleText) : titleText}
        </Typography.Text>
        <Typography.Text className={styles["app-bookmark-row__hostname"]}>
          {highlight ? highlight(hostname) : hostname}
        </Typography.Text>
      </Space>
      <ExternalLink size={ICON_SIZE.SMALL} className={styles["app-bookmark-row__action"]} />
    </Space.Compact>
  );
}

/**
 * 子文件夹分组（次级标题样式，无卡片包裹，用左侧缩进 + 折叠头表达层级）
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

/**
 * 顶层文件夹分区（书签栏 / 其他书签 / 移动设备）
 * 设计上不再做卡片包裹，而是用「分区头 + 内容列表」的扁平结构
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

// ── 主组件 ──

export function BookmarkView() {
  const [hasPermission, setHasPermission] = useState(false);
  const [checking, setChecking] = useState(true);
  const [bookmarks, setBookmarks] = useState<BookmarkNode[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<BookmarkNode[]>([]);
  const [searching, setSearching] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [autoRuleOpen, setAutoRuleOpen] = useState(false);
  const [layout, setLayout] = useState<BookmarkLayout>("list");
  const tabs = useTabsStore((s) => s.tabs);
  const { t } = useT();

  /** 解析文件夹标题（支持 Chrome 默认文件夹） */
  const resolveTitle = useCallback((n: BookmarkNode) => resolveFolderTitle(n, t), [t]);

  /** 刷新书签树 */
  const refreshBookmarks = useCallback(async () => {
    const tree = await getBookmarkTree();
    setBookmarks(tree);
  }, []);

  /** 检查权限 */
  useEffect(() => {
    void hasBookmarksPermission().then((has) => {
      setHasPermission(has);
      setChecking(false);
      if (has) {
        void refreshBookmarks();
      }
    });
  }, [refreshBookmarks]);

  /** 实时同步：监听 SW 广播的书签变更事件（需求 5.1） */
  useBookmarkSync(() => {
    void refreshBookmarks();
  }, hasPermission);

  const handleRequestPermission = useCallback(async () => {
    const granted = await requestBookmarksPermission();
    if (granted) {
      setHasPermission(true);
      await refreshBookmarks();
    } else {
      feedback.error(translate("书签权限被拒绝"));
    }
  }, []);

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

  const handleOpenBookmark = useCallback(async (url: string) => {
    if (!isSafeExternalUrl(url)) {
      feedback.error(translate("打开书签失败，请重试"));
      return;
    }
    try {
      await createTab({ url });
    } catch (err) {
      feedback.error(translate("打开书签失败，请重试"), err);
    }
  }, []);

  const openBookmarkSync = useCallback(
    (url: string) => {
      void handleOpenBookmark(url);
    },
    [handleOpenBookmark],
  );

  const handleBookmarkAll = useCallback(async () => {
    let count = 0;
    for (const tab of tabs) {
      if (!tab.url.startsWith("chrome://") && !tab.url.startsWith("chrome-extension://")) {
        const result = await createBookmark({ title: tab.title, url: tab.url });
        if (result !== null) count++;
      }
    }
    feedback.success(translate("已收藏 {count} 个标签页", { count }));
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

  /** 高亮搜索关键词 */
  const buildHighlight = useCallback((query: string) => {
    return (text: string): React.ReactNode => {
      const q = query.trim();
      if (!q || !text) return text;
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const parts = text.split(new RegExp(`(${escaped})`, "ig"));
      return parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <Typography.Text key={`${part}-${i}`} className={styles["app-bookmark-highlight"]}>
            {part}
          </Typography.Text>
        ) : (
          <Typography.Text key={`${part}-${i}`}>{part}</Typography.Text>
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
      <Space className={styles["app-bookmark-loading-wrap"]} align="center">
        <Spin />
      </Space>
    );
  }

  if (!hasPermission) {
    return (
      <Space className={styles["app-bookmark-empty"]} align="center">
        <FeatureEmptyState
          title={t("需要授权才能访问浏览器书签")}
          icon={<BookOpen size={24} className={styles["app-bookmark-empty-icon"]} />}
          actions={[
            {
              text: t("授权访问书签"),
              onClick: () => {
                void handleRequestPermission();
              },
            },
          ]}
          hints={[t("一键收藏当前所有标签页"), t("使用工具箱去重、检测失效链接")]}
        />
      </Space>
    );
  }

  return (
    <Space direction="vertical" size={0} className={styles["app-bookmark-shell"]}>
      {/* 顶部头：标题 + 统计 + 工具按钮 */}
      <Space className={styles["app-bookmark-header"]}>
        <Space className={styles["app-bookmark-header__title"]}>
          <BookOpen size={ICON_SIZE.MEDIUM} className={styles["app-bookmark-header__icon"]} />
          <Typography.Text>{t("我的书签")}</Typography.Text>
          {totalBookmarks > 0 && (
            <Tag className={styles["app-bookmark-header__count"]}>{totalBookmarks}</Tag>
          )}
        </Space>
        <Space className={styles["app-bookmark-header__actions"]}>
          <Segmented
            size="small"
            value={layout}
            onChange={(v) => setLayout(v as BookmarkLayout)}
            options={[
              {
                value: "list",
                icon: (
                  <Tooltip title={t("列表视图")}>
                    <ListIcon size={ICON_SIZE.SMALL} />
                  </Tooltip>
                ),
              },
              {
                value: "mindmap",
                icon: (
                  <Tooltip title={t("脑图（横向）")}>
                    <Network size={ICON_SIZE.SMALL} />
                  </Tooltip>
                ),
              },
              {
                value: "orgchart",
                icon: (
                  <Tooltip title={t("架构图（垂直）")}>
                    <GitBranch size={ICON_SIZE.SMALL} />
                  </Tooltip>
                ),
              },
            ]}
          />
          <Tooltip title={t("收藏全部标签")}>
            <Button
              size="small"
              icon={<Plus size={ICON_SIZE.SMALL} />}
              onClick={() => {
                void handleBookmarkAll();
              }}
            >
              {t("收藏全部标签")}
            </Button>
          </Tooltip>
          <Tooltip title={t("自动分类规则")}>
            <Button
              size="small"
              icon={<Wrench size={ICON_SIZE.SMALL} />}
              onClick={() => setAutoRuleOpen(true)}
            >
              {t("自动分类")}
            </Button>
          </Tooltip>
          <Tooltip title={t("工具箱")}>
            <Button
              size="small"
              icon={<Wrench size={ICON_SIZE.SMALL} />}
              onClick={() => setToolsOpen(true)}
            >
              {t("工具箱")}
            </Button>
          </Tooltip>
        </Space>
      </Space>

      {/* 搜索栏 */}
      <Space className={styles["app-bookmark-search-wrap"]}>
        <Input
          prefix={<Search size={ICON_SIZE.MEDIUM} className={styles["app-bookmark-search-icon"]} />}
          placeholder={t("搜索书签...")}
          value={searchQuery}
          onChange={(e) => {
            void handleSearch(e.target.value);
          }}
          allowClear
          size="large"
          className={styles["app-bookmark-search"]}
        />
      </Space>

      {/* 结果区 */}
      <Space direction="vertical" size={0} className={styles["app-bookmark-result"]}>
        {searchQuery ? (
          searching ? (
            <Space className={styles["app-bookmark-loading-wrap"]} align="center">
              <Spin />
            </Space>
          ) : searchResults.length === 0 ? (
            <Space className={styles["app-bookmark-result-empty"]} align="center">
              <FeatureEmptyState
                title={t("没有找到匹配的书签")}
                size="small"
                icon={<Search size={20} />}
                hints={[t("试试搜索网站名称或域名"), t("支持中英文关键词搜索")]}
              />
            </Space>
          ) : (
            <Space direction="vertical" size={0} className={styles["app-bookmark-search-results"]}>
              <Typography.Text className={styles["app-bookmark-search-meta"]}>
                {t("找到 {count} 个匹配书签", { count: searchResults.length })}
              </Typography.Text>
              <Space direction="vertical" size={0} className={styles["app-bookmark-search-list"]}>
                {searchResults.map((item) => (
                  <BookmarkRow
                    key={item.id}
                    node={item}
                    onOpen={openBookmarkSync}
                    highlight={buildHighlight(searchQuery)}
                  />
                ))}
              </Space>
            </Space>
          )
        ) : topSections.length === 0 ? (
          <Space className={styles["app-bookmark-result-empty"]} align="center">
            <FeatureEmptyState
              title={t("暂无书签")}
              icon={<BookOpen size={20} />}
              size="small"
              hints={[t("一键收藏当前所有标签页"), t("使用工具箱去重、检测失效链接")]}
            />
          </Space>
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
          <Space direction="vertical" size={0} className={styles["app-bookmark-sections"]}>
            {topSections.map((section, idx) => (
              <TopFolderSection
                key={section.id}
                folder={section}
                onOpenBookmark={openBookmarkSync}
                defaultOpen={idx === 0 || topSections.length <= 2}
                resolveTitle={resolveTitle}
              />
            ))}
          </Space>
        )}
      </Space>

      <BookmarkToolsModal
        open={toolsOpen}
        onClose={() => setToolsOpen(false)}
        onMutated={() => void refreshBookmarks()}
      />
      <BookmarkAutoRuleModal
        open={autoRuleOpen}
        onClose={() => setAutoRuleOpen(false)}
        onMutated={() => void refreshBookmarks()}
      />
    </Space>
  );
}
