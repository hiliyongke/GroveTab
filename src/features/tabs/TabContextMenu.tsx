/**
 * TabContextMenu — 标签右键上下文菜单（antd 版）
 *
 * 设计：
 *   - 外层使用 antd Popover 风格的浮层（手动定位 + Card 实现，避免动态 anchor 绑定）
 *   - 菜单项使用 antd Button(type="text") 保持一致视觉
 *   - 标签使用 antd Tag（closable）
 *   - 输入使用 antd Input / Input.TextArea
 *   - 边界钳制：防止菜单超出 viewport
 *   - ESC 关闭
 */

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { Pin, Tag as TagIcon, MessageSquare, Moon, MoveHorizontal, Star } from "lucide-react";
import { cssVars } from "@/shared/utils/css-vars";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { Button, Input, Tag, Divider, Card, theme, Flex } from "antd";
import { useMetadataStore, useTabsStore, useSpeedDialStore } from "@/store";
import { useT } from "@/shared/i18n";
import { stringToColor } from "@/shared/utils/color";
import { splitTabToSide } from "@/chrome";
import { Z } from "@/shared/config/z-index";
import { CONFIG } from "@/shared/config";
import styles from "./styles/views.module.less";

interface TabContextMenuProps {
  x: number;
  y: number;
  url: string;
  /** 标签页标题，用于添加到常用站点 */
  title?: string;
  /** 标签页 favicon，用于添加到常用站点 */
  favIconUrl?: string;
  /** 标签页 ID，用于休眠等需要 tabId 的操作 */
  tabId?: number;
  onClose: () => void;
}

const MENU_WIDTH = CONFIG.ui.menuWidth;

/** 标准化 URL：去掉协议前缀和常见跟踪参数，用于去重比较 */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // 去掉常见跟踪参数
    const dropParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
    ];
    dropParams.forEach((p) => u.searchParams.delete(p));
    // 去掉 hash
    u.hash = "";
    return u.host + u.pathname.replace(/\/+$/, "") + u.search;
  } catch {
    return url;
  }
}

/**
 * 标签右键上下文菜单
 */
export function TabContextMenu({
  x,
  y,
  url,
  title,
  favIconUrl,
  tabId,
  onClose,
}: TabContextMenuProps) {
  const { t } = useT();
  const { token } = theme.useToken();
  const addTag = useMetadataStore((s) => s.addTag);
  const removeTag = useMetadataStore((s) => s.removeTag);
  const setNote = useMetadataStore((s) => s.setNote);
  const togglePin = useMetadataStore((s) => s.togglePin);
  const isPinned = useMetadataStore((s) => s.isPinned);
  const tags = useMetadataStore((s) => s.getTags(url));
  const note = useMetadataStore((s) => s.getNote(url));
  const discardTab = useTabsStore((s) => s.discardTab);
  const addSite = useSpeedDialStore((s) => s.addSite);
  const speedDialSites = useSpeedDialStore((s) => s.sites);

  const [showTagInput, setShowTagInput] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [tagValue, setTagValue] = useState("");
  const [noteValue, setNoteValue] = useState(note);
  const [position, setPosition] = useState({ left: x, top: y });

  const menuRef = useRef<HTMLDivElement>(null);

  // 关闭：外部点击 / ESC
  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleMouse);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleMouse);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // 边界钳制：防止菜单超出 viewport
  useLayoutEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const maxLeft = window.innerWidth - rect.width - 8;
    const maxTop = window.innerHeight - rect.height - 8;
    setPosition({
      left: Math.min(x, Math.max(8, maxLeft)),
      top: Math.min(y, Math.max(8, maxTop)),
    });
  }, [x, y]);

  const handleAddTag = () => {
    const v = tagValue.trim();
    if (v) {
      void addTag(url, v);
      setTagValue("");
      setShowTagInput(false);
    }
  };

  const handleSaveNote = () => {
    void setNote(url, noteValue);
    setShowNoteInput(false);
  };

  const pinned = isPinned(url);
  const menuStyle: React.CSSProperties = {
    left: position.left,
    top: position.top,
    ...cssVars({
      "--app-tab-context-width": `${MENU_WIDTH}px`,
      "--app-tab-context-z": String(Z.contextMenu),
      "--app-tab-context-radius": `${token.borderRadiusLG}px`,
      "--app-tab-context-shadow": token.boxShadow,
    }),
  };

  return (
    <Flex
      ref={menuRef}
      role="menu"
      onClick={(e) => e.stopPropagation()}
      className={styles["app-tab-context-menu"]}
      style={menuStyle}
    >
      <Card
        size="small"
        classNames={{ body: styles["app-tab-context-menu__body"] }}
        className={styles["app-tab-context-menu__card"]}
      >
        {/* Pin / Unpin */}
        <Button
          type="text"
          block
          icon={<Pin size={ICON_SIZE.MEDIUM} />}
          onClick={() => {
            void togglePin(url);
            onClose();
          }}
          className={styles["app-tab-context-menu__button"]}
        >
          {pinned ? t("context.unpin") : t("context.pin")}
        </Button>

        {/* 休眠标签页 */}
        {tabId != null && (
          <Button
            type="text"
            block
            icon={<Moon size={ICON_SIZE.MEDIUM} />}
            onClick={() => {
              void (async () => {
                onClose();
                try {
                  await discardTab(tabId);
                } catch {
                  /* store 已 toast */
                }
              })();
            }}
            className={styles["app-tab-context-menu__button"]}
          >
            {t("tabs.discard")}
          </Button>
        )}

        {/* 分屏——将标签页移到新窗口，左右各占 50% */}
        {tabId != null && (
          <Button
            type="text"
            block
            icon={<MoveHorizontal size={ICON_SIZE.MEDIUM} />}
            onClick={() => {
              void (async () => {
                onClose();
                try {
                  await splitTabToSide(tabId);
                } catch {
                  /* splitTabToSide 内部已 safeCall */
                }
              })();
            }}
            className={styles["app-tab-context-menu__button"]}
          >
            {t("context.splitScreen")}
          </Button>
        )}

        {/* 添加到常用站点 —— 标准化 URL 后再比较，避免 http/https 差异导致重复添加 */}
        {!speedDialSites.some((s) => normalizeUrl(s.url) === normalizeUrl(url)) && (
          <Button
            type="text"
            block
            icon={<Star size={ICON_SIZE.MEDIUM} />}
            onClick={() => {
              void (async () => {
                await addSite({
                  id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                  url,
                  title: title || url,
                  favIconUrl,
                  order: speedDialSites.length,
                  createdAt: Date.now(),
                });
                onClose();
              })();
            }}
            className={styles["app-tab-context-menu__button"]}
          >
            {t("context.addToQuickStart")}
          </Button>
        )}

        <Divider className={styles["app-tab-context-menu__divider"]} />

        {/* Add Tag */}
        <Button
          type="text"
          block
          icon={<TagIcon size={ICON_SIZE.MEDIUM} />}
          onClick={() => setShowTagInput(true)}
          className={styles["app-tab-context-menu__button"]}
        >
          {t("context.addTag")}
        </Button>

        {/* 已有 tags */}
        {tags.length > 0 && (
          <Flex wrap="wrap" gap="small" className={styles["app-tab-context-menu__tag-list"]}>
            {tags.map((tag) => (
              <Tag
                key={tag}
                closable
                onClose={(e) => {
                  e.preventDefault();
                  void removeTag(url, tag);
                }}
                className={styles["app-tab-context-menu__tag"]}
                data-tag-color={stringToColor(tag)}
              >
                {tag}
              </Tag>
            ))}
          </Flex>
        )}

        {/* Tag 输入 */}
        {showTagInput && (
          <Flex gap="small" className={styles["app-tab-context-menu__tag-input"]}>
            <Input
              size="small"
              autoFocus
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
              onPressEnter={handleAddTag}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setShowTagInput(false);
                }
              }}
              placeholder={t("context.tagPlaceholder")}
            />
            <Button type="primary" size="small" onClick={handleAddTag}>
              {t("context.save")}
            </Button>
          </Flex>
        )}

        <Divider className={styles["app-tab-context-menu__divider"]} />

        {/* Note */}
        <Button
          type="text"
          block
          icon={<MessageSquare size={ICON_SIZE.MEDIUM} />}
          onClick={() => {
            setShowNoteInput(true);
            setNoteValue(note);
          }}
          className={styles["app-tab-context-menu__button"]}
        >
          {note ? t("context.editNote") : t("context.addNote")}
        </Button>

        {showNoteInput && (
          <Flex vertical gap="small" className={styles["app-tab-context-menu__note"]}>
            <Input.TextArea
              autoFocus
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              placeholder={t("context.notePlaceholder")}
              rows={3}
              className={styles["app-tab-context-menu__note-field"]}
            />
            <Flex
              justify="flex-end"
              gap="small"
              className={styles["app-tab-context-menu__note-actions"]}
            >
              <Button size="small" onClick={() => setShowNoteInput(false)}>
                {t("context.cancel")}
              </Button>
              <Button type="primary" size="small" onClick={handleSaveNote}>
                {t("context.save")}
              </Button>
            </Flex>
          </Flex>
        )}
      </Card>
    </Flex>
  );
}
