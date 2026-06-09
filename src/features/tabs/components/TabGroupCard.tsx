/**
 * TabGroupCard — Chrome Tab Group 卡片
 *
 * 使用 GroupCardShell 作为卡片骨架，视觉与 DomainGroupCard 对齐：
 *   - 左侧/顶部色条：使用 Chrome Tab Group 原生颜色
 *   - 头部：颜色圆点 + 组名（支持 inline rename）+ 标签数 + 更多操作 Dropdown
 *   - 内容区：TabItem 列表，支持多选
 */

import { useMemo, memo } from "react";
import { Button, Dropdown, Flex, Input, Popover, Space, Tag, Tooltip, Typography } from "antd";
import type { MenuProps } from "antd";
import {
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
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { cssVars } from "@/shared/utils/css-vars";
import { useT } from "@/shared/i18n";
import { TabItem } from "./TabItem";
import { GroupCardShell } from "./GroupCardShell";
import { useGroupCardSettings } from "../hooks/useCardStyle";
import { useTabGroupActions } from "../hooks/useTabGroupActions";
import { useTabsStore } from "@/store";
import styles from "../styles/items.module.less";

type TabGroupColor = ChromeTabGroupColor;

interface TabGroupCardProps {
  group: TabGroupData;
  /** 自定义标签项渲染器，用于拖拽集成 */
  renderTabItem?: (tab: LiveTab) => React.ReactNode;
}

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

export const TabGroupCard = memo(function TabGroupCard({
  group,
  renderTabItem,
}: TabGroupCardProps) {
  const { t } = useT();
  const { barPosition, cardRadius } = useGroupCardSettings();
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const closeSingleTab = useTabsStore((s) => s.closeSingleTab);

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

  const allTabIds = useMemo(() => group.tabs.map((tab) => tab.id), [group.tabs]);

  // 颜色选择器
  const colorNames = useMemo(
    () => ({
      grey: t("灰色"), blue: t("蓝色"), red: t("红色"), yellow: t("黄色"),
      green: t("绿色"), pink: t("粉色"), purple: t("紫色"), cyan: t("青色"), orange: t("橙色"),
    }),
    [t],
  );
  const colorPicker = (
    <Space wrap className={styles["app-window-group-color-grid"]}>
      {TAB_GROUP_COLORS.map((item) => (
        <Button
          key={item}
          type="text"
          className={`${styles["app-window-group-color"]} ${item === group.color ? styles["is-active"] : ""}`}
          style={cssVars({ "--app-window-group-color": COLOR_HEX[item] })}
          aria-label={colorNames[item] ?? item}
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
          label: t("关闭分组"),
          onClick: handleCloseGroup,
        },
      ]
    : [
        {
          key: "rename",
          icon: <Pencil size={ICON_SIZE.SMALL} />,
          label: t("重命名"),
          onClick: startRename,
        },
        {
          key: "color",
          icon: <Palette size={ICON_SIZE.SMALL} />,
          label: (
            <Popover trigger="click" placement="right" content={colorPicker}>
              {t("更改颜色")}
            </Popover>
          ),
        },
        { type: "divider" },
        {
          key: "ungroup",
          icon: <Ungroup size={ICON_SIZE.SMALL} />,
          label: t("解除分组"),
          onClick: handleUngroup,
        },
        {
          key: "discard",
          icon: <Moon size={ICON_SIZE.SMALL} />,
          label: t("休眠"),
          onClick: handleDiscardGroup,
        },
        {
          key: "move-new-window",
          icon: <ExternalLink size={ICON_SIZE.SMALL} />,
          label: t("移至新窗口"),
          onClick: handleMoveToNewWindow,
        },
        {
          key: "close",
          danger: true,
          icon: <X size={ICON_SIZE.SMALL} />,
          label: t("关闭分组"),
          onClick: handleCloseGroup,
        },
      ];


  return (
    <GroupCardShell
      accentBarPosition={isUngrouped ? "none" : barPosition}
      interactive={false}
      barColor={colorValue}
      badgeBg={`color-mix(in srgb, ${colorValue} 14%, transparent)`}
      cardRadius={cardRadius}
      header={
        <>
          <div className={styles["app-domain-group-header"]}>
            <span
              aria-hidden
              className={styles["app-tab-group-card-color-dot"]}
              style={{ "--tab-group-color": colorValue } as React.CSSProperties}
            />
            {renaming ? (
              <Input
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
          </div>

          <Flex className={styles["app-domain-group-actions"]}>
            <Dropdown menu={{ items: menuItems }} trigger={["click"]} placement="bottomRight">
              <Tooltip title={t("更多")}>
                <Button
                  type="text"
                  loading={busy}
                  icon={busy ? undefined : <MoreHorizontal size={ICON_SIZE.SMALL} />}
                  aria-label={t("更多")}
                  className={styles["app-domain-group-action"]}
                />
              </Tooltip>
            </Dropdown>
          </Flex>
        </>
      }
    >
      <Flex vertical gap={4} className={styles["app-domain-group-list--flex"]}>
        {renderTabItem
          ? // 自定义渲染模式（用于 @dnd-kit 拖拽集成）
            group.tabs.map((tab) => (
              <div key={tab.id} className={styles["app-domain-group-list-item"]}>
                {renderTabItem(tab)}
              </div>
            ))
          : // 默认渲染模式
            group.tabs.map((tab) => (
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
      </Flex>
    </GroupCardShell>
  );
});
