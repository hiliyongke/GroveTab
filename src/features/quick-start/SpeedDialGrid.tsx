/**
 * SpeedDialGrid — 常用站点网格（主组件）
 *
 * 职责：
 *   - 组装 useSpeedDialSortable / useSiteGroups hooks
 *   - 渲染 DndContext + SortableContext
 *   - 渲染空状态 / 分组网格 / 新增按钮
 */

import { useCallback, useMemo, useState } from 'react';
import { Card, Button } from 'antd';
import { Plus } from 'lucide-react';
import { cssVars } from '@/shared/utils/css-vars';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { useSpeedDialStore, useSettingsStore } from '@/store';
import { useT } from '@/shared/i18n';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import type { SpeedDialSite } from '@/shared/types';
import { SpeedDialAddModal } from './SpeedDialAddModal';
import { SortableSiteCard } from './SortableSiteCard';
import { useSpeedDialSortable } from './hooks/useSpeedDialSortable';
import { useSiteGroups } from './hooks/useSiteGroups';
import { useAccent } from '@/shared/hooks/useAccent';
import { getHostname, getFaviconUrl } from './utils/siteUtils';

/**
 * 分组头部组件
 * 根据分组内第一个站点的 favicon 提取主色，自适应左边框与背景色
 */
function GroupHeader({ groupName, firstSite }: { groupName: string; firstSite: SpeedDialSite }) {
  const faviconUrl = useMemo(() => getFaviconUrl(firstSite), [firstSite]);
  const hostname = useMemo(() => getHostname(firstSite.url), [firstSite.url]);
  const accent = useAccent(faviconUrl, hostname);
  const color = accent.bar || 'var(--ant-color-primary)';
  const headerStyle: React.CSSProperties = {
    borderLeftColor: color,
    ...cssVars({
      '--speed-dial-group-accent': color,
    }),
  };

  return (
    <div className="speed-dial-group-header" style={headerStyle}>
      {groupName}
    </div>
  );
}

interface SpeedDialGridProps {
  sites: readonly SpeedDialSite[];
}

export function SpeedDialGrid({ sites }: SpeedDialGridProps) {
  const { t } = useT();
  const removeSite = useSpeedDialStore((s) => s.removeSite);
  const groupEnabled = useSettingsStore((s) => s.settings.speedDialGroupEnabled ?? false);
  const showAddButton = useSettingsStore((s) => s.settings.showAddSiteButton ?? true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<SpeedDialSite | null>(null);

  /** 删除站点 */
  const handleDelete = useCallback((id: string) => {
    void removeSite(id);
  }, [removeSite]);

  /** 打开编辑弹窗 */
  const handleEdit = useCallback((site: SpeedDialSite) => {
    setEditingSite(site);
    setAddModalOpen(true);
  }, []);

  /** 打开新增弹窗 */
  const handleAddClick = useCallback(() => {
    setEditingSite(null);
    setAddModalOpen(true);
  }, []);

  /** 关闭弹窗 */
  const handleModalClose = useCallback(() => {
    setAddModalOpen(false);
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
    ungroupedLabel: t('quickStart.ungrouped'),
  });

  /** 新增按钮卡片 */
  const AddCard = () => (
    <Card
      className="app-card-interactive app-speed-dial-card app-speed-dial-card--add"
      classNames={{ body: 'app-speed-dial-card__body' }}
      onClick={handleAddClick}
    >
      <div className="app-speed-dial-add-preview">
        <Plus size={28} className="app-speed-dial-add-icon" />
      </div>
      <div className="app-speed-dial-add-content">
        <span className="app-speed-dial-add-label">
          {t('quickStart.addSite')}
        </span>
        <span className="app-speed-dial-add-hint" aria-hidden="true">
          placeholder
        </span>
      </div>
    </Card>
  );

  /** 渲染一组卡片 */
  const renderCards = (siteList: readonly SpeedDialSite[]) => (
    <>
      {siteList.map((site) => (
        <SortableSiteCard
          key={site.id}
          site={site}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      ))}
    </>
  );

  /** 空状态 */
  if (isEmpty) {
    return (
      <div className="speed-dial-grid">
        <div className="speed-dial-empty">
          <p className="speed-dial-empty-title">{t('quickStart.emptyTitle')}</p>
          <p className="speed-dial-empty-desc">{t('quickStart.emptyDesc')}</p>
          <Button type="primary" className="speed-dial-empty-btn" icon={<Plus size={ICON_SIZE.SMALL} />} onClick={handleAddClick}>
            {t('quickStart.addSite')}
          </Button>
        </div>
        <SpeedDialAddModal
          open={addModalOpen}
          onClose={handleModalClose}
          editingSite={editingSite}
          existingGroups={existingGroups}
        />
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sites.map((s) => s.id)} strategy={rectSortingStrategy}>
        <div className="speed-dial-grid-wrapper">
          {/* 分组模式 */}
          {groupEnabled ? (
            grouped.map(({ groupName, sites: groupSites }) => (
              <div key={groupName || 'ungrouped'} className="speed-dial-group">
                {groupName && <GroupHeader groupName={groupName} firstSite={groupSites[0]} />}
                <div className="speed-dial-group-grid">
                  {renderCards(groupSites)}
                </div>
              </div>
            ))
          ) : (
            <div className="speed-dial-grid">
              {renderCards(sites)}
            </div>
          )}

          {/* 添加按钮：与网格同级，使用 display:contents 让所有卡片共享同一网格 */}
          {showAddButton && (
            <div className="speed-dial-add-cell">
              <AddCard />
            </div>
          )}

          <SpeedDialAddModal
            open={addModalOpen}
            onClose={handleModalClose}
            editingSite={editingSite}
            existingGroups={existingGroups}
          />
        </div>
      </SortableContext>
    </DndContext>
  );
}
