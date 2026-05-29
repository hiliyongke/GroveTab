/**
 * TabThumbnailTooltip - 标签缩略图预览 Tooltip
 *
 * 功能：
 * 1. 鼠标悬停时显示标签页缩略图
 * 2. 缩略图尺寸 200×120px
 * 3. 显示标题、URL、关闭按钮
 * 4. 支持配置开启/关闭
 */

import { useState, useCallback, memo } from "react";
import { Tooltip, Flex, Typography, Button, theme, Skeleton } from "antd";
import { X, ImageOff } from "lucide-react";
import { useT } from "@/shared/i18n";
import { useTabThumbnail } from "@/shared/hooks/use-tab-thumbnail";
import type { LiveTab } from "@/shared/types";
import styles from "./TabThumbnailTooltip.module.less";

interface TabThumbnailTooltipProps {
  tab: LiveTab;
  children: React.ReactNode;
  enabled?: boolean;
  onClose?: (tabId: number) => void;
}

const ThumbnailContent = memo(function ThumbnailContent({
  tab,
  thumbnail,
  isLoading,
  onClose,
}: {
  tab: LiveTab;
  thumbnail: string | null;
  isLoading: boolean;
  onClose?: (tabId: number) => void;
}) {
  const { t } = useT();
  const { token } = theme.useToken();

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose?.(tab.id);
    },
    [onClose, tab.id],
  );

  // 截断标题和 URL
  const title = tab.title || t("unnamedTab");
  const displayUrl = tab.url.replace(/^https?:\/\//, "").slice(0, 50);

  return (
    <Flex vertical className={styles.thumbnailTooltip}>
      {/* 缩略图区域 */}
      <div className={styles.thumbnailImageContainer}>
        {isLoading ? (
          <Skeleton.Image active style={{ width: 200, height: 120 }} />
        ) : thumbnail ? (
          <img
            src={thumbnail}
            alt={title}
            className={styles.thumbnailImage}
            style={{ width: 200, height: 120, objectFit: "cover" }}
          />
        ) : (
          <Flex
            vertical
            align="center"
            justify="center"
            className={styles.thumbnailPlaceholder}
            style={{
              width: 200,
              height: 120,
              background: token.colorFillSecondary,
            }}
          >
            <ImageOff size={32} color={token.colorTextTertiary} />
            <Typography.Text type="secondary" className={styles.thumbnailPlaceholderText}>
              {t("thumbnail.unavailable")}
            </Typography.Text>
          </Flex>
        )}

        {/* 关闭按钮 */}
        {onClose && (
          <Button
            type="text"
            size="small"
            icon={<X size={14} />}
            onClick={handleClose}
            className={`${styles.thumbnailCloseButton} ${styles.thumbnailCloseBtn}`}
          />
        )}
      </div>

      {/* 信息区域 */}
      <Flex vertical className={styles.thumbnailInfo}>
        <Typography.Text strong ellipsis className={styles.thumbnailTitle} title={title}>
          {title}
        </Typography.Text>
        <Typography.Text type="secondary" ellipsis className={styles.thumbnailUrl} title={tab.url}>
          {displayUrl}
        </Typography.Text>
      </Flex>
    </Flex>
  );
});

export const TabThumbnailTooltip = memo(function TabThumbnailTooltip({
  tab,
  children,
  enabled = true,
  onClose,
}: TabThumbnailTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { thumbnail, isLoading, loadThumbnail, hasThumbnail } = useTabThumbnail({
    tabId: tab.id,
    url: tab.url,
    enabled: enabled && isOpen,
  });

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (open && enabled && !hasThumbnail) {
        // 延迟加载，避免频繁触发
        setTimeout(() => {
          void loadThumbnail();
        }, 100);
      }
    },
    [enabled, hasThumbnail, loadThumbnail],
  );

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <Tooltip
      title={
        <ThumbnailContent tab={tab} thumbnail={thumbnail} isLoading={isLoading} onClose={onClose} />
      }
      open={isOpen}
      onOpenChange={handleOpenChange}
      placement="right"
      mouseEnterDelay={0.5}
      mouseLeaveDelay={0.1}
      arrow={false}
      overlayClassName={styles.thumbnailTooltipOverlay}
    >
      {children}
    </Tooltip>
  );
});
