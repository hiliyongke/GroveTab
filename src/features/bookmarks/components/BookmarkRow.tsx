import { useState, useCallback } from "react";
import { Typography, Space } from "antd";
import { ExternalLink } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { getFaviconUrl } from "@/chrome";
import { useAccent } from "@/shared/hooks/use-accent";
import { getHostname, getFallbackLetter } from "@/features/bookmarks/utils/bookmark-helpers";
import type { BookmarkNode } from "@/chrome/bookmarks";
import styles from "@/features/tabs/styles/views.module.less";

interface BookmarkRowProps {
  node: BookmarkNode;
  onOpen: (url: string) => void;
  highlight?: (text: string) => React.ReactNode;
}

/** 单个书签行项 */
export function BookmarkRow({ node, onOpen, highlight }: BookmarkRowProps) {
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
