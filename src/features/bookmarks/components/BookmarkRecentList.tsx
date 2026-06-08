/**
 * BookmarkRecentList — 最近添加书签视图
 */

import { useEffect, useState, useCallback } from "react";
import { Button, Flex, Spin, Typography } from "antd";
import { ExternalLink, RefreshCw } from "lucide-react";
import { getRecentBookmarks, type BookmarkNode } from "@/chrome/bookmarks";
import { useT } from "@/shared/i18n";
import { getFaviconUrl } from "../utils/bookmark-tree";
import styles from "../styles/BookmarkTree.module.less";

export function BookmarkRecentList() {
  const { t } = useT();
  const [items, setItems] = useState<BookmarkNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    void getRecentBookmarks(50)
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch(() => { setError(true); })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  const handleOpen = useCallback((url: string | undefined) => {
    if (url === undefined) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  if (error) {
    return (
      <Flex vertical align="center" gap={8} className={styles["recent-list__empty"]}>
        <Typography.Text type="secondary">{t("加载失败")}</Typography.Text>
        <Button size="small" icon={<RefreshCw size={14} />} onClick={load}>{t("重试")}</Button>
      </Flex>
    );
  }

  if (loading) {
    return (
      <Flex justify="center" className={styles["recent-list__loading"]}>
        <Spin size="small" />
      </Flex>
    );
  }

  if (items.length === 0) {
    return (
      <Flex justify="center" className={styles["recent-list__empty"]}>
        <Typography.Text type="secondary">{t("暂无最近书签")}</Typography.Text>
      </Flex>
    );
  }

  return (
    <Flex vertical className={styles["recent-list"]} role="list" aria-label={t("最近添加的书签")}>
      {items
        .filter((n) => n.url !== undefined)
        .map((n) => (
          <Flex
            key={n.id}
            align="center"
            gap={8}
            className={styles["recent-list__item"]}
            role="listitem"
            tabIndex={0}
            onClick={() => handleOpen(n.url)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleOpen(n.url);
            }}
          >
            {n.url !== undefined ? (
              <img
                src={getFaviconUrl(n.url)}
                alt=""
                width={16}
                height={16}
                className={styles["recent-list__favicon"]}
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : null}
            <span className={styles["recent-list__title"]}>{n.title}</span>
            {n.url !== undefined ? (
              <span className={styles["recent-list__url"]}>{n.url}</span>
            ) : null}
            <ExternalLink size={12} className={styles["recent-list__open-icon"]} />
          </Flex>
        ))}
    </Flex>
  );
}
