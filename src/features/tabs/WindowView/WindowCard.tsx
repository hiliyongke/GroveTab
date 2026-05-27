/**
 * WindowCard — 窗口卡片
 *
 * 使用 GroupCardShell 作为卡片骨架，视觉与其他视图对齐：
 *   - 左侧/顶部身份色条
 *   - 头部：窗口图标 + 标题（支持别名编辑）+ 标签 + 更多操作
 *   - 内容区：TabGroupSection + 未分组标签
 *   - Ghost Drop Zone：快速创建分组
 */

import { useMemo } from "react";
import { Button, Dropdown, Input, Tag, Tooltip, Typography, Flex, List, theme } from "antd";
import { ChevronDown, EyeOff, Layers, Monitor, MoreHorizontal, Plus, Shield } from "lucide-react";

import type { LiveTab, WindowInfo } from "@/shared/types";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { cssVars } from "@/shared/utils/css-vars";
import { useT } from "@/shared/i18n";
import { useSettingsStore } from "@/store";
import { GroupCardShell } from "../components/GroupCardShell";
import { useCardCollapse } from "../hooks/useCardCollapse";
import { useWindowActions } from "../hooks/useWindowActions";
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
  const showGroupSection = useSettingsStore(
    (state) => state.settings.windowCardShowGroupSection ?? true,
  );
  const showGhostDropZone = useSettingsStore(
    (state) => state.settings.windowCardShowGhostDropZone ?? true,
  );
  const accentBarPosition = useSettingsStore(
    (state) => state.settings.windowCardAccentBarPosition ?? "left",
  );

  const isCurrent = windowId === currentWindowId;
  const isFocused = windowInfo?.focused ?? false;
  const isIncognito = windowInfo?.incognito ?? tabs.some((tab) => tab.incognito);
  const { groups, ungroupedTabs } = useMemo(() => buildGroupedTabs(tabs), [tabs]);
  const groupCount = groups.length;
  const splitViewCount = useMemo(
    () =>
      new Set(tabs.map((tab) => tab.splitViewId).filter((id) => id !== undefined && id >= 0)).size,
    [tabs],
  );

  const {
    alias,
    aliasEditing,
    aliasDraft,
    setAliasDraft,
    busy,
    handleSaveAlias,
    menuItems,
    handleCreateGroupFromUngrouped,
  } = useWindowActions({
    windowId,
    tabs,
    isCurrent,
    isIncognito,
    ungroupedTabs,
    onRefresh,
  });

  const title = getWindowTitle(t, windowId, isCurrent, alias);

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

  return (
    <GroupCardShell
      style={cardStyle}
      accentBarPosition={accentBarPosition}
      collapsed={collapsed}
      collapsedSummary={
        <Typography.Text className={styles["app-window-card-summary"]}>
          {t("window.summary", { count: tabs.length, groups: groupCount })}
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
                  placeholder={t("window.aliasPlaceholder")}
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
                {t("window.summary", { count: tabs.length, groups: groupCount })}
              </Typography.Text>
            </Flex>
            {isCurrent && (
              <Tag color="blue" className={styles["app-window-card-tag"]}>
                {t("window.current")}
              </Tag>
            )}
            {isFocused && !isCurrent && (
              <Tag color="green" className={styles["app-window-card-tag"]}>
                {t("window.focused")}
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
                {t("window.incognito")}
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
              <Flex className={styles["app-window-ungrouped-header"]}>
                <Layers size={ICON_SIZE.SMALL} />
                <Typography.Text>{t("windowGroup.ungroupedTabs")}</Typography.Text>
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
