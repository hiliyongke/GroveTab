/**
 * QuickStartLayer — 首页轻启动层
 *
 * 常用站点快捷入口，位于 Hero 搜索框下方。
 * Sidebar 变体：纯图标列表（类似 macOS Dock），悬浮显示标题，节约宽屏横向空间。
 * 支持拖拽调节宽度、自适应列数（≤80px 1列 />80px 2列）、拖拽排序、分组。
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { Button, Tooltip, Typography } from "antd";
import { Plus, Settings2, PanelLeft, ArrowLeftRight, GripVertical, Layers } from "lucide-react";
import { useSpeedDialStore, useSettingsStore } from "@/store";
import { useT } from "@/shared/i18n";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { SpeedDialGrid } from "./SpeedDialGrid";
import { SpeedDialAddModal } from "./SpeedDialAddModal";
import { getFaviconUrl, getHostname, getInitial } from "./utils/siteUtils";
import { useAccent } from "@/shared/hooks/use-accent";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import styles from "./QuickStartLayer.module.less";

interface QuickStartLayerProps {
  onOpenSettings?: () => void;
  variant?: "default" | "sidebar";
  sidebarWidth?: number;
}

export function QuickStartLayer({ onOpenSettings, variant = "default" }: QuickStartLayerProps) {
  const { t } = useT();
  const sites = useSpeedDialStore((s) => s.sites);
  const loaded = useSpeedDialStore((s) => s.loaded);
  const loadSites = useSpeedDialStore((s) => s.loadSites);
  const quickStartVisible = useSettingsStore((s) => s.settings.uiVisibility?.quickStart !== false);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const [addModalOpen, setAddModalOpen] = useState(false);

  useEffect(() => {
    if (!loaded) void loadSites();
  }, [loaded, loadSites]);

  const existingGroups = useMemo(() => {
    const set = new Set<string>();
    for (const s of sites) if (s.group) set.add(s.group);
    return [...set].sort();
  }, [sites]);

  if (!quickStartVisible) return null;

  if (variant === "sidebar") {
    return (
      <QuickStartSidebar
        sites={sites}
        updateSettings={updateSettings}
        t={t}
        setAddModalOpen={setAddModalOpen}
        addModalOpen={addModalOpen}
        existingGroups={existingGroups}
      />
    );
  }

  return (
    <section className={styles["app-quick-start"]}>
      <div className={styles["quick-start-header"]}>
        <span className={styles["quick-start-title"]}>{t('常用站点')}</span>
        <div className={styles["quick-start-actions"]}>
          <Tooltip title={t("切换左右布局")} placement="top">
            <Button
              type="text"
              size="small"
              icon={<PanelLeft size={ICON_SIZE.SMALL} />}
              onClick={() => void updateSettings({ quickStartLayout: "sidebar" })}
              className={styles["quick-start-action-btn"]}
            />
          </Tooltip>
          <Tooltip title={t('添加站点')} placement="top">
            <Button
              type="text"
              size="small"
              icon={<Plus size={ICON_SIZE.SMALL} />}
              onClick={() => setAddModalOpen(true)}
              className={styles["quick-start-action-btn"]}
            />
          </Tooltip>
          {onOpenSettings && (
            <Tooltip title={t('设置')} placement="top">
              <Button
                type="text"
                size="small"
                icon={<Settings2 size={ICON_SIZE.SMALL} />}
                onClick={onOpenSettings}
                className={styles["quick-start-action-btn"]}
              />
            </Tooltip>
          )}
        </div>
      </div>
      <SpeedDialGrid sites={sites} onAdd={() => setAddModalOpen(true)} />
      <SpeedDialAddModal open={addModalOpen} onClose={() => setAddModalOpen(false)} editingSite={null} existingGroups={existingGroups} />
    </section>
  );
}

// ── Sidebar Site Button ──

function SidebarSiteButton({ site, onRemove }: {
  site: ReturnType<typeof useSpeedDialStore.getState>['sites'][0];
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: site.id });
  const favicon = getFaviconUrl(site);
  const hostname = getHostname(site.url);
  const initial = getInitial(hostname);

  return (
    <Tooltip title={site.title || site.url} placement="left">
      <a
        ref={setNodeRef}
        href={site.url}
        target="_blank"
        rel="noreferrer"
        className={styles["sidebar-site-btn"]}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.5 : 1,
        }}
        onClick={(e) => {
          if (e.button === 0) { e.preventDefault(); window.open(site.url, "_blank", "noopener,noreferrer"); }
        }}
        onContextMenu={(e) => { e.preventDefault(); onRemove(site.id); }}
        onAuxClick={(e) => {
          if (e.button === 1) { e.preventDefault(); onRemove(site.id); }
        }}
      >
        <span className={styles["sidebar-drag-handle"]} {...attributes} {...listeners}>
          <GripVertical size={10} />
        </span>
        {favicon ? (
          <img
            src={favicon}
            alt=""
            className={styles["sidebar-favicon"]}
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              // Google favicon 重试一次（有时首次失败）
              const src = img.src;
              if (src.includes("google.com/s2/favicons") && !src.includes("&retry=1")) {
                img.src = src + "&retry=1";
                return;
              }
              img.style.display = "none";
              const fallback = img.nextElementSibling;
              if (fallback) (fallback as HTMLElement).style.display = "flex";
            }}
          />
        ) : null}
        <span className={styles["sidebar-fallback"]} style={{ display: favicon ? "none" : "flex" }}>
          {initial}
        </span>
      </a>
    </Tooltip>
  );
}

// ── Group Header (compact) ──

function SidebarGroupHeader({ groupName, firstSite }: {
  groupName: string;
  firstSite: ReturnType<typeof useSpeedDialStore.getState>['sites'][0];
}) {
  const faviconUrl = useMemo(() => getFaviconUrl(firstSite), [firstSite]);
  const hostname = useMemo(() => getHostname(firstSite.url), [firstSite.url]);
  const accent = useAccent(faviconUrl, hostname);
  const color = accent.bar || "var(--ant-color-primary)";

  return (
    <div
      className={styles["sidebar-group-header"]}
      style={{ ["--sidebar-group-accent" as string]: color }}
    >
      <Typography.Text className={styles["sidebar-group-name"]} ellipsis>
        {groupName}
      </Typography.Text>
    </div>
  );
}

// ── QuickStartSidebar ──

function QuickStartSidebar({
  sites, updateSettings, t, setAddModalOpen, addModalOpen, existingGroups,
}: {
  sites: ReturnType<typeof useSpeedDialStore.getState>['sites'];
  updateSettings: ReturnType<typeof useSettingsStore.getState>['updateSettings'];
  t: ReturnType<typeof useT>['t'];
  setAddModalOpen: (v: boolean) => void;
  addModalOpen: boolean;
  existingGroups: string[];
}) {
  const removeSite = useSpeedDialStore((s) => s.removeSite);
  const reorderSites = useSpeedDialStore((s) => s.reorderSites);
  const groupEnabled = useSettingsStore((s) => s.settings.speedDialGroupEnabled ?? false);
  const sidebarPosition = useSettingsStore((s) => s.settings.quickStartSidebarPosition ?? "right");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const ids = sites.map((s) => s.id);
      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(over.id as string);
      if (oldIndex !== -1 && newIndex !== -1) {
        ids.splice(oldIndex, 1);
        ids.splice(newIndex, 0, active.id as string);
        void reorderSites(ids);
      }
    }
  }, [sites, reorderSites]);

  // 分组
  const grouped = useMemo(() => {
    if (!groupEnabled || sites.length === 0) return [{ groupName: null as string | null, sites: [...sites] }];
    const map = new Map<string | null, typeof sites>();
    for (const s of sites) {
      const key = s.group || null;
      const existing = map.get(key) ?? [];
      map.set(key, [...existing, s]);
    }
    return [...map.entries()].map(([groupName, groupSites]) => ({ groupName, sites: groupSites }));
  }, [sites, groupEnabled]);

  return (
    <section className={styles["app-quickstart-sidebar"]}>
      {/* 操作按钮组（垂直排列） */}
      <div className={styles["sidebar-actions"]}>
        {/* 返回 stacked 布局 */}
        <Tooltip title={t("切回上下布局")} placement="left">
          <Button
            type="text"
            size="small"
            icon={<PanelLeft size={ICON_SIZE.SMALL} />}
            onClick={() => void updateSettings({ quickStartLayout: "stacked" })}
            className={styles["sidebar-action-btn"]}
          />
        </Tooltip>

        {/* 左侧/右侧切换 */}
        <Tooltip title={sidebarPosition === "left" ? t("切换至右侧") : t("切换至左侧")} placement="left">
          <Button
            type="text"
            size="small"
            icon={<ArrowLeftRight size={ICON_SIZE.SMALL} />}
            onClick={() => void updateSettings({
              quickStartSidebarPosition: sidebarPosition === "left" ? "right" : "left",
            })}
            className={styles["sidebar-action-btn"]}
          />
        </Tooltip>

        {/* 分组开关 */}
        <Tooltip title={groupEnabled ? t("关闭分组") : t("开启分组")} placement="left">
          <Button
            type="text"
            size="small"
            icon={<Layers size={ICON_SIZE.SMALL} />}
            onClick={() => void updateSettings({ speedDialGroupEnabled: !groupEnabled })}
            className={`${styles["sidebar-action-btn"]}${groupEnabled ? ` ${styles["sidebar-action-btn--active"]}` : ""}`}
          />
        </Tooltip>

        {/* 添加站点 */}
        <Tooltip title={t("添加站点")} placement="left">
          <Button
            type="text"
            size="small"
            icon={<Plus size={ICON_SIZE.SMALL} />}
            onClick={() => setAddModalOpen(true)}
            className={styles["sidebar-action-btn"]}
          />
        </Tooltip>

      </div>

      {/* 站点图标列表 + 拖拽 */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className={styles["sidebar-icon-list"]}>
          {grouped.map(({ groupName, sites: groupSites }) => (
            <div key={groupName ?? "__ungrouped"} className={styles["sidebar-group"]}>
              {groupName && groupSites[0] && (
                <SidebarGroupHeader groupName={groupName} firstSite={groupSites[0]} />
              )}
              <SortableContext items={groupSites.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <div className={styles["sidebar-site-grid"]}>
                  {groupSites.map((site) => (
                    <SidebarSiteButton
                      key={site.id}
                      site={site}
                      onRemove={(id) => { void removeSite(id); }}
                    />
                  ))}
                </div>
              </SortableContext>
            </div>
          ))}
        </div>
      </DndContext>

      <SpeedDialAddModal open={addModalOpen} onClose={() => setAddModalOpen(false)} editingSite={null} existingGroups={existingGroups} />
    </section>
  );
}
