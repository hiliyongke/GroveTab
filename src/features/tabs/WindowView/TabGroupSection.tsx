import { useMemo, useState } from "react";
import {
  Button,
  Dropdown,
  Input,
  Modal,
  Popover,
  Tag,
  Tooltip,
  Typography,
  theme,
  Space,
  List,
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
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { cssVars } from "@/shared/utils/css-vars";
import { useT } from "@/shared/i18n";
import { translate } from "@/shared/i18n/core";
import { feedback } from "@/shared/ui/feedback";
import {
  updateTabGroup,
  ungroupTabs,
  closeTabs,
  discardTab,
  createWindowWithTab,
  moveTabs,
  groupTabs,
} from "@/chrome";
import type { ChromeTabGroupColor } from "@/chrome";
import { swBroadcast } from "@/shared/utils/sw-broadcast";
import { DraggableTab } from "./DraggableTab";
import { DroppableZone } from "./DroppableZone";
import styles from "../styles/views.module.less";

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
}

function getGroupTitle(groupId: number, tabs: LiveTab[], fallback: string): string {
  const title = tabs.find((tab) => tab.groupTitle)?.groupTitle?.trim();
  return title && title.length > 0 ? title : `${fallback} #${groupId}`;
}

export function TabGroupSection({
  groupId,
  tabs,
  visibleTabIds,
  onJump,
  onClose,
  onRefresh,
}: TabGroupSectionProps) {
  const { t } = useT();
  const { token } = theme.useToken();
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState(() =>
    getGroupTitle(groupId, tabs, translate('未命名分组')),
  );
  const [busy, setBusy] = useState(false);

  const color = (tabs.find((tab) => tab.groupColor)?.groupColor ?? "grey") as TabGroupColor;
  const collapsed = tabs.some((tab) => tab.groupCollapsed === true);
  const title = useMemo(
    () => getGroupTitle(groupId, tabs, t('未命名分组')),
    [groupId, tabs, t],
  );
  const colorValue = COLOR_HEX[color] ?? COLOR_HEX.grey;

  const runGroupAction = async (action: () => Promise<void>, successKey?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      if (successKey) feedback.success(t(successKey));
      onRefresh();
    } catch (err) {
      feedback.error(t('标签组操作失败，请重试'), err);
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const handleToggleCollapsed = () => {
    void runGroupAction(async () => {
      const group = await updateTabGroup(groupId, { collapsed: !collapsed });
      swBroadcast("tab-group-updated", {
        id: group.id,
        title: group.title,
        color: group.color,
        collapsed: group.collapsed,
        windowId: group.windowId,
      });
    });
  };

  const handleRename = async () => {
    const nextTitle = titleDraft.trim();
    await runGroupAction(async () => {
      const group = await updateTabGroup(groupId, { title: nextTitle });
      swBroadcast("tab-group-updated", {
        id: group.id,
        title: group.title,
        color: group.color,
        collapsed: group.collapsed,
        windowId: group.windowId,
      });
      setRenaming(false);
    }, "windowGroup.renamed");
  };

  const handleColorChange = (nextColor: TabGroupColor) => {
    void runGroupAction(async () => {
      const group = await updateTabGroup(groupId, { color: nextColor });
      swBroadcast("tab-group-updated", {
        id: group.id,
        title: group.title,
        color: group.color,
        collapsed: group.collapsed,
        windowId: group.windowId,
      });
    }, "windowGroup.colorChanged");
  };

  const handleMoveToNewWindow = () => {
    void runGroupAction(async () => {
      const [firstTab, ...restTabs] = tabs;
      if (!firstTab) return;
      const newWindow = await createWindowWithTab(firstTab.id);
      if (!newWindow.id) throw new Error("new window has no id");
      if (restTabs.length > 0) {
        await moveTabs(
          restTabs.map((tab) => tab.id),
          newWindow.id,
          -1,
        );
      }
      const movedTabIds = tabs.map((tab) => tab.id);
      const nextGroupId = await groupTabs({
        tabIds: movedTabIds,
        createProperties: { windowId: newWindow.id },
      });
      const group = await updateTabGroup(nextGroupId, { title, color, collapsed });
      swBroadcast("tab-group-updated", {
        id: group.id,
        title: group.title,
        color: group.color,
        collapsed: group.collapsed,
        windowId: group.windowId,
      });
    }, "windowGroup.movedToNewWindow");
  };

  const handleUngroup = () => {
    void runGroupAction(async () => {
      await ungroupTabs(tabs.map((tab) => tab.id));
      swBroadcast("tab-ungrouped", { groupId, windowId: tabs[0]?.windowId });
    }, "windowGroup.ungrouped");
  };

  const handleCloseGroup = () => {
    Modal.confirm({
      title: t('关闭该标签组？'),
      content: t('将关闭该组内 {count} 个标签。', { count: tabs.length }),
      okButtonProps: { danger: true },
      onOk: () =>
        runGroupAction(async () => {
          await closeTabs(tabs.map((tab) => tab.id));
        }, "windowGroup.closed"),
    });
  };

  const handleDiscardGroup = () => {
    void runGroupAction(async () => {
      await Promise.all(tabs.filter((tab) => !tab.discarded).map((tab) => discardTab(tab.id)));
    }, "windowGroup.discarded");
  };

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
      label: t('重命名'),
      onClick: () => {
        setTitleDraft(title);
        setRenaming(true);
      },
    },
    {
      key: "color",
      icon: <Palette size={ICON_SIZE.SMALL} />,
      label: (
        <Popover trigger="click" placement="right" content={colorPicker}>
          {t('更换颜色')}
        </Popover>
      ),
    },
    { type: "divider" },
    {
      key: "ungroup",
      icon: <Ungroup size={ICON_SIZE.SMALL} />,
      label: t('解散分组'),
      onClick: handleUngroup,
    },
    {
      key: "discard",
      icon: <Moon size={ICON_SIZE.SMALL} />,
      label: t('休眠组内标签'),
      onClick: handleDiscardGroup,
    },
    {
      key: "move-new-window",
      icon: <ExternalLink size={ICON_SIZE.SMALL} />,
      label: t('移动到新窗口'),
      onClick: handleMoveToNewWindow,
    },
    {
      key: "close",
      danger: true,
      icon: <X size={ICON_SIZE.SMALL} />,
      label: t('关闭分组'),
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
      <Space className={styles["app-window-group-header"]}>
        <Button
          type="text"
          className={styles["app-window-group-trigger"]}
          aria-expanded={!collapsed}
          onClick={handleToggleCollapsed}
          disabled={busy}
        >
          <ChevronDown
            className={`${styles["app-window-group-chevron"]}${collapsed ? ` ${styles["is-collapsed"]}` : ""}`}
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
          <Tooltip title={t('更多')}>
            <Button
              type="text"
              size="small"
              loading={busy}
              icon={busy ? undefined : <MoreHorizontal size={ICON_SIZE.SMALL} />}
              aria-label={t('更多')}
              className={styles["app-window-group-action"]}
            />
          </Tooltip>
        </Dropdown>
      </Space>

      {!collapsed && (
        <List className={styles["app-window-group-list"]}>
          {tabs.map((tab) => (
            <DraggableTab
              key={tab.id}
              tab={tab}
              onJump={onJump}
              onClose={onClose}
              visibleTabIds={visibleTabIds}
            />
          ))}
        </List>
      )}
    </DroppableZone>
  );
}
