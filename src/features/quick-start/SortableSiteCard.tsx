/**
 * SortableSiteCard — 可拖拽排序的站点卡片
 *
 * 职责：通过 useSortable 使卡片可拖拽，并渲染 SiteCard。
 * 拖拽手柄的 listeners 只绑定在手柄元素上，避免误触。
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SpeedDialSite } from '@/shared/types';
import { SiteCard } from './SiteCard';

interface SortableSiteCardProps {
  site: SpeedDialSite;
  onEdit: (site: SpeedDialSite) => void;
  onDelete: (id: string) => void;
}

export function SortableSiteCard({ site, onEdit, onDelete }: SortableSiteCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: site.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 999 : 'auto',
  } as React.CSSProperties;

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {/* 只把手柄区域的 listeners 传给 SiteCard */}
      <SiteCard
        site={site}
        dragListeners={listeners}
        dragAttributes={attributes}
        isDragging={isDragging}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}
