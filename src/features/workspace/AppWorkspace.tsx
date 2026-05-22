/**
 * AppWorkspace —— workspace 模式下的主内容区渲染组件
 *
 * 从 AppContent 中拆分而来，职责：
 *   - 渲染 OnboardingCard（首次引导）
 *   - 渲染 SelectionModeNotice（多选模式提示）
 *   - 渲染 TidySuggestionBar（整理建议栏）
 *   - 渲染主视图内容（loading / empty / view component）
 *
 * 设计原则：纯渲染组件，所有状态由父组件 AppContent 通过 props 传入。
 */

import { useMemo, useCallback, Suspense } from 'react';
import { Spin, Alert, Button, Typography } from 'antd';
import { Globe } from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useTabsStore, useSelectionStore } from '@/store';
import { OnboardingCard } from '@/features/sessions/OnboardingCard';
import { DomainGroupView } from '@/features/tabs/DomainGroupView';
import { SelectionModeNotice } from '@/features/tabs/SelectionModeNotice';
import { FeatureEmptyState } from '@/shared/ui/FeatureEmptyState';
import { useT } from '@/shared/i18n';
import type { ViewMode } from '@/shared/config/views';
import { getViewComponentMap } from '@/shared/config/view-registry';

interface AppWorkspaceProps {
  /** 初始化是否完成 */
  checked: boolean;
  /** 初始化错误信息 */
  initError: string | null;
  /** 是否显示新手引导 */
  showOnboarding: boolean;
  /** 当前视图模式 */
  viewMode: ViewMode;
  /** 关闭新手引导回调 */
  onDismissOnboarding: () => void;
  /** 重试初始化回调 */
  onRetryInit: () => void;
  /** 打开归档面板回调 */
  onOpenArchive: () => void;
  /** 打开设置面板回调 */
  onOpenSettings: () => void;
}

export function AppWorkspace({
  checked,
  initError,
  showOnboarding,
  viewMode,
  onDismissOnboarding,
  onRetryInit,
  onOpenArchive,
  onOpenSettings,
}: AppWorkspaceProps) {
  const { t } = useT();

  /* ---------- Store 数据 ---------- */
  const loading = useTabsStore((s) => s.loading);
  const tabs = useTabsStore((s) => s.tabs);
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const selectionMode = useSelectionStore((s) => s.selectionMode);
  const selectAll = useSelectionStore((s) => s.selectAll);
  const clearSelection = useSelectionStore((s) => s.clearSelection);
  const exitSelectionMode = useSelectionStore((s) => s.exitSelectionMode);

  /* ---------- 派生状态 ---------- */
  const selectedTabs = useMemo(() => tabs.filter((tab) => selectedIds.has(tab.id)), [tabs, selectedIds]);
  const tabCount = useMemo(() => tabs.length, [tabs]);

  /* ---------- useMemo 缓存视图组件 ---------- */
  const ViewComponent = useMemo(() => {
    const Comp = getViewComponentMap()[viewMode];
    return Comp !== undefined ? Comp : null;
  }, [viewMode]);

  /* ---------- 事件处理 ---------- */
  const handleSelectAllTabs = useCallback(() => {
    selectAll(tabs.map((tab) => tab.id));
  }, [selectAll, tabs]);

  /* ---------- 加载中 ---------- */
  if (!checked) {
    return (
      <div className="app-page-loading">
        <div className="app-page-loading-inner">
          <Spin />
          <Typography.Text type="secondary">{t('tabs.loading')}</Typography.Text>
        </div>
      </div>
    );
  }

  /* ---------- Workspace 内容渲染 ---------- */
  return (
    <>
      {showOnboarding && <OnboardingCard onDismiss={onDismissOnboarding} />}

      {initError !== null && (
        <Alert
          showIcon
          type="warning"
          description={initError}
          action={
            <Button size="small" onClick={onRetryInit}>
              {t('context.retry')}
            </Button>
          }
          className="app-init-alert"
        />
      )}

      {viewMode !== 'archive' && selectionMode && (
        <SelectionModeNotice
          selectedTabs={selectedTabs}
          onSelectAll={handleSelectAllTabs}
          onClearSelection={clearSelection}
          onExitSelectionMode={exitSelectionMode}
        />
      )}

      <section className="app-workspace-section">
        {loading ? (
          <div className="app-workspace-loading">
            <div className="app-workspace-loading-inner">
              <Spin />
              <Typography.Text type="secondary">{t('tabs.loading')}</Typography.Text>
            </div>
          </div>
        ) : tabCount === 0 && viewMode !== 'archive' ? (
          <FeatureEmptyState
            title={t('tabs.empty')}
            description={t('tabs.emptyHint')}
            icon={<Globe size={ICON_SIZE.XXLARGE} />}
            hints={[
              t('tabs.emptyHint1'),
              t('tabs.emptyHint2'),
              t('tabs.emptyHint3'),
            ]}
            actions={[
              { text: t('dashboard.openArchives'), onClick: onOpenArchive, type: 'primary' },
              { text: t('header.settings'), onClick: onOpenSettings, type: 'default' },
            ]}
          />
        ) : ViewComponent !== null ? (
          <Suspense fallback={<div className="app-suspense-fallback"><Spin /></div>}>
            <ViewComponent />
          </Suspense>
        ) : <DomainGroupView />}
      </section>
    </>
  );
}
