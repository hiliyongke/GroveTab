/**
 * BookmarkView — 书签管理视图
 *
 * 从 Chrome 书签 API 加载书签树，按目录分组展示，
 * 支持点击跳转和搜索过滤。
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import { Flex, Spin, Typography, Input, List } from "antd";
import { Folder, Globe, ExternalLink, Search, Bookmark, BookmarkPlus } from "lucide-react";
import { FeatureEmptyState } from "@/shared/ui/FeatureEmptyState";
import { getBookmarkTree, flattenBookmarks, hasBookmarksPermission, requestBookmarksPermission, type BookmarkNode } from "@/chrome/bookmarks";
import { useT } from "@/shared/i18n";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import styles from "./BookmarkView.module.less";

export function BookmarkView() {
  const { t } = useT();
  const [bookmarks, setBookmarks] = useState<BookmarkNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const permitted = await hasBookmarksPermission();
      if (!permitted) {
        const granted = await requestBookmarksPermission();
        if (!granted) {
          if (!cancelled) { setLoading(false); setPermissionDenied(true); }
          return;
        }
      }
      const tree = await getBookmarkTree();
      if (!cancelled) {
        setBookmarks(flattenBookmarks(tree));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bookmarks;
    return bookmarks.filter((b) => b.title.toLowerCase().includes(q) || (b.url ?? "").toLowerCase().includes(q));
  }, [bookmarks, query]);

  const handleItemClick = useCallback((url: string | undefined) => {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  if (loading) {
    return <Flex justify="center" className={styles["bookmark-loading"]}><Spin /></Flex>;
  }

  if (permissionDenied) {
    return (
      <FeatureEmptyState
        title={t("bookmark.needPermission")}
        description={t("bookmark.permissionDescription")}
        icon={<Bookmark size={ICON_SIZE.HERO} />}
        hints={[t("bookmark.permissionHint1"), t("bookmark.permissionHint2"), t("bookmark.permissionHint3")]}
        actions={[{ text: t("bookmark.grantPermission"), onClick: requestBookmarksPermission, type: "primary" }]}
      />
    );
  }

  if (bookmarks.length === 0) {
    return (
      <FeatureEmptyState
        title={t("bookmark.emptyTitle")}
        description={t("bookmark.emptyDescription")}
        icon={<BookmarkPlus size={ICON_SIZE.HERO} />}
        hints={[t("bookmark.hint1"), t("bookmark.hint2"), t("bookmark.hint3")]}
      />
    );
  }

  return (
    <Flex vertical gap={8} className={styles["bookmark-view"]}>
      <Input
        allowClear
        size="small"
        prefix={<Search size={ICON_SIZE.SMALL} />}
        placeholder={t("搜索书签...")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={styles["bookmark-search"]}
      />
      <List
        size="small"
        dataSource={filtered}
        renderItem={(item) => (
          <List.Item
            className={styles["bookmark-item"]}
            onClick={() => handleItemClick(item.url)}
          >
            <Flex align="center" gap={8} className={styles["bookmark-item__content"]}>
              {item.url ? (
                <Globe size={ICON_SIZE.SMALL} className={styles["bookmark-icon"]} />
              ) : (
                <Folder size={ICON_SIZE.SMALL} className={styles["bookmark-icon"]} />
              )}
              <Typography.Text ellipsis className={styles["bookmark-item__title"]}>
                {item.title}
              </Typography.Text>
              {item.url && (
                <ExternalLink size={ICON_SIZE.MICRO} className={styles["bookmark-link-icon"]} />
              )}
            </Flex>
          </List.Item>
        )}
      />
    </Flex>
  );
}
