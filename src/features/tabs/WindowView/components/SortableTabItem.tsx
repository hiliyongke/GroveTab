/**
 * SortableTabItem — 可排序的标签行组件
 *
 * 封装了 dnd-kit 的 useSortable hook，
 * 使标签可以在窗口内拖拽排序
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SortableTabItemProps, DragData } from '../types';
import { TabItem } from '@/features/tabs/TabItem';
import styles from '../WindowView.module.less';

/**
 *
 * @param root0
 * @param root0.tab
 * @param root0.windowId
 * @param root0.onJump
 * @param root0.onClose
 * @param root0.showHostname
 * @param root0.selectable
 * @param root0.visibleTabIds
 * @param root0.reduced
 * @returns {void} 无返回值
 */
function SortableTabItem({
  tab,
  windowId,
  onJump,
  onClose,
  showHostname,
  selectable,
  visibleTabIds,
  reduced,
}: SortableTabItemProps) {
  const sortableId = `tab::${windowId}::${tab.id}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: sortableId,
    data: { kind: 'tab' as const, tabId: tab.id, windowId, url: tab.url } as DragData,
  });

  const sortableStyle: React.CSSProperties = {
    opacity: isDragging ? 0.4 : 1,
    transform: CSS.Translate.toString(transform),
    transition: reduced ? 'none' : transition,
    position: 'relative',
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={sortableStyle}
      className={`${styles['app-window-card-sortable-item']}${isDragging ? ` ${styles['is-dragging']}` : ''}`}
    >
      <TabItem
        tab={tab}
        onJump={onJump}
        onClose={onClose}
        showHostname={showHostname}
        selectable={selectable}
        visibleTabIds={visibleTabIds}
      />
    </div>
  );
}

export { SortableTabItem };
