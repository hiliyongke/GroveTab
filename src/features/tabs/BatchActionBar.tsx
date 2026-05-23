/**
 * BatchActionBar — 多选批量操作浮动栏（antd 版）
 *
 * 设计：
 *   - 固定在页面底部居中，毛玻璃背景
 *   - 显示选中数量 + 操作按钮（关闭/休眠/归档/取消选择）
 *   - 使用 antd Button + Badge + Space，视觉与全站一致
 *   - 操作执行后自动清空选中并退出多选模式
 */

import { useCallback } from 'react';
import { Button, Badge, Tooltip, Popconfirm, Divider, theme } from 'antd';
import {
  X,
  Moon,
  Save,
  Pointer,
  XCircle,
} from 'lucide-react';
import { cssVars } from '@/shared/utils/css-vars';
import { useSelectionStore, useTabsStore } from '@/store';
import { iconColor } from '@/shared/utils/icon-colors';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { archiveSelectedTabs } from '@/services';
import { useT } from '@/shared/i18n';
import { feedback } from '@/shared/ui/feedback';
import { translate } from '@/shared/i18n/core';
import { Z } from '@/shared/config/z-index';
import styles from './styles/views.module.less';

/**
 * 批量操作浮动栏
 *
 * 仅在 selectionMode=true 且 selectedIds 非空时渲染。
 * 固定在视口底部居中，z-index 高于内容区。
 */
export function BatchActionBar() {
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const selectionMode = useSelectionStore((s) => s.selectionMode);
  const resetAfterBatch = useSelectionStore((s) => s.resetAfterBatch);
  const exitSelectionMode = useSelectionStore((s) => s.exitSelectionMode);
  const closeMultipleTabs = useTabsStore((s) => s.closeMultipleTabs);
  const discardMultipleTabs = useTabsStore((s) => s.discardMultipleTabs);
  const { t } = useT();
  const { token } = theme.useToken();

  const count = selectedIds.size;

  /** 批量关闭 */
  const handleBatchClose = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      await closeMultipleTabs(ids);
      resetAfterBatch();
    } catch {
      // store 已 toast
    }
  }, [selectedIds, closeMultipleTabs, resetAfterBatch]);

  /** 批量休眠。 */
  const handleBatchDiscard = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      await discardMultipleTabs(ids);
      resetAfterBatch();
    } catch {
      // store 已统一反馈
    }
  }, [selectedIds, discardMultipleTabs, resetAfterBatch]);

  /** 批量归档：统一走归档服务，避免直接写 storage。 */
  const handleBatchArchive = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    try {
      const { archivedCount, closedCount } = await archiveSelectedTabs(ids);
      feedback.success(translate('archive.archivedOk', { count: archivedCount }));
      if (closedCount < archivedCount) {
        feedback.warning(translate('archive.closeIncomplete', { count: archivedCount - closedCount }));
      }
      resetAfterBatch();
    } catch (err) {
      feedback.error(translate('archive.archiveFailed'), err);
    }
  }, [selectedIds, resetAfterBatch]);

  // 非多选模式或无选中时不渲染
  if (!selectionMode || count === 0) return null;

  const batchBarStyle: React.CSSProperties = cssVars({
    '--app-batch-bar-z': String(Z.batchBar),
    '--app-batch-bar-danger-icon': iconColor('close', token),
    '--app-batch-bar-discard-icon': iconColor('discard', token),
  });

  return (
    <div
      className={`${styles['app-batch-bar']} app-surface-elevated`}
      role="toolbar"
      aria-label={t('selection.title')}
      style={batchBarStyle}
    >
      {/* 计数标签组：图标 + 选中数 */}
      <div className={styles['app-batch-bar__summary']}>
        <Badge
          count={count}
          size="small"
          color={token.colorPrimary}
          offset={[0, 0]}
        >
          <Pointer size={ICON_SIZE.LARGE} className={styles['app-batch-bar__pointer']} />
        </Badge>
        <span className={styles['app-batch-bar__summary-copy']}>
          {t('selection.title')}
        </span>
      </div>

      <Divider type="vertical" className={styles['app-divider-soft']} aria-hidden />

      {/* 操作组：危险→中性→主要，视觉权重递增 */}
      <div className={styles['app-batch-bar__actions']}>
        <Tooltip title={t('batch.close')} placement="top">
          <Popconfirm
            title={t('batch.closeConfirm', { count })}
            onConfirm={() => { void handleBatchClose(); }}
            okText={t('batch.close')}
            cancelText={t('archive.cancel')}
            okButtonProps={{ danger: true, size: 'small' }}
            cancelButtonProps={{ size: 'small' }}
          >
            <Button
              size="small"
              danger
              icon={<X size={ICON_SIZE.DEFAULT} className={styles['app-batch-bar__danger-icon']} />}
            >
              {t('batch.close')}
            </Button>
          </Popconfirm>
        </Tooltip>

        <Tooltip title={t('batch.discard')} placement="top">
          <Button
            size="small"
            icon={<Moon size={ICON_SIZE.DEFAULT} className={styles['app-batch-bar__secondary-icon']} />}
            onClick={() => { void handleBatchDiscard(); }}
          >
            {t('batch.discard')}
          </Button>
        </Tooltip>

        <Tooltip title={t('batch.archive')} placement="top">
          <Popconfirm
            title={t('batch.archiveConfirm', { count })}
            onConfirm={() => { void handleBatchArchive(); }}
            okText={t('batch.archive')}
            cancelText={t('archive.cancel')}
            okButtonProps={{ size: 'small' }}
            cancelButtonProps={{ size: 'small' }}
          >
            <Button
              size="small"
              type="primary"
              icon={<Save size={ICON_SIZE.DEFAULT} />}
            >
              {t('batch.archive')}
            </Button>
          </Popconfirm>
        </Tooltip>
      </div>

<div className={styles['app-divider-soft']} aria-hidden />

      <Tooltip title={t('batch.cancel')} placement="top">
        <Button
          size="small"
          type="text"
          icon={<XCircle size={ICON_SIZE.DEFAULT} className={styles['app-batch-bar__danger-icon']} />}
          onClick={exitSelectionMode}
          aria-label={t('batch.cancel')}
        />
      </Tooltip>
    </div>
  );
}
