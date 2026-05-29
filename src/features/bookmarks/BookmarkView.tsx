/**
 * BookmarkView — 书签视图（v3 视觉打磨）
 *
 * 设计要点：
 *   - 扁平化层级：顶层文件夹（书签栏 / 其他书签 / 移动设备）作为「分区标题」展开，不嵌套卡片
 *   - 子文件夹作为「次级分组」带缩进展示，避免「卡中卡」视觉嵌套
 *   - 书签行项：左侧身份色条 + favicon + 标题/hostname + 末端外链图标
 *   - Chrome 默认文件夹做 i18n 映射，不再出现「未命名文件夹」
 *   - 搜索结果走独立通道
 *
 * 重构说明：
 *   - 提取 BookmarkRow、SubFolderGroup、TopFolderSection 到 components/
 *   - 提取 useBookmarkData、useBookmarkSearch 到 hooks/
 *   - 复用 utils/tree-helpers.ts 中的工具函数
 */

import { useState, useCallback } from "react";
import { Input, Button, Tag, Spin, Tooltip, Segmented, Typography, Space } from "antd";
import {
  BookOpen,
  Search,
  Plus,
  Wrench,
  List as ListIcon,
  Network,
  GitBranch,
} from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { createTab } from "@/chrome";
import { useTabsStore } from "@/store";
import { useT } from "@/shared/i18n";
import { feedback } from "@/shared/ui/feedback";
import { translate } from "@/shared/i18n/core";
import { BookmarkToolsModal } from "@/features/bookmarks/BookmarkToolsModal";
import { BookmarkAutoRuleModal } from "@/features/bookmarks/BookmarkAutoRuleModal";
import { isSafeExternalUrl } from "@/shared/utils/url-safety";
import { FeatureEmptyState } from "@/shared/ui/FeatureEmptyState";
import type { BookmarkNode } from "@/chrome/bookmarks";
import { BookmarkTreeView } from "./BookmarkTreeView";
import { TopFolderSection, BookmarkRow } from "./components";
import { useBookmarkData, useBookmarkSearch } from "./hooks";
import styles from "@/features/tabs/styles/views.module.less";

/** 视图模式：列表 / 脉图（横向）/ 架构图（垂直） */
type BookmarkLayout = "list" | "mindmap" | "orgchart";

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

/** 高亮搜索关键词 */
function buildHighlight(query: string) {
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
}

export function BookmarkView() {
  const { t } = useT();
  const tabs = useTabsStore((s) => s.tabs);
  const [layout, setLayout] = useState<BookmarkLayout>("list");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [autoRuleOpen, setAutoRuleOpen] = useState(false);

  const {
    hasPermission,
    checking,
    topSections,
    totalBookmarks,
    refreshBookmarks,
    handleRequestPermission,
    handleBookmarkAll,
  } = useBookmarkData(tabs);

  const { searchQuery, searchResults, searching, handleSearch } = useBookmarkSearch();

  /** 解析文件夹标题（支持 Chrome 默认文件夹） */
  const resolveTitle = useCallback((n: BookmarkNode) => resolveFolderTitle(n, t), [t]);

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
              onClick: () => void handleRequestPermission(),
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
              onClick={() => void handleBookmarkAll(tabs)}
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
          onChange={(e) => void handleSearch(e.target.value)}
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
