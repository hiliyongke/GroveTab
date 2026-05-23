/**
 * DragPreview — 拖拽预览组件
 *
 * 在 DragOverlay 中显示拖拽时的预览信息
 * - 标签拖拽时显示"拖拽到其他窗口"或"复制到窗口"
 * - 分组拖拽时显示"拖拽分组到其他窗口"
 */

import type { DragPreviewProps } from '../types';
import styles from '../WindowView.module.less';

/**
 * 拖拽预览组件
 *
 * 在 DragOverlay 中显示拖拽时的预览信息。
 * - 标签拖拽时显示"拖拽到其他窗口"或"复制到窗口"
 * - 分组拖拽时显示"拖拽分组到其他窗口"
 *
 * @param props - 组件属性
 * @param props.active - 当前拖拽的激活状态
 * @param props.t - 国际化翻译函数
 * @param props.isAltHeld - Alt 键是否按住
 * @returns 拖拽预览 JSX 元素
 */
function DragPreview({
  active,
  t,
  isAltHeld,
}: DragPreviewProps) {
  if (active.data.kind === 'tab') {
    return (
      <div className={styles['app-kanban-overlay']}>
        <span className={styles['app-kanban-card__title']}>
          {isAltHeld ? t('window.dragCopyToOtherWindow') : t('window.dragToOtherWindow')}
        </span>
      </div>
    );
  }
  if (active.data.kind === 'group-label') {
    return (
      <div className={styles['app-kanban-overlay']}>
        <span className={styles['app-kanban-card__title']}>{t('window.dragGroupToOtherWindow')}</span>
      </div>
    );
  }
  return null;
}

export { DragPreview };
