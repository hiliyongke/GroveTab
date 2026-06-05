/**
 * SiteCard — 常用站点卡片（纯渲染组件）
 *
 * 菜单使用 antd Dropdown（自带 portal），彻底避免 overflow 裁切问题。
 * 拖拽由父组件 SortableSiteCard 通过 useSortable 注入。
 */

import styles from "./QuickStartLayer.module.less";
import { useCallback, useMemo, useState } from "react";
import { Card, Dropdown, Image } from "antd";
import type { MenuProps } from "antd";
import { GripVertical, Pencil, Trash2, ExternalLink, MoreHorizontal } from "lucide-react";
import { cssVars } from "@/shared/utils/css-vars";
import { useT } from "@/shared/i18n";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useAccent } from "@/shared/hooks/use-accent";
import type { SpeedDialSite } from "@/shared/types";
import { getHostname, getInitial, getFaviconUrl } from "./utils/siteUtils";
import type { DraggableAttributes } from "@dnd-kit/core";

interface SiteCardProps {
  site: SpeedDialSite;
  /** 拖拽手柄的 listeners（由 SortableSiteCard 传入） */
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  dragListeners?: Record<string, Function>;
  /** 拖拽手柄的 attributes（由 SortableSiteCard 传入） */
  dragAttributes?: DraggableAttributes;
  /** 是否正在拖拽中（用于降低透明度） */
  isDragging?: boolean;
  /** 打开编辑弹窗 */
  onEdit: (site: SpeedDialSite) => void;
  /** 删除站点 */
  onDelete: (id: string) => void;
}

export function SiteCard({
  site,
  dragListeners,
  dragAttributes,
  isDragging = false,
  onEdit,
  onDelete,
}: SiteCardProps) {
  const { t } = useT();
  const [faviconError, setFaviconError] = useState(false);

  const hostname = useMemo(() => getHostname(site.url), [site.url]);
  const faviconUrl = useMemo(() => getFaviconUrl(site), [site]);

  /** 从 favicon 提取主色 */
  const accent = useAccent(faviconUrl, hostname);
  const color = accent.bar;

  /** 打开网站 */
  const openSite = useCallback(() => {
    if (typeof chrome !== "undefined" && chrome.tabs) {
      void chrome.tabs.create({ url: site.url });
    } else {
      window.open(site.url, "_blank", "noopener,noreferrer");
    }
  }, [site.url]);

  /** Dropdown 菜单项 */
  const menuItems: MenuProps["items"] = [
    {
      key: "open",
      icon: <ExternalLink size={ICON_SIZE.SMALL} />,
      label: t("新标签页打开"),
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation();
        openSite();
      },
    },
    {
      key: "edit",
      icon: <Pencil size={ICON_SIZE.SMALL} />,
      label: t("编辑"),
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation();
        onEdit(site);
      },
    },
    {
      key: "delete",
      icon: <Trash2 size={ICON_SIZE.SMALL} />,
      label: t("删除"),
      danger: true,
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation();
        onDelete(site.id);
      },
    },
  ];

  /** 卡片模式渲染 */
  const cardStyle: React.CSSProperties = cssVars({
    "--speed-dial-card-accent": color,
    "--speed-dial-card-opacity": isDragging ? "0.4" : "1",
  });

  return (
    <Card
      className={`app-card-interactive ${styles["app-speed-dial-card"]}`}
      classNames={{ body: styles["app-speed-dial-card__body"] }}
      style={cardStyle}
    >
      {/* 缩略图区 —— 16:10，favicon 主色渐变 */}
      <div
        className={styles["app-speed-dial-preview"]}
        role="button"
        tabIndex={0}
        aria-label={t("打开 {name}", { name: site.title || hostname })}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openSite(); }
        }}
        onClick={openSite}
      >
        {/* 拖拽手柄 —— 只有绑定了 dragListeners 时才可拖拽 */}
        {dragListeners && (
          <div {...dragListeners} {...dragAttributes} className={styles["speed-dial-drag-handle"]}>
            <GripVertical size={ICON_SIZE.SMALL} className={styles["speed-dial-drag-icon"]} />
          </div>
        )}

        {/* favicon 或首字母 */}
        {faviconUrl && !faviconError ? (
          <Image
            src={faviconUrl}
            alt=""
            className={styles["app-speed-dial-favicon"]}
            onError={() => setFaviconError(true)}
            preview={false}
            fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
          />
        ) : (
          <span className={styles["app-speed-dial-fallback"]}>{getInitial(hostname)}</span>
        )}

        {/* 「更多」按钮 —— 右上角绝对定位，Dropdown portal 到 body 避免裁切 */}
        <div className={styles["speed-dial-more-container"]}>
          <Dropdown
            menu={{ items: menuItems }}
            trigger={["hover"]}
            placement="bottomRight"
            getPopupContainer={() => document.body}
          >
            <span className={styles["speed-dial-more-btn"]} onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal size={ICON_SIZE.SMALL} />
            </span>
          </Dropdown>
        </div>
      </div>

      {/* 底部信息区 */}
      <div
        className={styles["app-speed-dial-content"]}
        role="button"
        tabIndex={0}
        aria-label={t("打开 {name}", { name: site.title || hostname })}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openSite(); }
        }}
        onClick={openSite}
      >
        <span className={styles["app-speed-dial-title"]} title={site.title || hostname}>
          {site.title || hostname}
        </span>
        <span className={styles["app-speed-dial-hostname"]} title={hostname}>
          {hostname}
        </span>
      </div>
    </Card>
  );
}
