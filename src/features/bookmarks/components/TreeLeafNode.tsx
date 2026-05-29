/**
 * 树叶子节点（书签卡片）
 *
 * 显示单个书签，包含 favicon、标题、hostname 和 tooltip
 */

import { useState, useContext } from "react";
import { Typography, Flex } from "antd";
import type { BookmarkNode } from "@/chrome/bookmarks";
import { getFaviconUrl } from "@/chrome";
import { useAccent } from "@/shared/hooks/use-accent";
import { getHostname, getFallbackLetter } from "../utils/tree-helpers";
import { ShowHostContext } from "../hooks/use-show-host";
import styles from "../styles/bookmark-tree.module.less";

interface TreeLeafNodeProps {
  node: BookmarkNode;
  onOpen: (url: string) => void;
}

export function TreeLeafNode({ node, onOpen }: TreeLeafNodeProps) {
  const url = node.url ?? "";
  const hostname = getHostname(url);
  const faviconUrl = getFaviconUrl(url);
  const accent = useAccent(faviconUrl || undefined, hostname);
  const [faviconError, setFaviconError] = useState(false);
  const showHost = useContext(ShowHostContext);

  const titleText = node.title || hostname;

  return (
    <Flex
      className={styles.leaf}
      data-accent={accent.bar}
      onClick={() => url && onOpen(url)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" && url) onOpen(url);
      }}
      data-url={url}
    >
      <Typography.Text className={styles.leafBar} aria-hidden="true" />
      {faviconUrl && !faviconError ? (
        <img
          src={faviconUrl}
          alt=""
          width={20}
          height={20}
          className={styles.leafFavicon}
          onError={() => setFaviconError(true)}
        />
      ) : (
        <Typography.Text
          className={styles.leafFaviconFallback}
          data-accent-bg={accent.soft}
          data-accent-text={accent.text}
        >
          {getFallbackLetter(node.title ?? "", url)}
        </Typography.Text>
      )}
      <Flex vertical className={styles.leafMain}>
        <Flex className={styles.leafTitle}>{titleText}</Flex>
        {showHost && <Flex className={styles.leafHost}>{hostname}</Flex>}
      </Flex>

      {/* 自定义 hover 气泡：显示标题 + 完整 URL（hostname 加粗高亮） */}
      <Flex vertical className={styles.tooltip} role="tooltip">
        <Flex className={styles.tooltipTitle}>{titleText}</Flex>
        <Flex className={styles.tooltipUrl}>
          <Typography.Text className={styles.tooltipHost}>{hostname}</Typography.Text>
          <Typography.Text className={styles.tooltipPath}>
            {url.replace(/^https?:\/\/[^/]+/i, "") || "/"}
          </Typography.Text>
        </Flex>
        <Flex className={styles.tooltipArrow} aria-hidden="true" />
      </Flex>
    </Flex>
  );
}
