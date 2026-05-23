/**
 * UndoToast — 关闭 / 归档后的撤销提示（富交互版，F-06 封板）
 *
 * 设计：
 *   - 底部居中浮动胶囊（antd token 控制配色）
 *   - 归档场景：文案 "已归档 N 个标签到「{sessionName}」" + [查看归档] + [撤销]
 *   - 普通关闭场景：保持原 [撤销] 单按钮形态
 *   - 若 record.subNote 非空（如 "M 个关闭失败"），在副行展示
 *
 * UndoToast 通过自定义事件 `app:open-archive` 通知上层打开 ArchivePanel 并高亮 session。
 */

import { Button } from 'antd';
import { Archive, Undo2, X } from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useUndoStore, useSelectionStore } from '@/store';
import { useT } from '@/shared/i18n';
import { APP_EVENTS } from '@/shared/config/storage-keys';
import styles from './status-surfaces.module.less';

/**
 * 触发"打开 Archive 并高亮 session"的跨组件事件
 *
 * 通过 CustomEvent 派发事件，App.tsx 监听该事件并调用 setShowArchive(true)。
 * 如果传入 sessionId，ArchivePanel 会高亮对应的会话。
 *
 * @param sessionId - 要高亮的归档会话 ID（可选）
 */
function openArchivePanel(sessionId?: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(APP_EVENTS.openArchive, { detail: { sessionId } }),
  );
}

/**
 * UndoToast — 关闭 / 归档后的撤销提示（富交互版）
 *
 * 设计：
 *   - 底部居中浮动胶囊（antd token 控制配色）
 *   - 归档场景：文案 "已归档 N 个标签到「{sessionName}」" + [查看归档] + [撤销]
 *   - 普通关闭场景：保持原 [撤销] 单按钮形态
 *   - 若 record.subNote 非空（如 "M 个关闭失败"），在副行展示
 *
 * 通过 useUndoStore 驱动显示/隐藏，撤销操作后自动消失。
 *
 * @returns 撤销提示 UI；无活跃 toast 时返回 null
 */
export function UndoToast() {
  const activeToast = useUndoStore((s) => s.activeToast);
  const undoRecord = useUndoStore((s) => s.undoRecord);
  const dismissToast = useUndoStore((s) => s.dismissToast);
  const selectionMode = useSelectionStore((s) => s.selectionMode);
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const { t } = useT();

  if (!activeToast) return null;

  /**
   * 主文案：
   *   - 归档场景：直接使用 record.description（形如 "已归档 32 个标签到「…」"）
   *   - 关闭场景：按 i18n 模板生成 "关闭 X 个标签"
   */
  const tabCount = activeToast.tabs.length;
  const isArchive = activeToast.archivedSessionId !== undefined;
  const mainLabel = isArchive
    ? activeToast.description
    : tabCount === 1
    ? t('undo.closeOne')
    : t('undo.close', { count: tabCount });

  const handleUndo = () => {
    void undoRecord(activeToast.id);
  };

  // 当批量操作栏可见时，UndoToast 上移避免重叠
  // BatchActionBar 高度约 44px + bottom 24px，需额外间距 8px
  const batchBarVisible = selectionMode && selectedIds.size > 0;
  return (
    <div
      role="alert"
      aria-live="polite"
      className={`${styles['app-undo-toast']}${batchBarVisible ? ` ${styles['is-lifted']}` : ''}`}
    >
      <div className={styles['app-undo-toast__row']}>
        <span className={styles['app-undo-toast__title']} title={mainLabel}>
          {mainLabel}
        </span>

        {isArchive && (
          <Button
            type="default"
            shape="round"
            size="small"
            icon={<Archive size={ICON_SIZE.DEFAULT} />}
            onClick={() => openArchivePanel(activeToast.archivedSessionId)}
          >
            {t('activity.viewArchive')}
          </Button>
        )}

        <Button
          type="primary"
          shape="round"
          size="small"
          icon={<Undo2 size={ICON_SIZE.MEDIUM} />}
          onClick={handleUndo}
        >
          {t('undo.action')}
        </Button>

        <Button
          type="text"
          shape="circle"
          size="small"
          icon={<X size={ICON_SIZE.MEDIUM} />}
          onClick={dismissToast}
          aria-label="Dismiss"
        />
      </div>
      {activeToast.subNote !== undefined && activeToast.subNote !== '' && (
        <span className={styles['app-undo-toast__note']}>
          {activeToast.subNote}
        </span>
      )}
    </div>
  );
}
