/**
 * WindowCard — 窗口卡片
 *
 * 使用 GroupCardShell 作为卡片骨架，视觉与其他视图对齐：
 *   - 左侧/顶部身份色条
 *   - 头部：窗口图标 + 标题（支持别名编辑）+ 标签 + 更多操作
 *   - 内容区：TabGroupSection + 未分组标签
 *   - Ghost Drop Zone：快速创建分组
 */

import { useMemo, memo, useState, useEffect } from "react";
import {
  Button,
  Dropdown,
  Input,
  Popover,
  Space,
  Tag,
  Tooltip,
  Typography,
  Flex,
  List,
  theme,
} from "antd";
import {
  EyeOff,
  Heart,
  Layers,
  Maximize2,
  Merge,
  Monitor,
  MoreHorizontal,
  PanelLeft,
  PanelRight,
  Palette,
  Plus,
  Shield,
} from "lucide-react";

import type { LiveTab, WindowInfo } from "@/shared/types";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import { useSettingsStore, useMetadataStore } from "@/store";
import { GroupCardShell } from "@/features/tabs/components/GroupCardShell";
import { useWindowActions } from "@/features/tabs/hooks/useWindowActions";
import { DraggableTab } from "./DraggableTab";
import { DroppableZone } from "./DroppableZone";
import { TabGroupSection } from "./TabGroupSection";

/** 窗口颜色色板（8 色，与 Chrome TabGroup ColorEnum 单源对齐）
 * 顺序：grey → blue → red → yellow → green → pink → purple → cyan
 * 对应 Chrome tabGroups.ColorEnum，用户心智模型从 16 色降至 8 色。
 */
const WINDOW_COLOR_PALETTE = [
  "#9aa0a6", // grey  (原 orange，改为 Chrome 第一色)
  "#4285f4", // blue  (微调以更接近 Chrome 标准)
  "#ea4335", // red   (对齐 Chrome)
  "#fbbc04", // yellow (原 amber，明确为 yellow)
  "#34a853", // green  (对齐 Chrome)
  "#ff63ed", // pink   (对齐 Chrome)
  "#9334e6", // purple (原 violet，明确为 purple)
  "#00b4d8", // cyan   (对齐 Chrome)
];

import styles from "@/features/tabs/styles/views.module.less";

type GroupedTabs = Array<{
  groupId: number;
  tabs: LiveTab[];
}>;

interface WindowCardProps {
  windowId: number;
  tabs: LiveTab[];
  windowInfo?: WindowInfo;
  currentWindowId: number;
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

export const WindowCard = memo(function WindowCard({
  windowId,
  tabs,
  windowInfo,
  currentWindowId,
  visibleTabIds,
  onJump,
  onCloseTab,
  onRefresh,
}: WindowCardProps) {
  const { t } = useT();
  const { token } = theme.useToken();
  const showGroupSection = useSettingsStore(
    (state) => state.settings.windowCardShowGroupSection ?? true,
  );
  const showGhostDropZone = useSettingsStore(
    (state) => state.settings.windowCardShowGhostDropZone ?? true,
  );
  const accentBarPosition = useSettingsStore(
    (state) => state.settings.windowCardAccentBarPosition ?? "left",
  );
  const windowColor = useMetadataStore((s) => s.windowColors[windowId]);
  const setWindowColor = useMetadataStore((s) => s.setWindowColor);
  const showIdleTime = useSettingsStore((s) => s.settings.windowShowIdleTime ?? true);
  const showHealthIndicator = useSettingsStore((s) => s.settings.windowShowHealthIndicator ?? true);

  const isCurrent = windowId === currentWindowId;
  const isFocused = windowInfo?.focused ?? false;
  const isIncognito = windowInfo?.incognito ?? tabs.some((tab) => tab.incognito);

  // 响应式处理：<480px 时折叠部分操作按钮
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const checkWidth = () => {
      setIsNarrow(window.innerWidth < 480);
    };
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

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
    handleMergeToCurrent,
    handleSnap,
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

  // ── 健康度计算 ──
  const healthScore = useMemo(() => {
    if (!showHealthIndicator) return null;
    const now = Date.now();
    const idleTabs = tabs.filter((tab) => now - tab.lastAccessed > 86400000).length; // >24h
    const discardedTabs = tabs.filter((tab) => tab.discarded).length;
    const idleRate = tabs.length > 0 ? idleTabs / tabs.length : 0;
    const discardRate = tabs.length > 0 ? discardedTabs / tabs.length : 0;
    const tabCountScore = Math.min(tabs.length / 30, 1); // 30 tabs = max score
    return tabCountScore * 0.3 + idleRate * 0.4 + discardRate * 0.3;
  }, [tabs, showHealthIndicator]);

  const healthLevel =
    healthScore !== null
      ? healthScore < 0.3
        ? "good"
        : healthScore < 0.6
          ? "warning"
          : "danger"
      : null;

  const cardBarColor = useMemo(
    () => windowColor ?? (isIncognito ? token.colorTextTertiary : token.colorPrimary),
    [isIncognito, token, windowColor],
  );
  const cardBadgeBg = useMemo(
    () =>
      windowColor
        ? `color-mix(in srgb, ${windowColor} 12%, transparent)`
        : isIncognito
          ? token.colorFillSecondary
          : token.colorPrimaryBg,
    [isIncognito, token, windowColor],
  );

  return (
    <GroupCardShell
      accentBarPosition={accentBarPosition}
      interactive={false}
      barColor={cardBarColor}
      badgeBg={cardBadgeBg}
      extraStyle={{
        "--app-window-card-bg": isIncognito ? token.colorFillQuaternary : token.colorBgContainer,
        "--app-window-card-border": isFocused
          ? (windowColor ?? token.colorPrimaryBorder)
          : token.colorBorderSecondary,
        "--app-window-card-header-tint": windowColor
          ? `color-mix(in srgb, ${windowColor} 4%, transparent)`
          : "transparent",
      } as React.CSSProperties}
      header={
        <>
          <div className={styles["app-window-card-header"]}>
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
          </div>

          {/* 中间：Tags（静态指示器，不触发 hover 背景） */}
          <Flex align="center" gap={6} className={styles["app-window-card-tags"]}>
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
            {healthLevel && (
              <Tooltip title={t("窗口健康度")}>
                <Heart
                  size={ICON_SIZE.MICRO}
                  className={`${styles["app-window-card-health"]} ${styles[`is-${healthLevel}`]}`}
                />
              </Tooltip>
            )}
          </Flex>

          {/* 右侧：操作按钮组 */}
          <Flex align="center" gap={2} className={styles["app-window-card-actions"]}>
            {/* 宽屏显示全部按钮，窄屏（<480px）只显示最常用按钮，其余收进「更多」菜单 */}
            {!isNarrow && (
              <>
                <Tooltip title={t("贴左半屏")}>
                  <Button
                    type="text"
                    size="small"
                    icon={<PanelLeft size={ICON_SIZE.SMALL} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSnap("snap-left");
                    }}
                    aria-label={t("贴左半屏")}
                    className={styles["app-window-card-quick-btn"]}
                  />
                </Tooltip>
                <Tooltip title={t("贴右半屏")}>
                  <Button
                    type="text"
                    size="small"
                    icon={<PanelRight size={ICON_SIZE.SMALL} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSnap("snap-right");
                    }}
                    aria-label={t("贴右半屏")}
                    className={styles["app-window-card-quick-btn"]}
                  />
                </Tooltip>
              </>
            )}
            <Tooltip title={t("最大化")}>
              <Button
                type="text"
                size="small"
                icon={<Maximize2 size={ICON_SIZE.SMALL} />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSnap("maximize");
                }}
                aria-label={t("最大化")}
                className={styles["app-window-card-quick-btn"]}
              />
            </Tooltip>
            {!isCurrent && (
              <Tooltip title={t("window.mergeAll")}>
                <Button
                  type="text"
                  size="small"
                  icon={<Merge size={ICON_SIZE.SMALL} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMergeToCurrent();
                  }}
                  aria-label={t("window.mergeAll")}
                  className={styles["app-window-card-quick-btn"]}
                />
              </Tooltip>
            )}
            <Popover
              trigger="click"
              placement="bottomRight"
              content={
                <Space wrap className={styles["app-window-card-color-grid"]}>
                  {WINDOW_COLOR_PALETTE.map((color) => (
                    <Button
                      key={color}
                      type="text"
                      className={`${styles["app-window-card-color-swatch"]} ${color === windowColor ? styles["is-active"] : ""}`}
                      style={{ background: color }}
                      aria-label={color}
                      onClick={() =>
                        void setWindowColor(windowId, color === windowColor ? "" : color)
                      }
                    />
                  ))}
                </Space>
              }
            >
              <Tooltip title={t("窗口颜色")}>
                <Button
                  type="text"
                  size="small"
                  icon={<Palette size={ICON_SIZE.SMALL} />}
                  className={styles["app-window-card-quick-btn"]}
                />
              </Tooltip>
            </Popover>
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
              : t("拖入标签创建分组")}
          </Button>
        ) : undefined
      }
    >
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
              showIdleTime={showIdleTime}
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
                  showIdleTime={showIdleTime}
                />
              ))}
            </List>
          </DroppableZone>
        )}
      </DroppableZone>
    </GroupCardShell>
  );
});
