/**
 * TabGroupSection — 窗口内标签组区段
 *
 * 嵌入在 WindowCard 内部，渲染 Chrome 原生 Tab Group：
 *   - 彩色圆点 + 组标题（支持 inline rename）+ 标签数 + 更多操作
 *   - 折叠/展开同步 Chrome 原生 Tab Group 状态
 *   - 拖放目标（DroppableZone）：可拖入标签到该分组
 *
 * 操作逻辑复用 useTabGroupActions hook，与 TabGroupCard 保持一致。
 */

import { useMemo } from "react";
import {
  Button,
  Dropdown,
  Flex,
  Input,
  Popover,
  Space,
  Tag,
  Tooltip,
  Typography,
  List,
  theme,
} from "antd";
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
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { cssVars } from "@/shared/utils/css-vars";
import { useT } from "@/shared/i18n";
import { feedback } from "@/shared/ui/feedback";
import { updateTabGroup } from "@/chrome";
import { swBroadcast } from "@/shared/utils/sw-broadcast";
import { useTabGroupActions } from "@/features/tabs/hooks/useTabGroupActions";
import type { TabGroupData } from "@/features/tabs/components/TabGroupCard";
import { DraggableTab } from "./DraggableTab";
import { DroppableZone } from "./DroppableZone";
import styles from "@/features/tabs/styles/views.module.less";

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

interface TabGroupSectionProps {
  groupId: number;
  tabs: LiveTab[];
  visibleTabIds: number[];
  onJump: (tabId: number, windowId: number) => void;
  onClose: (tabId: number) => void;
  onRefresh: () => void;
  showIdleTime?: boolean;
}

export function TabGroupSection({
  groupId,
  tabs,
  visibleTabIds,
  onJump,
  onClose,
  onRefresh,
  showIdleTime = false,
}: TabGroupSectionProps) {
  const { t } = useT();
  const { token } = theme.useToken();

  // 构造 TabGroupData 供 useTabGroupActions 使用
  const color = (tabs.find((tab) => tab.groupColor)?.groupColor ?? "grey") as TabGroupColor;
  const groupCollapsed = tabs.some((tab) => tab.groupCollapsed === true);
  const title = useMemo(() => {
    const groupTitle = tabs.find((tab) => tab.groupTitle)?.groupTitle?.trim();
    return groupTitle && groupTitle.length > 0 ? groupTitle : t("tabGroup.unnamed");
  }, [tabs, t]);

  const groupData = useMemo<TabGroupData>(
    () => ({
      groupId,
      title,
      color,
      collapsed: groupCollapsed,
      windowId: tabs[0]?.windowId ?? -1,
      tabs,
    }),
    [groupId, title, color, groupCollapsed, tabs],
  );

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
  } = useTabGroupActions({ group: groupData });

  const colorValue = COLOR_HEX[color] ?? COLOR_HEX.grey;

  const handleToggleCollapsed = () => {
    if (busy) return;
    void (async () => {
      try {
        const group = await updateTabGroup(groupId, { collapsed: !groupCollapsed });
        swBroadcast("tab-group-updated", {
          id: group.id,
          title: group.title,
          color: group.color,
          collapsed: group.collapsed,
          windowId: group.windowId,
        });
        onRefresh();
      } catch (err) {
        feedback.error(t("tabGroup.actionFailed"), err);
      }
    })();
  };

  // 颜色选择器
  const colorPicker = (
    <Space wrap className={styles["app-window-group-color-grid"]}>
      {TAB_GROUP_COLORS.map((item) => (
        <Button
          key={item}
          type="text"
          className={`${styles["app-window-group-color"]} ${item === color ? styles["is-active"] : ""}`}
          style={cssVars({ "--app-window-group-color": COLOR_HEX[item] })}
          aria-label={t(`windowGroup.color.${item}`)}
          onClick={() => handleColorChange(item)}
        />
      ))}
    </Space>
  );

  const menuItems: MenuProps["items"] = [
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

  return (
    <DroppableZone
      id={`window-group:${groupId}`}
      data={{
        kind: "group",
        windowId: tabs[0]?.windowId ?? -1,
        groupId,
        incognito: tabs.some((tab) => tab.incognito),
      }}
      className={styles["app-window-group-section"]}
      style={cssVars({
        "--app-window-group-color": colorValue,
        "--app-window-group-bg": `color-mix(in srgb, ${colorValue} 8%, transparent)`,
        "--app-window-group-border": `color-mix(in srgb, ${colorValue} 34%, ${token.colorBorderSecondary})`,
      })}
    >
      <Flex align="center" className={styles["app-window-group-header"]}>
        <Button
          type="text"
          className={styles["app-window-group-trigger"]}
          aria-expanded={!groupCollapsed}
          onClick={handleToggleCollapsed}
          disabled={busy}
        >
          <ChevronDown
            className={`${styles["app-window-group-chevron"]}${groupCollapsed ? ` ${styles["is-collapsed"]}` : ""}`}
            size={ICON_SIZE.TINY}
          />
          <Typography.Text className={styles["app-window-group-dot"]} />
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
            <Typography.Text className={styles["app-window-group-title"]}>{title}</Typography.Text>
          )}
          <Tag className={styles["app-window-group-count"]}>{tabs.length}</Tag>
        </Button>

        <Dropdown menu={{ items: menuItems }} trigger={["click"]} placement="bottomRight">
          <Tooltip title={t("更多")}>
            <Button
              type="text"
              size="small"
              loading={busy}
              icon={busy ? undefined : <MoreHorizontal size={ICON_SIZE.SMALL} />}
              aria-label={t("更多")}
              className={styles["app-window-group-action"]}
            />
          </Tooltip>
        </Dropdown>
      </Flex>

      {!groupCollapsed && (
        <List className={styles["app-window-group-list"]}>
          {tabs.map((tab) => (
            <DraggableTab
              key={tab.id}
              tab={tab}
              onJump={onJump}
              onClose={onClose}
              visibleTabIds={visibleTabIds}
              showIdleTime={showIdleTime}
            />
          ))}
        </List>
      )}
    </DroppableZone>
  );
}
