/**
 * TabGroupCard — Chrome Tab Group 卡片
 *
 * 使用 GroupCardShell 作为卡片骨架，视觉与 DomainGroupCard 对齐：
 *   - 左侧/顶部色条：使用 Chrome Tab Group 原生颜色
 *   - 头部：颜色圆点 + 组名（支持 inline rename）+ 标签数 + 更多操作 Dropdown
 *   - 内容区：TabItem 列表，支持多选
 */

import { useMemo } from "react";
import { Button, Dropdown, Input, Popover, Space, Tag, Tooltip, Typography, theme } from "antd";
import type { MenuProps } from "antd";
import {
  ChevronDown,
  MoreHorizontal,
  Palette,
  Pencil,
  Ungroup,
  X,
  Moon,
  ExternalLink,
} from "lucide-react";

import type { LiveTab } from "@/shared/types";
import type { ChromeTabGroupColor } from "@/chrome";
import { updateTabGroup } from "@/chrome";
import { swBroadcast } from "@/shared/utils/sw-broadcast";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { cssVars } from "@/shared/utils/css-vars";
import { useT } from "@/shared/i18n";
import { TabItem } from "../TabItem";
import { GroupCardShell } from "./GroupCardShell";
import { useCardCollapse } from "../hooks/useCardCollapse";
import { useTabGroupActions } from "../hooks/useTabGroupActions";
import { useTabsStore, useSettingsStore } from "@/store";
import styles from "../styles/items.module.less";

type TabGroupColor = ChromeTabGroupColor;

const TAB_GROUP_COLORS: TabGroupColor[] = [
  "grey",
  "blue",
  "red",
  "yellow",
  "green",
  "pink",
  "purple",
  "cyan",
  "orange",
];

const COLOR_HEX: Record<TabGroupColor, string> = {
  grey: "#8a8f98",
  blue: "#1a73e8",
  red: "#d93025",
  yellow: "#f9ab00",
  green: "#188038",
  pink: "#d01884",
  purple: "#9334e6",
  cyan: "#00acc1",
  orange: "#fa7b17",
};

export interface TabGroupData {
  groupId: number;
  title: string;
  color: TabGroupColor;
  collapsed: boolean;
  windowId: number;
  tabs: LiveTab[];
}

interface TabGroupCardProps {
  group: TabGroupData;
  forceCollapsed?: boolean;
}

export function TabGroupCard({ group, forceCollapsed }: TabGroupCardProps) {
  const { t } = useT();
  const { token } = theme.useToken();
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const closeSingleTab = useTabsStore((s) => s.closeSingleTab);
  const barPosition = useSettingsStore((s) => s.settings.domainGroupAccentBarPosition ?? "left");
  const radiusPreset = useSettingsStore((s) => s.settings.domainGroupCardRadius ?? "default");

  const { collapsed, setCollapsed } = useCardCollapse({
    initialCollapsed: group.collapsed,
    onChange: (next) => {
      if (group.groupId !== -1) {
        void updateTabGroup(group.groupId, { collapsed: next }).then((g) => {
          swBroadcast("tab-group-updated", {
            id: g.id,
            title: g.title,
            color: g.color,
            collapsed: g.collapsed,
            windowId: g.windowId,
          });
        });
      }
    },
  });

  const isCollapsed = forceCollapsed ?? collapsed;
  const colorValue = COLOR_HEX[group.color] ?? COLOR_HEX.grey;

  const {
    renaming,
    titleDraft,
    setTitleDraft,
    busy,
    startRename,
    handleRename,
    handleColorChange,
    handleUngroup,
    handleCloseGroup,
    handleDiscardGroup,
    handleMoveToNewWindow,
    isUngrouped,
  } = useTabGroupActions({ group });

  const cardRadius = useMemo(() => {
    switch (radiusPreset) {
      case "none":
        return 0;
      case "small":
        return 4;
      case "large":
        return 16;
      default:
        return token.borderRadiusLG;
    }
  }, [radiusPreset, token.borderRadiusLG]);

  const allTabIds = useMemo(() => group.tabs.map((tab) => tab.id), [group.tabs]);

  // 颜色选择器
  const colorPicker = (
    <Space wrap className={styles["app-window-group-color-grid"]}>
      {TAB_GROUP_COLORS.map((item) => (
        <Button
          key={item}
          type="text"
          className={`${styles["app-window-group-color"]} ${item === group.color ? styles["is-active"] : ""}`}
          style={cssVars({ "--app-window-group-color": COLOR_HEX[item] })}
          aria-label={t(`windowGroup.color.${item}`)}
          onClick={() => handleColorChange(item)}
        />
      ))}
    </Space>
  );

  // 操作菜单
  const menuItems: MenuProps["items"] = isUngrouped
    ? [
        {
          key: "close",
          danger: true,
          icon: <X size={ICON_SIZE.SMALL} />,
          label: t("tabGroup.closeGroup"),
          onClick: handleCloseGroup,
        },
      ]
    : [
        {
          key: "rename",
          icon: <Pencil size={ICON_SIZE.SMALL} />,
          label: t("tabGroup.rename"),
          onClick: startRename,
        },
        {
          key: "color",
          icon: <Palette size={ICON_SIZE.SMALL} />,
          label: (
            <Popover trigger="click" placement="right" content={colorPicker}>
              {t("tabGroup.changeColor")}
            </Popover>
          ),
        },
        { type: "divider" },
        {
          key: "ungroup",
          icon: <Ungroup size={ICON_SIZE.SMALL} />,
          label: t("tabGroup.dissolve"),
          onClick: handleUngroup,
        },
        {
          key: "discard",
          icon: <Moon size={ICON_SIZE.SMALL} />,
          label: t("tabGroup.discard"),
          onClick: handleDiscardGroup,
        },
        {
          key: "move-new-window",
          icon: <ExternalLink size={ICON_SIZE.SMALL} />,
          label: t("tabGroup.moveToWindow"),
          onClick: handleMoveToNewWindow,
        },
        {
          key: "close",
          danger: true,
          icon: <X size={ICON_SIZE.SMALL} />,
          label: t("tabGroup.closeGroup"),
          onClick: handleCloseGroup,
        },
      ];

  const cardStyle = useMemo<React.CSSProperties>(
    () => ({
      borderRadius: cardRadius || 12,
      overflow: "hidden",
      position: "relative",
      boxShadow: "var(--app-shadow-card)",
      border: `1px solid ${token.colorBorderSecondary}`,
      ...cssVars({
        "--app-hover-border": token.colorBorder,
        "--app-domain-card-radius": `${cardRadius || 12}px`,
        "--app-domain-card-bar": colorValue,
        "--app-domain-card-badge-bg": `color-mix(in srgb, ${colorValue} 14%, transparent)`,
        "--app-domain-card-header-border": isCollapsed ? "transparent" : token.colorBorderSecondary,
        "--app-domain-card-chevron-color": token.colorTextTertiary,
        "--app-domain-card-title-color": token.colorText,
        "--app-row-hover-bg": token.colorFillSecondary,
      }),
    }),
    [cardRadius, colorValue, isCollapsed, token],
  );

  return (
    <GroupCardShell
      style={cardStyle}
      accentBarPosition={isUngrouped ? "none" : barPosition}
      collapsed={isCollapsed}
      header={
        <>
          <Button
            type="text"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? t("展开") : t("折叠")}
            className={styles["app-domain-group-header"]}
          >
            <ChevronDown
              size={ICON_SIZE.TINY}
              className={`${styles["app-domain-group-chevron"]}${isCollapsed ? ` ${styles["is-collapsed"]}` : ""}`}
            />
            <Typography.Text
              aria-hidden
              className={styles["app-tab-group-card-color-dot"]}
              style={{ background: colorValue }}
            />
            {renaming ? (
              <Input
                size="small"
                autoFocus
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onPressEnter={() => {
                  void handleRename();
                }}
                onBlur={() => {
                  void handleRename();
                }}
                className={styles["app-window-group-title-input"]}
              />
            ) : (
              <Typography.Text className={styles["app-domain-group-title"]}>
                {group.title}
              </Typography.Text>
            )}
            <Tag className={styles["app-domain-group-count"]}>{group.tabs.length}</Tag>
          </Button>

          <Dropdown menu={{ items: menuItems }} trigger={["click"]} placement="bottomRight">
            <Tooltip title={t("更多")}>
              <Button
                type="text"
                size="small"
                loading={busy}
                icon={busy ? undefined : <MoreHorizontal size={ICON_SIZE.SMALL} />}
                aria-label={t("更多")}
                className={`app-hover-reveal ${styles["app-domain-group-action"]}`}
              />
            </Tooltip>
          </Dropdown>
        </>
      }
    >
      <Space size={4} direction="vertical" className={styles["app-domain-group-list--flex"]}>
        {group.tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            onJump={(id, wid) => {
              void jumpToTab(id, wid);
            }}
            onClose={(id) => {
              void closeSingleTab(id);
            }}
            showHostname
            selectable
            visibleTabIds={allTabIds}
          />
        ))}
      </Space>
    </GroupCardShell>
  );
}
