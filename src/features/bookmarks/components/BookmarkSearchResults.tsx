/**
 * BookmarkSearchResults — 搜索结果列表
 */

import { useCallback } from "react";
import { Flex, Typography } from "antd";
import { Folder, ChevronRight } from "lucide-react";
import { useT } from "@/shared/i18n";
import type { FlatItem } from "../utils/bookmark-tree";
import { getFaviconUrl } from "../utils/bookmark-tree";
import styles from "../styles/BookmarkTree.module.less";

interface Props {
  flat: FlatItem[];
  emptyHint: string;
}

export function BookmarkSearchResults({ flat, emptyHint }: Props) {
  const { t } = useT();

  const handleOpen = useCallback((url: string | undefined) => {
    if (url === undefined) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  if (flat.length === 0) {
    return (
      <Flex justify="center" className={styles["search-results__empty"]}>
        <Typography.Text type="secondary">{emptyHint}</Typography.Text>
      </Flex>
    );
  }

  return (
    <Flex vertical className={styles["search-results"]} role="list" aria-label={t("搜索结果")}>
      {flat.map((item) => (
        <Flex
          key={item.node.id}
          align="center"
          gap={8}
          className={styles["search-results__item"]}
          role="listitem"
          tabIndex={0}
          onClick={() => handleOpen(item.node.url)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleOpen(item.node.url);
          }}
        >
          {item.node.url !== undefined ? (
            <img
              src={getFaviconUrl(item.node.url)}
              alt=""
              width={16}
              height={16}
              className={styles["search-results__favicon"]}
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <Folder size={16} className={styles["search-results__folder-icon"]} />
          )}
          <Flex vertical className={styles["search-results__text"]}>
            <span className={styles["search-results__title"]}>{item.node.title}</span>
            {item.node.url !== undefined && (
              <span className={styles["search-results__url"]}>{item.node.url}</span>
            )}
            {item.path.length > 0 && (
              <span className={styles["search-results__path"]}>{item.path}</span>
            )}
          </Flex>
          <ChevronRight size={12} className={styles["search-results__chevron"]} />
        </Flex>
      ))}
    </Flex>
  );
}
