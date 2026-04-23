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
import { Button, Space, Badge, theme } from 'antd';
import {
  CloseOutlined,
  StopOutlined,
  SaveOutlined,
  CloseCircleOutlined,
  SelectOutlined,
} from '@ant-design/icons';
import { useSelectionStore, useTabsStore } from '@/store';
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
  const discardTab = useTabsStore((s) => s.discardTab);
  const tabs = useTabsStore((s) => s.tabs);
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

  /** 批量休眠 */
  const handleBatchDiscard = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    // 逐个休眠——discardTab 是单个操作
    let failed = 0;
    for (const id of ids) {
      try {
        await discardTab(id);
      } catch {
        failed++;
      }
    }
    if (failed > 0) {
      feedback.error(translate('tabs.discardFailed'));
    }
    resetAfterBatch();
  }, [selectedIds, discardTab, resetAfterBatch]);

  /** 批量归档：把选中的标签页保存为会话后关闭 */
  const handleBatchArchive = useCallback(async () => {
    const ids = Array.from(selectedIds);
    const selectedTabs = tabs.filter((tab) => ids.includes(tab.id));
    if (selectedTabs.length === 0) return;

    try {
      // 动态导入 nanoid（与 SW 保持一致）
      const { nanoid } = await import('nanoid');
      const session = {
        id: nanoid(10),
        name: `批量归档 ${new Date().toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
        createdAt: Date.now(),
        tabs: selectedTabs.map((tab) => ({
          url: tab.url,
          title: tab.title,
          favIconUrl: tab.favIconUrl,
          hostname: tab.hostname,
          pinned: tab.pinned,
        })),
        tabCount: selectedTabs.length,
      };

      // 保存到 storage
      const result = await chrome.storage.local.get('canopy_sessions');
      const sessions: unknown[] = Array.isArray(result.canopy_sessions) ? result.canopy_sessions : [];
      sessions.unshift(session);
      await chrome.storage.local.set({ canopy_sessions: sessions });

      // 关闭已归档标签
      await closeMultipleTabs(ids);
      feedback.success(translate('archive.archivedOk', { count: selectedTabs.length }));
      resetAfterBatch();
    } catch (err) {
      feedback.error(translate('archive.archiveFailed'), err);
    }
  }, [selectedIds, tabs, closeMultipleTabs, resetAfterBatch]);

  // 非多选模式或无选中时不渲染
  if (!selectionMode || count === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 20px',
        borderRadius: token.borderRadiusLG * 2,
        background: `${token.colorBgElevated} / 0.92`,
        backdropFilter: 'blur(12px)',
        boxShadow: token.boxShadowSecondary,
        border: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Badge count={count} size="small" color={token.colorPrimary}>
        <SelectOutlined style={{ fontSize: 16, color: token.colorPrimary }} />
      </Badge>

      <Space size={6}>
        <Button
          size="small"
          danger
          icon={<CloseOutlined style={{ fontSize: 12 }} />}
          onClick={handleBatchClose}
        >
          {t('batch.close')}
        </Button>

        <Button
          size="small"
          icon={<StopOutlined style={{ fontSize: 12 }} />}
          onClick={handleBatchDiscard}
        >
          {t('batch.discard')}
        </Button>

        <Button
          size="small"
          type="primary"
          icon={<SaveOutlined style={{ fontSize: 12 }} />}
          onClick={handleBatchArchive}
        >
          {t('batch.archive')}
        </Button>

        <Button
          size="small"
          type="text"
          icon={<CloseCircleOutlined style={{ fontSize: 12 }} />}
          onClick={exitSelectionMode}
        >
          {t('batch.cancel')}
        </Button>
      </Space>
    </div>
  );
}
