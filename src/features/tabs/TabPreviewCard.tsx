/**
 * TabPreviewCard — 标签页悬停预览卡片
 *
 * 鼠标悬停 TabItem 时展示的精致预览卡片，包含：
 *   - 标题（完整展示，不截断）
 *   - URL（可点击复制）
 *   - 今日使用时长（如果开启了追踪）
 *   - 域名徽章
 *   - 关闭按钮
 *
 * 设计：
 *   - 使用 Ant Design Popover 实现，保证与主题一致
 *   - 400ms 延迟显示，避免快速划过时频繁弹出
 *   - 卡片内操作按钮（关闭）直接可用
 */

import { useMemo } from "react";
import { Popover, Typography, Button, Flex, Tag, theme } from "antd";
import { X, ExternalLink, Copy, Clock } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import type { LiveTab } from "@/shared/types";
import { useFocusTime } from "@/shared/hooks/use-focus-time";
import { cssVars } from "@/shared/utils/css-vars";
import styles from "./styles/tab-preview.module.less";

interface TabPreviewCardProps {
  tab: LiveTab;
  focusTimeLabel?: string;
  children: React.ReactElement;
  onClose: (tabId: number) => void;
}

export function TabPreviewCard({ tab, focusTimeLabel, children, onClose }: TabPreviewCardProps) {
  const { t } = useT();
  const { token } = theme.useToken();
  const focusTime = useFocusTime(tab.url);

  const contentStyle = useMemo(
    () =>
      cssVars({
        "--tab-preview-bg": token.colorBgElevated,
        "--tab-preview-border": token.colorBorderSecondary,
        "--tab-preview-text": token.colorText,
        "--tab-preview-text-secondary": token.colorTextSecondary,
        "--tab-preview-text-tertiary": token.colorTextTertiary,
        "--tab-preview-primary": token.colorPrimary,
        "--tab-preview-fill": token.colorFillTertiary,
      }),
    [token],
  );

  const displayFocusTime = focusTimeLabel ?? focusTime;

  const content = (
    <div className={styles["tab-preview"]} style={contentStyle}>
      <Flex vertical gap={6}>
        {/* 标题行 */}
        <Typography.Text
          className={styles["tab-preview-title"]}
          ellipsis={{ tooltip: false }}
        >
          {tab.title}
        </Typography.Text>

        {/* URL 行 */}
        <Flex align="center" gap={4}>
          <Typography.Text
            className={styles["tab-preview-url"]}
            ellipsis={{ tooltip: tab.url }}
          >
            {tab.url}
          </Typography.Text>
          <Button
            type="text"
            size="small"
            icon={<Copy size={ICON_SIZE.MICRO} />}
            onClick={(e) => {
              e.stopPropagation();
              void navigator.clipboard.writeText(tab.url);
            }}
            className={styles["tab-preview-copy"]}
            aria-label={t("复制URL")}
          />
        </Flex>

        {/* 元信息行 */}
        <Flex align="center" gap={6} className={styles["tab-preview-meta"]}>
          <Tag>{tab.hostname}</Tag>
          {displayFocusTime && (
            <Flex align="center" gap={2}>
              <Clock size={ICON_SIZE.MICRO} />
              <Typography.Text className={styles["tab-preview-time"]}>
                {t("今日")} {displayFocusTime}
              </Typography.Text>
            </Flex>
          )}
        </Flex>

        {/* 操作行 */}
        <Flex justify="flex-end" gap={4}>
          <Button
            type="text"
            size="small"
            icon={<ExternalLink size={ICON_SIZE.SMALL} />}
            onClick={(e) => {
              e.stopPropagation();
              window.open(tab.url, "_blank");
            }}
          >
            {t("新标签页打开")}
          </Button>
          <Button
            type="text"
            size="small"
            danger
            icon={<X size={ICON_SIZE.SMALL} />}
            onClick={(e) => {
              e.stopPropagation();
              onClose(tab.id);
            }}
          >
            {t("关闭")}
          </Button>
        </Flex>
      </Flex>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="hover"
      placement="rightTop"
      mouseEnterDelay={0.5}
      mouseLeaveDelay={0.15}
      overlayClassName={styles["tab-preview-popover"]}
      arrow={false}
      destroyOnHidden
    >
      {children}
    </Popover>
  );
}
