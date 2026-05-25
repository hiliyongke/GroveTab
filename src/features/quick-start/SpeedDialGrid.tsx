/**
 * SpeedDialGrid — 常用站点网格（主组件）
 *
 * 职责：
 *   - 组装 useSpeedDialSortable / useSiteGroups hooks
 *   - 渲染 DndContext + SortableContext
 *   - 渲染空状态 / 分组网格 / 新增按钮
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, Button, Typography } from "antd";
import { Plus, ChevronDown, ChevronRight } from "lucide-react";
import { cssVars } from "@/shared/utils/css-vars";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { useSpeedDialStore, useSettingsStore } from "@/store";
import { useT } from "@/shared/i18n";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import type { SpeedDialSite } from "@/shared/types";
import styles from "./QuickStartLayer.module.less";
import { SpeedDialAddModal } from "./SpeedDialAddModal";
import { SortableSiteCard } from "./SortableSiteCard";
import { useSpeedDialSortable } from "./hooks/useSpeedDialSortable";
import { useSiteGroups } from "./hooks/useSiteGroups";
import { useAccent } from "@/shared/hooks/use-accent";
import { getHostname, getFaviconUrl } from "./utils/siteUtils";

/**
 * 分组头部组件
 * 根据分组内第一个站点的 favicon 提取主色，自适应左边框与背景色
 * 支持折叠/展开：点击组头切换折叠状态
 */
function GroupHeader({
  groupName,
  firstSite,
  collapsed,
  collapsible,
  onToggleCollapse,
}: {
  groupName: string;
  firstSite: SpeedDialSite;
  collapsed?: boolean;
  collapsible?: boolean;
  onToggleCollapse?: () => void;
}) {
  const faviconUrl = useMemo(() => getFaviconUrl(firstSite), [firstSite]);
  const hostname = useMemo(() => getHostname(firstSite.url), [firstSite.url]);
  const accent = useAccent(faviconUrl, hostname);
  const color = accent.bar || "var(--ant-color-primary)";
  const headerStyle: React.CSSProperties = {
    borderLeftColor: color,
    ...cssVars({
      "--speed-dial-group-accent": color,
    }),
  };

  return (
    <div
      className={styles["speed-dial-group-header"]}
      style={headerStyle}
      onClick={collapsible ? onToggleCollapse : undefined}
      role={collapsible ? "button" : undefined}
      tabIndex={collapsible ? 0 : undefined}
      aria-expanded={collapsible ? !collapsed : undefined}
    >
      {collapsible && (
        <span className={styles["speed-dial-group-collapse-icon"]}>
          {collapsed ? <ChevronRight size={ICON_SIZE.XS} /> : <ChevronDown size={ICON_SIZE.XS} />}
        </span>
      )}
      {groupName}
    </div>
  );
}

interface SpeedDialGridProps {
  sites: readonly SpeedDialSite[];
  /** 外部传入的「新增站点」回调；若不传则组件内部自行管理弹窗 */
  onAdd?: () => void;
}

const EMPTY_GROUP_COLLAPSED_MAP: Record<string, boolean> = {};

export function SpeedDialGrid({ sites, onAdd }: SpeedDialGridProps) {
  const { t } = useT();
  const removeSite = useSpeedDialStore((s) => s.removeSite);
  const groupEnabled = useSettingsStore((s) => s.settings.speedDialGroupEnabled ?? false);
  const groupCollapsible = useSettingsStore((s) => s.settings.quickStartGroupCollapsible ?? true);
  const groupCollapsedMap = useSettingsStore(
    (s) => s.settings.quickStartGroupCollapsed ?? EMPTY_GROUP_COLLAPSED_MAP,
  );
  const showAddButton = useSettingsStore((s) => s.settings.showAddSiteButton ?? true);
  const cardSize = useSettingsStore((s) => s.settings.quickStartCardSize ?? "md");
  const layoutMode = useSettingsStore((s) => s.settings.quickStartLayoutMode ?? "grid");
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const fabAddButton = useSettingsStore((s) => s.settings.quickStartFabAddButton ?? false);
  // 仅在没有外部 onAdd 时，组件内部管理弹窗状态（向后兼容）
  const [internalAddModalOpen, setInternalAddModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<SpeedDialSite | null>(null);

  /**
   * 根据卡片尺寸档位或精确宽度计算实际的卡片最小宽度。
   *   - 若设置了 quickStartCardExactWidth，直接使用精确值（80–280px）
   *   - 否则使用 sm/md/lg/auto 预设档位
   *     - auto 档位根据站点数量自适应：
   *       - 站点数 ≤ lgThreshold → lg
   *       - 站点数 ≤ mdThreshold → md
   *       - 站点数 > mdThreshold → sm
   */
  const cardMinWidth = useMemo(() => {
    // 1. 优先使用精确宽度
    const exactWidth = useSettingsStore.getState().settings.quickStartCardExactWidth;
    if (exactWidth) return `${exactWidth}px`;
    // 2. auto 档位：根据站点数量自适应
    if (cardSize === "auto") {
      const thresholds = useSettingsStore.getState().settings.quickStartAutoThresholds;
      const lgThreshold = thresholds?.lgThreshold ?? 6;
      const mdThreshold = thresholds?.mdThreshold ?? 14;
      const count = sites.length;
      if (count <= lgThreshold) return "208px";
      if (count <= mdThreshold) return "160px";
      return "120px";
    }
    // 3. 固定档位
    const SIZE_MAP = { sm: "120px", md: "160px", lg: "208px" } as const;
    return SIZE_MAP[cardSize] ?? "160px";
  }, [cardSize, sites.length]);

  /** 顶层 wrapper 上注入 --speed-dial-card-min-width 和 --speed-dial-grid-gap CSS 变量 */
  const wrapperStyle = useMemo(
    () =>
      cssVars({
        "--speed-dial-card-min-width": cardMinWidth,
        "--speed-dial-grid-gap": `${useSettingsStore.getState().settings.quickStartGridGap ?? 12}px`,
      }),
    [cardMinWidth],
  );

  /** 删除站点 */
  const handleDelete = useCallback(
    (id: string) => {
      void removeSite(id);
    },
    [removeSite],
  );

  /** 打开编辑弹窗 */
  const handleEdit = useCallback((site: SpeedDialSite) => {
    setEditingSite(site);
    setInternalAddModalOpen(true);
  }, []);

  /** 实际触发新增的回调：优先使用外部 onAdd，否则内部弹窗 */
  const handleAddClick = useCallback(() => {
    if (onAdd) {
      onAdd();
    } else {
      setEditingSite(null);
      setInternalAddModalOpen(true);
    }
  }, [onAdd]);

  /** 全局快捷键 Ctrl/Cmd+Shift+A 打开新增弹窗 */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        handleAddClick();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleAddClick]);

  /** 关闭内部弹窗 */
  const handleModalClose = useCallback(() => {
    setInternalAddModalOpen(false);
    setEditingSite(null);
  }, []);

  const isEmpty = sites.length === 0;

  /** 已有分组名列表（传给新增弹窗） */
  const existingGroups = useMemo(() => {
    const set = new Set<string>();
    for (const s of sites) {
      if (s.group) set.add(s.group);
    }
    return [...set].sort();
  }, [sites]);

  /** 拖拽排序 hook */
  const reorderSites = useSpeedDialStore((s) => s.reorderSites);
  const { sensors, handleDragEnd } = useSpeedDialSortable({
    sites,
    reorderSites,
  });

  /** 分组 hook */
  const { grouped } = useSiteGroups({
    sites,
    groupEnabled,
    ungroupedLabel: t('未分组'),
  });

  /** 渲染一组卡片 */
  const renderCards = (siteList: readonly SpeedDialSite[]) => (
    <>
      {siteList.map((site) => (
        <SortableSiteCard key={site.id} site={site} onEdit={handleEdit} onDelete={handleDelete} />
      ))}
    </>
  );

  /** 列表视图的单行条目 */
  const renderList = (siteList: readonly SpeedDialSite[]) => (
    <>
      {siteList.map((site) => (
        <SortableSiteCard
          key={site.id}
          site={site}
          onEdit={handleEdit}
          onDelete={handleDelete}
          variant="list"
        />
      ))}
    </>
  );

  /** 空状态 */
  if (isEmpty) {
    return (
      <div className={styles["speed-dial-grid"]}>
        <div className={styles["speed-dial-empty"]}>
          <Typography.Text strong className={styles["speed-dial-empty-title"]}>
            {t('把你最常去的站点放在这里')}
          </Typography.Text>
          <Typography.Text type="secondary" className={styles["speed-dial-empty-desc"]}>
            {t('每次打开新标签页，一键直达你的工作入口')}
          </Typography.Text>
          <Button
            type="primary"
            className={styles["speed-dial-empty-btn"]}
            icon={<Plus size={ICON_SIZE.SMALL} />}
            onClick={handleAddClick}
          >
            {t('添加站点')}
          </Button>
        </div>
        {!onAdd && (
          <SpeedDialAddModal
            open={internalAddModalOpen}
            onClose={handleModalClose}
            editingSite={editingSite}
            existingGroups={existingGroups}
          />
        )}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sites.map((s) => s.id)} strategy={rectSortingStrategy}>
        <div className={styles["speed-dial-grid-wrapper"]} style={wrapperStyle}>
          {/* 分组模式 */}
          {groupEnabled ? (
            grouped.map(({ groupName, sites: groupSites }, index) => {
              const isCollapsed = groupCollapsedMap[groupName ?? ""] ?? false;
              return (
                <div key={groupName || "ungrouped"} className={styles["speed-dial-group"]}>
                  {groupName && groupSites[0] && (
                    <GroupHeader
                      groupName={groupName}
                      firstSite={groupSites[0]}
                      collapsed={isCollapsed}
                      collapsible={groupCollapsible}
                      onToggleCollapse={() => {
                        const key = groupName ?? "";
                        void updateSettings({
                          quickStartGroupCollapsed: {
                            ...groupCollapsedMap,
                            [key]: !isCollapsed,
                          },
                        });
                      }}
                    />
                  )}
                  <div
                    className={
                      layoutMode === "list"
                        ? styles["speed-dial-group-list"]
                        : styles["speed-dial-group-grid"]
                    }
                    style={isCollapsed ? { display: "none" } : undefined}
                  >
                    {layoutMode === "list" ? renderList(groupSites) : renderCards(groupSites)}
                    {/* 添加按钮：放在最后一个分组的网格内，与其他卡片共享同一行 */}
                    {showAddButton && !onAdd && index === grouped.length - 1 && (
                      <div className={styles["speed-dial-add-cell"]}>
                        <Card
                          className={`app-card-interactive ${styles["app-speed-dial-card"]} ${styles["app-speed-dial-card--add"]}`}
                          classNames={{ body: styles["app-speed-dial-card__body"] }}
                          onClick={handleAddClick}
                        >
                          <div className={styles["app-speed-dial-add-preview"]}>
                            <Plus size={28} className={styles["app-speed-dial-add-icon"]} />
                          </div>
                          <div className={styles["app-speed-dial-add-content"]}>
                            <span className={styles["app-speed-dial-add-label"]}>
                              {t('添加站点')}
                            </span>
                            <span className={styles["app-speed-dial-add-hint"]} aria-hidden="true">
                              placeholder
                            </span>
                          </div>
                        </Card>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div
              className={
                layoutMode === "list" ? styles["speed-dial-list"] : styles["speed-dial-grid"]
              }
            >
              {layoutMode === "list" ? renderList(sites) : renderCards(sites)}
              {showAddButton && !onAdd && (
                <div className={styles["speed-dial-add-cell"]}>
                  <Card
                    className={`app-card-interactive ${styles["app-speed-dial-card"]} ${styles["app-speed-dial-card--add"]}`}
                    classNames={{ body: styles["app-speed-dial-card__body"] }}
                    onClick={handleAddClick}
                  >
                    <div className={styles["app-speed-dial-add-preview"]}>
                      <Plus size={28} className={styles["app-speed-dial-add-icon"]} />
                    </div>
                    <div className={styles["app-speed-dial-add-content"]}>
                      <span className={styles["app-speed-dial-add-label"]}>
                        {t('添加站点')}
                      </span>
                      <span className={styles["app-speed-dial-add-hint"]} aria-hidden="true">
                        placeholder
                      </span>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          )}

          {!onAdd && (
            <SpeedDialAddModal
              open={internalAddModalOpen}
              onClose={handleModalClose}
              editingSite={editingSite}
              existingGroups={existingGroups}
            />
          )}

          {/* 浮动添加按钮（FAB）— 始终悬浮在右下角 */}
          {fabAddButton && !onAdd && (
            <Button
              type="primary"
              shape="circle"
              size="large"
              className={styles["speed-dial-fab"]}
              icon={<Plus size={ICON_SIZE.LARGE} />}
              onClick={handleAddClick}
            />
          )}
        </div>
      </SortableContext>
    </DndContext>
  );
}
