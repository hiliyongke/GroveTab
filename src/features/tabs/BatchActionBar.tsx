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
import { Button, Badge, Tooltip, theme } from 'antd';
import {
  X,
  Moon,
  Save,
  XCircle,
  Pointer,
} from 'lucide-react';
import { useSelectionStore, useTabsStore } from '@/store';
import { iconColor } from '@/shared/utils/icon-colors';
import { archiveSelectedTabs } from '@/services';
import { useT } from '@/shared/i18n';
import { feedback } from '@/shared/ui/feedback';
import { translate } from '@/shared/i18n/core';

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

  return (
    <div
      className="canopy-batch-bar canopy-surface-elevated"
      role="toolbar"
      aria-label={t('selection.title')}
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px 8px 16px',
      }}
    >
      {/* 计数标签组：图标 + 选中数 */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          paddingRight: 2,
          color: token.colorText,
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        <Badge
          count={count}
          size="small"
          color={token.colorPrimary}
          offset={[0, 0]}
        >
          <Pointer size={16} style={{ color: token.colorPrimary, display: 'block' }} />
        </Badge>
        <span style={{ color: token.colorTextSecondary, fontSize: 12.5 }}>
          {t('selection.title')}
        </span>
      </div>

      <div className="canopy-divider-soft" aria-hidden />

      {/* 操作组：危险→中性→主要，视觉权重递增 */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Tooltip title={t('batch.close')} placement="top">
          <Button
            size="small"
            danger
            icon={<X size={13} style={{ color: iconColor('close', token) }} />}
            onClick={() => { void handleBatchClose(); }}
          >
            {t('batch.close')}
          </Button>
        </Tooltip>

        <Tooltip title={t('batch.discard')} placement="top">
          <Button
            size="small"
            icon={<Moon size={13} style={{ color: iconColor('discard', token) }} />}
            onClick={() => { void handleBatchDiscard(); }}
          >
            {t('batch.discard')}
          </Button>
        </Tooltip>

        <Tooltip title={t('batch.archive')} placement="top">
          <Button
            size="small"
            type="primary"
            icon={<Save size={13} />}
            onClick={() => { void handleBatchArchive(); }}
          >
            {t('batch.archive')}
          </Button>
        </Tooltip>
      </div>

      <div className="canopy-divider-soft" aria-hidden />

      <Tooltip title={t('batch.cancel')} placement="top">
        <Button
          size="small"
          type="text"
          icon={<XCircle size={13} style={{ color: iconColor('close', token) }} />}
          onClick={exitSelectionMode}
          aria-label={t('batch.cancel')}
        />
      </Tooltip>
    </div>
  );
}
