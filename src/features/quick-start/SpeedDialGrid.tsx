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
import styles from './QuickStartLayer.module.less';
import { SpeedDialAddModal } from './SpeedDialAddModal';
import { SortableSiteCard } from './SortableSiteCard';
import { useSpeedDialSortable } from './hooks/use-speed-dial-sortable';
import { useSiteGroups } from './hooks/use-site-groups';
import { useAccent } from '@/shared/hooks/use-accent';
import { getHostname, getFaviconUrl } from './utils/site-utils';

/**
 * 分组头部组件
 * 根据分组内第一个站点的 favicon 提取主色，自适应左边框与背景色
 * @param root0 - 组件属性
 * @param root0.groupName - 分组名称
 * @param root0.firstSite - 分组内第一个站点
 * @returns {JSX.Element} 返回分组头部 JSX 元素
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
    <div className={styles['speed-dial-group-header']} style={headerStyle}>
      {groupName}
    </div>
  );
}

interface SpeedDialGridProps {
  sites: readonly SpeedDialSite[];
}

/**
 * 新增按钮卡片 — 声明在组件外部避免 React Compiler "Cannot create components during render" 错误
 * @param root0 - 组件属性
 * @param root0.onClick - 点击回调
 * @returns {JSX.Element} 返回新增按钮卡片 JSX 元素
 */
function AddCard({ onClick }: { onClick: () => void }) {
  const { t } = useT();
  return (
    <Card
      className={`${styles['app-card-interactive']} ${styles['app-speed-dial-card']} ${styles['app-speed-dial-card--add']}`}
      classNames={{ body: styles['app-speed-dial-card__body'] }}
      onClick={onClick}
    >
      <div className={styles['app-speed-dial-add-preview']}>
        <Plus size={28} className={styles['app-speed-dial-add-icon']} />
      </div>
      <div className={styles['app-speed-dial-add-content']}>
        <span className={styles['app-speed-dial-add-label']}>
          {t('quickStart.addSite')}
        </span>
        <span className={styles['app-speed-dial-add-hint']} aria-hidden="true">
          placeholder
        </span>
      </div>
    </Card>
  );
}

/**
 * 常用站点网格（主组件）
 *
 * 职责：
 *   - 组装 useSpeedDialSortable / useSiteGroups hooks
 *   - 渲染 DndContext + SortableContext
 *   - 渲染空状态 / 分组网格 / 新增按钮
 *
 * @param root0 - 组件属性
 * @param root0.sites - 站点列表
 * @returns {JSX.Element} 返回常用站点网格 JSX 元素
 */
export function SpeedDialGrid({ sites }: SpeedDialGridProps) {
  const { t } = useT();
  const removeSite = useSpeedDialStore((s) => s.removeSite);
  const groupEnabled = useSettingsStore((s) => s.settings.speedDialGroupEnabled ?? false);
  const showAddButton = useSettingsStore((s) => s.settings.showAddSiteButton ?? true);
  const cardSize = useSettingsStore((s) => s.settings.quickStartCardSize ?? 'md');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<SpeedDialSite | null>(null);

  /**
   * 根据卡片尺寸档位计算实际的卡片最小宽度。
   *   - sm / md / lg：固定档位（卡片不超过这个宽度太多，行内塞更多）
   *   - auto：使用较小的下限，让 CSS Grid 的 auto-fill + 1fr 自动铺满容器宽度，
   *           卡片会随窗口宽度自适应伸缩，无需按站点数量分档。
   */
  const cardMinWidth = useMemo(() => {
    const SIZE_MAP = { sm: '120px', md: '160px', lg: '208px', auto: '140px' } as const;
    return SIZE_MAP[cardSize] ?? SIZE_MAP.md;
  }, [cardSize]);

  /** 顶层 wrapper 上注入 --speed-dial-card-min-width CSS 变量 */
  const wrapperStyle = useMemo(
    () => cssVars({ '--speed-dial-card-min-width': cardMinWidth }),
    [cardMinWidth],
  );

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

  /**
   * 渲染一组卡片
   * @param siteList - 站点列表
   * @returns {JSX.Element} 返回卡片列表 JSX 元素
   */
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
      <div className={styles['speed-dial-grid']}>
        <div className={styles['speed-dial-empty']}>
          <p className={styles['speed-dial-empty-title']}>{t('quickStart.emptyTitle')}</p>
          <p className={styles['speed-dial-empty-desc']}>{t('quickStart.emptyDesc')}</p>
          <Button type="primary" className={styles['speed-dial-empty-btn']} icon={<Plus size={ICON_SIZE.SMALL} />} onClick={handleAddClick}>
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
        <div className={styles['speed-dial-grid-wrapper']} style={wrapperStyle}>
          {/* 分组模式 */}
          {groupEnabled ? (
            grouped.map(({ groupName, sites: groupSites }) => (
              <div key={groupName || 'ungrouped'} className={styles['speed-dial-group']}>
                {groupName && groupSites[0] && <GroupHeader groupName={groupName} firstSite={groupSites[0]} />}
                <div className={styles['speed-dial-group-grid']}>
                  {renderCards(groupSites)}
                </div>
              </div>
            ))
          ) : (
            <div className={styles['speed-dial-grid']}>
              {renderCards(sites)}
            </div>
          )}

          {/* 添加按钮：与网格同级，使用 display:contents 让所有卡片共享同一网格 */}
          {showAddButton && (
            <div className={styles['speed-dial-add-cell']}>
              <AddCard onClick={handleAddClick} />
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
