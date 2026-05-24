import { useMemo, useState } from "react";
import { Button, Dropdown, Input, Modal, Tag, Tooltip, theme } from "antd";
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
import { moveTabs, closeWindow, createTabGroup, snapWindow, type WindowSnapAction } from "@/chrome";
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
  return isCurrent ? t("window.current") : t("window.otherWithId", { id: windowId });
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
      feedback.error(t("window.actionFailed"), err);
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
      translate("window.mergedAll", { count: tabs.length }),
    );
  };

  const handleCloseWindow = () => {
    const execute = () =>
      runWindowAction(async () => {
        await closeWindow(windowId);
        swBroadcast("tab-removed", { windowId, isWindowClosing: true });
      }, t("window.closed"));

    if (tabs.length > closeConfirmThreshold) {
      Modal.confirm({
        title: t("window.closeConfirmTitle"),
        content: t("window.closeConfirmContent", { count: tabs.length }),
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
          title: t("windowGroup.newGroup"),
          color: "blue",
        },
      );
      swBroadcast("tab-grouped", { groupId: group.id, windowId });
    }, t("windowGroup.created"));
  };

  /** 贴边/最大化/居中 —— 单窗口快捷动作。 */
  const handleSnap = (action: WindowSnapAction) => {
    void runWindowAction(async () => {
      await snapWindow(windowId, action);
    });
  };

  const menuItems: MenuProps["items"] = [
    {
      key: "alias",
      icon: <Edit3 size={ICON_SIZE.SMALL} />,
      label: t("window.rename"),
      onClick: () => {
        setAliasDraft(alias ?? "");
        setAliasEditing(true);
      },
    },
    {
      key: "merge",
      icon: <Merge size={ICON_SIZE.SMALL} />,
      label: t("window.mergeToCurrent"),
      disabled:
        isCurrent ||
        isIncognito !== (useTabsStore.getState().windows.get(currentWindowId)?.incognito ?? false),
      onClick: handleMergeToCurrent,
    },
    {
      key: "create-group",
      icon: <Plus size={ICON_SIZE.SMALL} />,
      label: t("windowGroup.createFromUngrouped"),
      disabled: ungroupedTabs.length === 0,
      onClick: handleCreateGroupFromUngrouped,
    },
    {
      key: "snap",
      icon: <Columns2 size={ICON_SIZE.SMALL} />,
      label: t("split.snapMenu"),
      children: [
        {
          key: "snap-left",
          label: t("split.snapLeft"),
          onClick: () => handleSnap("snap-left"),
        },
        {
          key: "snap-right",
          label: t("split.snapRight"),
          onClick: () => handleSnap("snap-right"),
        },
        {
          key: "snap-top",
          label: t("split.snapTop"),
          onClick: () => handleSnap("snap-top"),
        },
        {
          key: "snap-bottom",
          label: t("split.snapBottom"),
          onClick: () => handleSnap("snap-bottom"),
        },
        { type: "divider" },
        {
          key: "snap-center",
          label: t("split.snapCenter"),
          onClick: () => handleSnap("center"),
        },
        {
          key: "snap-maximize",
          label: t("split.snapMaximize"),
          onClick: () => handleSnap("maximize"),
        },
      ],
    },
    { type: "divider" },
    {
      key: "close",
      danger: true,
      icon: <X size={ICON_SIZE.SMALL} />,
      label: t("window.close"),
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
        <div className={styles["app-window-card-summary"]}>
          {t("window.summary", { count: tabs.length, groups: groupCount })}
        </div>
      }
      header={
        <>
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
            <span className={styles["app-window-card-badge"]}>
              {isIncognito ? <Shield size={ICON_SIZE.SMALL} /> : <Monitor size={ICON_SIZE.SMALL} />}
            </span>
            <span className={styles["app-window-card-title-wrap"]}>
              {aliasEditing ? (
                <Input
                  size="small"
                  autoFocus
                  value={aliasDraft}
                  placeholder={t("window.aliasPlaceholder")}
                  onChange={(event) => setAliasDraft(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  onPressEnter={handleSaveAlias}
                  onBlur={handleSaveAlias}
                  className={styles["app-window-card-alias-input"]}
                />
              ) : (
                <span className={styles["app-window-card-title"]}>{title}</span>
              )}
              <span className={styles["app-window-card-meta"]}>
                {t("window.summary", { count: tabs.length, groups: groupCount })}
              </span>
            </span>
            {isCurrent && (
              <Tag color="blue" className={styles["app-window-card-tag"]}>
                {t("window.current")}
              </Tag>
            )}
            {isFocused && (
              <Tag color="green" className={styles["app-window-card-tag"]}>
                {t("window.focused")}
              </Tag>
            )}
            {isIncognito && (
              <Tag
                className={styles["app-window-card-tag"]}
                icon={<EyeOff size={ICON_SIZE.MICRO} />}
              >
                {t("window.incognito")}
              </Tag>
            )}
          </Button>
          <Dropdown menu={{ items: menuItems }} trigger={["click"]} placement="bottomRight">
            <Tooltip title={t("common.more")}>
              <Button
                type="text"
                size="small"
                loading={busy}
                icon={busy ? undefined : <MoreHorizontal size={ICON_SIZE.SMALL} />}
                aria-label={t("common.more")}
                className={styles["app-window-card-action"]}
              />
            </Tooltip>
          </Dropdown>
        </>
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
            {ungroupedTabs.length > 0
              ? t("windowGroup.createFromUngrouped")
              : t("windowDrag.dropHere")}
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
              <div className={styles["app-window-ungrouped-header"]}>
                <Layers size={ICON_SIZE.SMALL} />
                <span>{t("windowGroup.ungroupedTabs")}</span>
                <Tag className={styles["app-window-group-count"]}>{ungroupedTabs.length}</Tag>
              </div>
              <div className={styles["app-window-group-list"]}>
                {ungroupedTabs.map((tab) => (
                  <DraggableTab
                    key={tab.id}
                    tab={tab}
                    onJump={onJump}
                    onClose={onCloseTab}
                    visibleTabIds={visibleTabIds}
                  />
                ))}
              </div>
            </DroppableZone>
          )}
        </DroppableZone>
      )}
    </GroupCardShell>
  );
}
