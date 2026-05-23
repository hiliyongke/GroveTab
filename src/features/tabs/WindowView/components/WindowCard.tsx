/**
 * WindowCard — 窗口卡片组件
 *
 * 显示单个窗口的信息，包括：
 * - 窗口标题栏（可折叠/展开）
 * - 缩略图预览（悬停时）
 * - 标签列表（按分组展示）
 * - 分组拖入区域
 * - 智能排序按钮
 * - 关闭窗口按钮
 */

import { useState, useMemo, useCallback, useRef, memo } from "react";
import { Card, Tag, Button, Tooltip, Dropdown } from "antd";
import { ChevronDown, X, Monitor, FolderPlus, ArrowUpDown } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useTabsStore } from "@/store";
import { feedback } from "@/shared/ui/feedback";
import { translate } from "@/shared/i18n/core";
import { cssVars } from "@/shared/utils/css-vars";
import { track as trackEvent } from "@/shared/utils/metrics";
import {
  closeWindowTabs,
  reorderTabs,
  sortTabsByRule,
} from "@/features/tabs/services/window-tab-operations";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { DragData, WindowCardProps, SmartSortRule } from "../types";
import { SortableTabItem } from "./SortableTabItem";
import { GroupLabel } from "./GroupLabel";
import styles from "../WindowView.module.less";
import type { LiveTab } from "@/shared/types/tab";

/**
 * 获取排序规则对应的 i18n 名称
 *
 * 将排序规则枚举转换为用户可读的本地化名称。
 *
 * @param rule - 智能排序规则
 * @param t - 国际化翻译函数
 * @returns 排序规则的本地化名称
 */
function getSortRuleName(rule: SmartSortRule, t: (key: string) => string): string {
  switch (rule) {
    case "domain":
      return t("window.smartSortByDomain");
    case "recentAccess":
      return t("window.smartSortByRecentAccess");
    case "alphabetical":
      return t("window.smartSortByAlphabetical");
    case "type":
      return t("window.smartSortByType");
  }
}

/**
 * 窗口卡片组件
 *
 * 显示单个窗口的信息，包括：
 * - 窗口标题栏（可折叠/展开）
 * - 缩略图预览（悬停时）
 * - 标签列表（按分组展示）
 * - 分组拖入区域
 * - 智能排序按钮
 * - 关闭窗口按钮
 *
 * @param props - 组件属性
 * @param props.windowId - 窗口 ID
 * @param props.windowTabs - 窗口中的标签页列表
 * @param props.windowInfo - 窗口信息（可选）
 * @param props.isCurrent - 是否为当前窗口
 * @param props.allTabIds - 所有标签 ID 列表
 * @param props.jumpToTab - 跳转标签回调
 * @param props.closeSingleTab - 关闭单个标签回调
 * @param props.activeDrag - 当前拖拽状态
 * @param props.t - 国际化翻译函数
 * @param props.token - antd 主题 token
 * @param props.reduced - 是否简化显示
 * @param props.altHeld - Alt 键是否按住
 * @param props.onThumbnailHover - 缩略图悬停回调
 * @param props.onThumbnailLeave - 缩略图离开回调
 * @param props.thumbnailUrl - 缩略图 URL
 * @returns 窗口卡片 JSX 元素
 */
const WindowCard = memo(function WindowCard({
  windowId,
  windowTabs,
  windowInfo,
  isCurrent,
  allTabIds,
  jumpToTab,
  closeSingleTab,
  activeDrag,
  t,
  token,
  reduced,
  altHeld: _altHeld,
  onThumbnailHover,
  onThumbnailLeave,
  thumbnailUrl,
}: WindowCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [closing, setClosing] = useState(false);
  const thumbnailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 窗口卡片作为跨窗口拖拽的 drop zone
  const { setNodeRef: setDropZoneRef, isOver } = useDroppable({
    id: `window-drop-zone::${windowId}`,
    data: { kind: "window-drop-zone", windowId } satisfies DragData,
  });

  // 分组区域作为拖入分组的 drop zone
  const { setNodeRef: setGroupZoneRef, isOver: isGroupZoneOver } = useDroppable({
    id: `group-zone::${windowId}`,
    data: { kind: "group-zone", windowId } satisfies DragData,
  });

  const isFocused = windowInfo?.focused ?? false;

  /** 按分组 ID 将窗口内标签分组（用于显示分组标题） */
  const tabGroups = useMemo(() => {
    const map = new Map<
      number,
      { groupId: number; groupTitle?: string; groupColor?: string; tabs: LiveTab[] }
    >();
    for (const tab of windowTabs) {
      const gid = tab.groupId ?? -1;
      if (!map.has(gid)) {
        map.set(gid, {
          groupId: gid,
          groupTitle: gid === -1 ? undefined : tab.groupTitle,
          groupColor: gid === -1 ? undefined : tab.groupColor,
          tabs: [] as LiveTab[],
        });
      }
      map.get(gid)!.tabs.push(tab);
    }
    // 未分组排最后
    const result = Array.from(map.values());
    const ungrouped = result.find((g) => g.groupId === -1);
    const grouped = result.filter((g) => g.groupId !== -1);
    return [...grouped, ...(ungrouped ? [ungrouped] : [])];
  }, [windowTabs]);

  /** 关闭整个窗口（关闭该窗口所有标签） */
  const handleCloseWindow = useCallback(
    async (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      if (closing) return;
      setClosing(true);
      try {
        const count = await closeWindowTabs(windowTabs);
        feedback.success(translate("window.closedWindow", { count }));
        void useTabsStore.getState().loadAllTabs({ silent: true });
      } catch (err) {
        feedback.error(translate("window.closeFailed"), err);
      } finally {
        setClosing(false);
      }
    },
    [closing, windowTabs],
  );

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  /** 一键智能排序：按选定规则对当前窗口标签进行排序并同步到浏览器 */
  const handleSmartSort = useCallback(
    async (rule: SmartSortRule) => {
      try {
        const sortedIds = sortTabsByRule(windowTabs, rule);
        if (sortedIds.length === 0) return;

        await reorderTabs(sortedIds);

        feedback.success(
          t("window.smartSortSuccess", {
            rule: getSortRuleName(rule, t),
            count: String(sortedIds.length),
          }),
        );
        void trackEvent("smart_sort", { rule, windowId, count: sortedIds.length });
        void useTabsStore.getState().loadAllTabs({ silent: true });
      } catch (err) {
        feedback.error(t("window.moveFailed"));
        console.warn("[WindowView] smart sort failed", err);
        void useTabsStore.getState().loadAllTabs({ silent: true });
      }
    },
    [windowTabs, windowId, t],
  );

  /** 缩略图悬停逻辑 */
  const handleHeaderMouseEnter = useCallback(() => {
    if (thumbnailTimerRef.current) clearTimeout(thumbnailTimerRef.current);
    thumbnailTimerRef.current = setTimeout(() => {
      onThumbnailHover(windowId);
    }, 500); // 延迟 500ms 触发缩略图
  }, [windowId, onThumbnailHover]);

  const handleHeaderMouseLeave = useCallback(() => {
    if (thumbnailTimerRef.current) {
      clearTimeout(thumbnailTimerRef.current);
      thumbnailTimerRef.current = null;
    }
    onThumbnailLeave();
  }, [onThumbnailLeave]);

  /** 稳定跳转回调 —— 避免内联函数导致子组件重渲染 */
  const handleJump = useCallback(
    (id: number, wid: number) => {
      void jumpToTab(id, wid);
    },
    [jumpToTab],
  );

  /** 稳定关闭回调 —— 避免内联函数导致子组件重渲染 */
  const handleClose = useCallback(
    (id: number) => {
      void closeSingleTab(id);
    },
    [closeSingleTab],
  );

  const cardStyle = useMemo<React.CSSProperties>(
    () => ({
      overflow: "hidden",
      position: "relative",
      boxShadow: "var(--app-shadow-card)",
      border: `1px solid ${token.colorBorderSecondary}`,
      ...cssVars({
        "--app-hover-border": token.colorBorder,
        "--app-window-card-header-border": collapsed ? "transparent" : token.colorBorderSecondary,
        "--app-row-hover-bg": token.colorFillSecondary,
      }),
    }),
    [collapsed, token],
  );

  /** 当前是否正处于跨窗口拖拽中（标签来自其他窗口拖到此窗口卡片上） */
  const isCrossWindowDragTarget =
    isOver && activeDrag?.data.kind === "tab" && activeDrag.data.windowId !== windowId;

  return (
    <Card
      ref={setDropZoneRef}
      size="small"
      className={`${styles["app-window-card"]} ${isCrossWindowDragTarget ? styles["is-drag-over"] : ""}`}
      classNames={{ body: styles["app-window-card__body"] }}
      style={cardStyle}
    >
      {/* 窗口身份色条 —— 当前窗口用主色，其他窗口用中性色 */}
      <div
        aria-hidden
        className={`${styles["app-accent-bar--left"]} ${isCurrent ? styles["is-primary"] : ""}`}
      />

      {/* 头部：可点击折叠 + 缩略图预览 */}
      <button
        type="button"
        onClick={toggleCollapse}
        onMouseEnter={handleHeaderMouseEnter}
        onMouseLeave={handleHeaderMouseLeave}
        aria-expanded={!collapsed}
        aria-label={collapsed ? t("tabs.expand") : t("tabs.collapse")}
        className={`app-row-hover ${styles["app-window-card-header"]}`}
      >
        <ChevronDown
          size={ICON_SIZE.TINY}
          className={`${styles["app-window-card-chevron"]}${collapsed ? ` ${styles["is-collapsed"]}` : ""}`}
        />
        <div className={styles["app-window-card-badge"]}>
          <Monitor size={ICON_SIZE.SMALL} className={styles["app-window-card-badge-icon"]} />
        </div>
        <span className={styles["app-window-card-title"]}>
          {isCurrent ? t("window.current") : t("window.other")}
        </span>
        {isFocused && (
          <Tag color="green" className={styles["app-window-card-focused-tag"]}>
            {t("window.focused")}
          </Tag>
        )}
        <Tag className={styles["app-window-card-count"]}>{windowTabs.length}</Tag>
      </button>

      {/* 缩略图预览浮层 */}
      {thumbnailUrl && (
        <div className={styles["app-window-thumbnail"]}>
          <img src={thumbnailUrl} alt="" className={styles["app-window-thumbnail-img"]} />
        </div>
      )}

      {/* 关闭整个窗口 */}
      <Tooltip title={t("window.closeWindow")}>
        <Button
          type="text"
          size="small"
          danger
          loading={closing}
          disabled={closing}
          icon={closing ? undefined : <X size={ICON_SIZE.SMALL} />}
          onClick={(e: React.MouseEvent) => {
            void handleCloseWindow(e);
          }}
          className={`app-hover-reveal ${styles["app-window-card-action"]} ${styles["app-window-card-action--close"]}${closing ? ` ${styles["is-visible"]}` : ""}`}
        />
      </Tooltip>

      {/* 智能排序 */}
      <Dropdown
        trigger={["click"]}
        menu={{
          items: (
            [
              {
                key: "domain",
                label: t("window.smartSortByDomain"),
                description: t("window.smartSortByDomainDesc"),
                icon: <span>🌐</span>,
              },
              {
                key: "recentAccess",
                label: t("window.smartSortByRecentAccess"),
                description: t("window.smartSortByRecentAccessDesc"),
                icon: <span>⏱</span>,
              },
              {
                key: "alphabetical",
                label: t("window.smartSortByAlphabetical"),
                description: t("window.smartSortByAlphabeticalDesc"),
                icon: <span>🔤</span>,
              },
              {
                key: "type",
                label: t("window.smartSortByType"),
                description: t("window.smartSortByTypeDesc"),
                icon: <span>📑</span>,
              },
            ] as const
          ).map((item) => ({
            key: item.key,
            label: item.label,
            icon: item.icon,
          })),
          onClick: ({ key }) => {
            void handleSmartSort(key as SmartSortRule);
          },
        }}
      >
        <Tooltip title={t("window.smartSort")}>
          <Button
            type="text"
            size="small"
            icon={<ArrowUpDown size={ICON_SIZE.SMALL} />}
            className={`app-hover-reveal ${styles["app-window-card-action"]} ${styles["app-window-card-sort-btn"]}`}
          />
        </Tooltip>
      </Dropdown>

      {/* 标签列表 —— 按分组展示 */}
      {!collapsed && (
        <div className={styles["app-window-card-list"]}>
          {tabGroups.map((group) => (
            <div key={group.groupId} className={styles["app-window-card-group"]}>
              {/* 分组标题行（仅非"未分组"时显示） */}
              {group.groupId !== -1 && (
                <GroupLabel
                  groupId={group.groupId}
                  groupTitle={group.groupTitle}
                  groupColor={group.groupColor}
                  windowId={windowId}
                  tabs={group.tabs}
                  t={t}
                />
              )}

              {/* 分组内的标签列表 */}
              <SortableContext
                items={group.tabs.map((tab) => `tab::${windowId}::${tab.id}`)}
                strategy={verticalListSortingStrategy}
              >
                {group.tabs.map((tab) => (
                  <SortableTabItem
                    key={`tab::${windowId}::${tab.id}`}
                    tab={tab}
                    windowId={windowId}
                    onJump={handleJump}
                    onClose={handleClose}
                    showHostname
                    selectable
                    visibleTabIds={allTabIds}
                    reduced={reduced}
                  />
                ))}
              </SortableContext>
            </div>
          ))}

          {/* 新建分组区域 —— 拖入标签自动 chrome.tabs.group */}
          <div
            ref={setGroupZoneRef}
            className={`${styles["app-window-card-group-zone"]} ${isGroupZoneOver ? styles["is-drag-over"] : ""}`}
          >
            <FolderPlus size={ICON_SIZE.SMALL} />
            <span>{t("window.groupTabs")}</span>
          </div>
        </div>
      )}
    </Card>
  );
});

export { WindowCard, type SmartSortRule };
