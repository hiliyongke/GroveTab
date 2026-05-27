import { useMemo, useState } from "react";
import { Button, Dropdown, Input, Modal, Tag, Tooltip, theme, Typography, Flex, List } from "antd";
import type { MenuProps } from "antd";
import {
  ChevronDown,
  Edit3,
  EyeOff,
  Layers,
  Merge,
  Monitor,
  MoreHorizontal,
  Plus,
  Shield,
  X,
  Columns2,
} from "lucide-react";

import type { LiveTab, WindowInfo } from "@/shared/types";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { cssVars } from "@/shared/utils/css-vars";
import { useT } from "@/shared/i18n";
import { translate } from "@/shared/i18n/core";
import { feedback } from "@/shared/ui/feedback";
import {
  arrangeWindows,
  moveTabs,
  closeWindow,
  createTabGroup,
  snapWindow,
  type SplitLayout,
  type WindowSnapAction,
} from "@/chrome";
import { useMetadataStore, useSettingsStore, useTabsStore } from "@/store";
import { swBroadcast } from "@/shared/utils/sw-broadcast";
import { GroupCardShell } from "../components/GroupCardShell";
import { useCardCollapse } from "../hooks/useCardCollapse";
import { DraggableTab } from "./DraggableTab";
import { DroppableZone } from "./DroppableZone";
import { TabGroupSection } from "./TabGroupSection";
import styles from "../styles/views.module.less";

type GroupedTabs = Array<{
  groupId: number;
  tabs: LiveTab[];
}>;

interface WindowCardProps {
  windowId: number;
  tabs: LiveTab[];
  windowInfo?: WindowInfo;
  currentWindowId: number;
  initialCollapsed?: boolean;
  visibleTabIds: number[];
  onJump: (tabId: number, windowId: number) => void;
  onCloseTab: (tabId: number) => void;
  onRefresh: () => void;
}

const BATCH = 10;

function buildGroupedTabs(tabs: LiveTab[]): { groups: GroupedTabs; ungroupedTabs: LiveTab[] } {
  const groupMap = new Map<number, LiveTab[]>();
  const ungroupedTabs: LiveTab[] = [];

  for (const tab of tabs) {
    if (tab.groupId === -1) {
      ungroupedTabs.push(tab);
      continue;
    }
    const list = groupMap.get(tab.groupId) ?? [];
    list.push(tab);
    groupMap.set(tab.groupId, list);
  }

  return {
    groups: [...groupMap.entries()].map(([groupId, groupTabs]) => ({ groupId, tabs: groupTabs })),
    ungroupedTabs,
  };
}

function getWindowTitle(
  t: (key: string, values?: Record<string, string | number>) => string,
  windowId: number,
  isCurrent: boolean,
  alias?: string,
): string {
  if (alias && alias.trim().length > 0) return alias.trim();
  return isCurrent ? t("当前窗口") : t("窗口 {id}", { id: windowId });
}

export function WindowCard({
  windowId,
  tabs,
  windowInfo,
  currentWindowId,
  initialCollapsed = false,
  visibleTabIds,
  onJump,
  onCloseTab,
  onRefresh,
}: WindowCardProps) {
  const { t } = useT();
  const { token } = theme.useToken();
  const { collapsed, toggleCollapse } = useCardCollapse({ initialCollapsed });
  const alias = useMetadataStore((state) => state.windowAliases[windowId]);
  const setWindowAlias = useMetadataStore((state) => state.setWindowAlias);
  const showGroupSection = useSettingsStore(
    (state) => state.settings.windowCardShowGroupSection ?? true,
  );
  const showGhostDropZone = useSettingsStore(
    (state) => state.settings.windowCardShowGhostDropZone ?? true,
  );
  const accentBarPosition = useSettingsStore(
    (state) => state.settings.windowCardAccentBarPosition ?? "left",
  );
  const closeConfirmThreshold = useSettingsStore(
    (state) => state.settings.closeConfirmThreshold ?? 20,
  );
  const [aliasEditing, setAliasEditing] = useState(false);
  const [aliasDraft, setAliasDraft] = useState(alias ?? "");
  const [busy, setBusy] = useState(false);

  const isCurrent = windowId === currentWindowId;
  const isFocused = windowInfo?.focused ?? false;
  const isIncognito = windowInfo?.incognito ?? tabs.some((tab) => tab.incognito);
  const { groups, ungroupedTabs } = useMemo(() => buildGroupedTabs(tabs), [tabs]);
  const title = getWindowTitle(t, windowId, isCurrent, alias);
  const groupCount = groups.length;
  const splitViewCount = useMemo(
    () =>
      new Set(tabs.map((tab) => tab.splitViewId).filter((id) => id !== undefined && id >= 0)).size,
    [tabs],
  );

  const cardStyle = useMemo<React.CSSProperties>(
    () =>
      cssVars({
        "--app-domain-card-radius": `${token.borderRadiusLG}px`,
        "--app-domain-card-bar": isIncognito ? token.colorTextTertiary : token.colorPrimary,
        "--app-domain-card-badge-bg": isIncognito ? token.colorFillSecondary : token.colorPrimaryBg,
        "--app-domain-card-header-border": collapsed ? "transparent" : token.colorBorderSecondary,
        "--app-domain-card-chevron-color": token.colorTextTertiary,
        "--app-domain-card-title-color": token.colorText,
        "--app-row-hover-bg": token.colorFillSecondary,
        "--app-window-card-bg": isIncognito ? token.colorFillQuaternary : token.colorBgContainer,
        "--app-window-card-border": isFocused
          ? token.colorPrimaryBorder
          : token.colorBorderSecondary,
      }),
    [collapsed, isFocused, isIncognito, token],
  );

  const runWindowAction = async (action: () => Promise<void>, successMessage?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      if (successMessage) feedback.success(successMessage);
      onRefresh();
    } catch (err) {
      feedback.error(t("窗口操作失败，请重试"), err);
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const handleSaveAlias = () => {
    void setWindowAlias(windowId, aliasDraft);
    setAliasEditing(false);
  };

  const handleMergeToCurrent = () => {
    if (isCurrent) return;
    void runWindowAction(
      async () => {
        const tabIds = tabs.map((tab) => tab.id);
        for (let i = 0; i < tabIds.length; i += BATCH) {
          await moveTabs(tabIds.slice(i, i + BATCH), currentWindowId, -1);
        }
        swBroadcast("tab-moved", { windowId: currentWindowId, count: tabIds.length });
      },
      translate("已将 {count} 个标签合并到当前窗口", { count: tabs.length }),
    );
  };

  const handleCloseWindow = () => {
    const execute = () =>
      runWindowAction(async () => {
        await closeWindow(windowId);
        swBroadcast("tab-removed", { windowId, isWindowClosing: true });
      }, t("窗口已关闭"));

    if (tabs.length > closeConfirmThreshold) {
      Modal.confirm({
        title: t("关闭该窗口？"),
        content: t("此窗口包含 {count} 个标签，关闭后可在最近关闭中恢复。", { count: tabs.length }),
        okButtonProps: { danger: true },
        onOk: execute,
      });
      return;
    }

    void execute();
  };

  const handleCreateGroupFromUngrouped = () => {
    if (ungroupedTabs.length === 0) return;
    void runWindowAction(async () => {
      const group = await createTabGroup(
        ungroupedTabs.map((tab) => tab.id),
        { windowId },
        {
          title: t("新分组"),
          color: "blue",
        },
      );
      swBroadcast("tab-grouped", { groupId: group.id, windowId });
    }, t("已创建分组"));
  };

  /** 贴边/最大化/居中 —— 单窗口快捷动作。 */
  const handleSnap = (action: WindowSnapAction) => {
    void runWindowAction(async () => {
      await snapWindow(windowId, action);
    });
  };

  const handleArrangeAllWindows = (layout: SplitLayout) => {
    const windows = [
      windowId,
      ...[...useTabsStore.getState().windows.values()]
        .filter(
          (item) =>
            item.id !== windowId && item.type === "normal" && item.incognito === isIncognito,
        )
        .map((item) => item.id),
    ];
    void runWindowAction(async () => {
      await arrangeWindows(windows, layout);
    });
  };

  const menuItems: MenuProps["items"] = [
    {
      key: "alias",
      icon: <Edit3 size={ICON_SIZE.SMALL} />,
      label: t("重命名窗口"),
      onClick: () => {
        setAliasDraft(alias ?? "");
        setAliasEditing(true);
      },
    },
    {
      key: "merge",
      icon: <Merge size={ICON_SIZE.SMALL} />,
      label: t("合并到当前窗口"),
      disabled:
        isCurrent ||
        isIncognito !== (useTabsStore.getState().windows.get(currentWindowId)?.incognito ?? false),
      onClick: handleMergeToCurrent,
    },
    {
      key: "create-group",
      icon: <Plus size={ICON_SIZE.SMALL} />,
      label: t("将未分组标签创建为分组"),
      disabled: ungroupedTabs.length === 0,
      onClick: handleCreateGroupFromUngrouped,
    },
    {
      key: "snap",
      icon: <Columns2 size={ICON_SIZE.SMALL} />,
      label: t("窗口贴边"),
      children: [
        {
          key: "snap-left",
          label: t("贴左半屏"),
          onClick: () => handleSnap("snap-left"),
        },
        {
          key: "snap-right",
          label: t("贴右半屏"),
          onClick: () => handleSnap("snap-right"),
        },
        {
          key: "snap-top",
          label: t("贴上半屏"),
          onClick: () => handleSnap("snap-top"),
        },
        {
          key: "snap-bottom",
          label: t("贴下半屏"),
          onClick: () => handleSnap("snap-bottom"),
        },
        { type: "divider" },
        {
          key: "snap-center",
          label: t("居中 80%"),
          onClick: () => handleSnap("center"),
        },
        {
          key: "snap-restore",
          label: t("还原普通窗口"),
          onClick: () => handleSnap("restore"),
        },
        {
          key: "snap-maximize",
          label: t("最大化"),
          onClick: () => handleSnap("maximize"),
        },
      ],
    },
    {
      key: "arrange-all",
      icon: <Monitor size={ICON_SIZE.SMALL} />,
      label: t("排列所有窗口"),
      children: [
        {
          key: "arrange-balanced-grid",
          label: t("自适应网格"),
          onClick: () => handleArrangeAllWindows("balanced-grid"),
        },
        {
          key: "arrange-side-by-side",
          label: t("左右分栏"),
          onClick: () => handleArrangeAllWindows("side-by-side"),
        },
        {
          key: "arrange-stacked",
          label: t("上下堆叠"),
          onClick: () => handleArrangeAllWindows("stacked"),
        },
        {
          key: "arrange-main-side",
          label: t("主区 + 侧栏"),
          onClick: () => handleArrangeAllWindows("main-side"),
        },
      ],
    },
    { type: "divider" },
    {
      key: "close",
      danger: true,
      icon: <X size={ICON_SIZE.SMALL} />,
      label: t("关闭窗口"),
      disabled: isCurrent,
      onClick: handleCloseWindow,
    },
  ];

  return (
    <GroupCardShell
      style={cardStyle}
      accentBarPosition={accentBarPosition}
      collapsed={collapsed}
      collapsedSummary={
        <Typography.Text className={styles["app-window-card-summary"]}>
          {t("{count} 个标签 / {groups} 个分组", { count: tabs.length, groups: groupCount })}
        </Typography.Text>
      }
      header={
        <Flex
          align="center"
          justify="space-between"
          className={styles["app-window-card-header-layout"]}
        >
          <Button
            type="text"
            className={`app-row-hover ${styles["app-window-card-header"]}`}
            aria-expanded={!collapsed}
            onClick={toggleCollapse}
          >
            <ChevronDown
              className={`${styles["app-window-card-chevron"]}${collapsed ? ` ${styles["is-collapsed"]}` : ""}`}
              size={ICON_SIZE.TINY}
            />
            <Typography.Text className={styles["app-window-card-badge"]}>
              {isIncognito ? <Shield size={ICON_SIZE.SMALL} /> : <Monitor size={ICON_SIZE.SMALL} />}
            </Typography.Text>
            <Flex vertical className={styles["app-window-card-title-wrap"]}>
              {aliasEditing ? (
                <Input
                  size="small"
                  autoFocus
                  value={aliasDraft}
                  placeholder={t("输入窗口别名")}
                  onChange={(event) => setAliasDraft(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  onPressEnter={handleSaveAlias}
                  onBlur={handleSaveAlias}
                  className={styles["app-window-card-alias-input"]}
                />
              ) : (
                <Typography.Text className={styles["app-window-card-title"]}>
                  {title}
                </Typography.Text>
              )}
              <Typography.Text className={styles["app-window-card-meta"]}>
                {t("{count} 个标签 / {groups} 个分组", { count: tabs.length, groups: groupCount })}
              </Typography.Text>
            </Flex>
            {isCurrent && (
              <Tag color="blue" className={styles["app-window-card-tag"]}>
                {t("当前窗口")}
              </Tag>
            )}
            {isFocused && (
              <Tag color="green" className={styles["app-window-card-tag"]}>
                {t("活跃")}
              </Tag>
            )}
            {splitViewCount > 0 && (
              <Tag color="purple" className={styles["app-window-card-tag"]}>
                {t("Split View {count}", { count: splitViewCount })}
              </Tag>
            )}
            {isIncognito && (
              <Tag
                className={styles["app-window-card-tag"]}
                icon={<EyeOff size={ICON_SIZE.MICRO} />}
              >
                {t("隐身")}
              </Tag>
            )}
          </Button>
          <Dropdown menu={{ items: menuItems }} trigger={["click"]} placement="bottomRight">
            <Tooltip title={t("更多")}>
              <Button
                type="text"
                size="small"
                loading={busy}
                icon={busy ? undefined : <MoreHorizontal size={ICON_SIZE.SMALL} />}
                aria-label={t("更多")}
                className={styles["app-window-card-action"]}
              />
            </Tooltip>
          </Dropdown>
        </Flex>
      }
      ghostDropZone={
        showGhostDropZone ? (
          <Button
            type="text"
            className={styles["app-window-ghost-dropzone"]}
            onClick={handleCreateGroupFromUngrouped}
            disabled={ungroupedTabs.length === 0}
          >
            <Plus size={ICON_SIZE.SMALL} />
            {ungroupedTabs.length > 0 ? t("将未分组标签创建为分组") : t("拖到此处")}
          </Button>
        ) : undefined
      }
    >
      {!collapsed && (
        <DroppableZone
          id={`window-card:${windowId}`}
          data={{ kind: "window", windowId, incognito: isIncognito }}
          className={styles["app-window-card-body"]}
        >
          {showGroupSection &&
            groups.map((group) => (
              <TabGroupSection
                key={group.groupId}
                groupId={group.groupId}
                tabs={group.tabs}
                visibleTabIds={visibleTabIds}
                onJump={onJump}
                onClose={onCloseTab}
                onRefresh={onRefresh}
              />
            ))}

          {ungroupedTabs.length > 0 && (
            <DroppableZone
              id={`window-ungrouped:${windowId}`}
              data={{ kind: "ungrouped", windowId, incognito: isIncognito }}
              className={styles["app-window-ungrouped-section"]}
            >
              <Flex className={styles["app-window-ungrouped-header"]}>
                <Layers size={ICON_SIZE.SMALL} />
                <Typography.Text>{t("未分组标签")}</Typography.Text>
                <Tag className={styles["app-window-group-count"]}>{ungroupedTabs.length}</Tag>
              </Flex>
              <List className={styles["app-window-group-list"]}>
                {ungroupedTabs.map((tab) => (
                  <DraggableTab
                    key={tab.id}
                    tab={tab}
                    onJump={onJump}
                    onClose={onCloseTab}
                    visibleTabIds={visibleTabIds}
                  />
                ))}
              </List>
            </DroppableZone>
          )}
        </DroppableZone>
      )}
    </GroupCardShell>
  );
}
