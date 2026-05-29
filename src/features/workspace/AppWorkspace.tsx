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

import { useMemo, useCallback, useRef, useEffect, Suspense } from "react";
import { Spin, Alert, Button, Typography } from "antd";
import { Globe } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useTabsStore, useSelectionStore } from "@/store";
import { OnboardingCard } from "@/features/sessions/OnboardingCard";
import { TabsView } from "@/features/tabs/views/TabsView";
import { SelectionModeNotice } from "@/features/tabs/selection/SelectionModeNotice";
import { FeatureEmptyState } from "@/shared/ui/FeatureEmptyState";
import { useT } from "@/shared/i18n";
import { useViewOnboarding } from "@/shared/hooks";
import type { ViewMode } from "@/shared/config/views";
import { getViewComponentMap } from "@/shared/config/view-registry";
import { ViewOnboardingModal } from "./ViewOnboardingModal";

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

  // 视图引导弹窗状态
  const { showViewOnboarding, dismissViewOnboarding } = useViewOnboarding(checked);

  /* ---------- Store 数据 ---------- */
  const loading = useTabsStore((s) => s.loading);
  const tabs = useTabsStore((s) => s.tabs);
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const selectionMode = useSelectionStore((s) => s.selectionMode);
  const selectAll = useSelectionStore((s) => s.selectAll);
  const clearSelection = useSelectionStore((s) => s.clearSelection);
  const exitSelectionMode = useSelectionStore((s) => s.exitSelectionMode);

  /* ---------- 派生状态 ---------- */
  const selectedTabs = useMemo(
    () => tabs.filter((tab) => selectedIds.has(tab.id)),
    [tabs, selectedIds],
  );
  const tabCount = useMemo(() => tabs.length, [tabs]);

  /* ---------- useMemo 缓存视图组件 ---------- */
  const ViewComponent = useMemo(() => {
    const Comp = getViewComponentMap()[viewMode];
    return Comp !== undefined ? Comp : null;
  }, [viewMode]);

  /* ---------- 视图切换动画重触发（替代 key={viewMode} 的 DOM 重建） ----------
   * 原方案用 key={viewMode} 导致整个 wrapper div 被销毁重建，视觉上像"刷新"，
   * 且丢失 app-content-shell 内的滚动位置。
   * 新方案：保留 wrapper div，通过 force reflow 手动重启 CSS animation。
   */
  const viewTransitionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = viewTransitionRef.current;
    if (!el) return;
    // 短暂移除动画类，下一帧恢复，触发重新播放
    el.classList.remove("app-view-transition");
    void el.offsetHeight; // force reflow
    el.classList.add("app-view-transition");
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
          <Typography.Text type="secondary">{t("加载标签页中...")}</Typography.Text>
        </div>
      </div>
    );
  }

  /* ---------- Workspace 内容渲染 ---------- */
  return (
    <>
      {showOnboarding && <OnboardingCard onDismiss={onDismissOnboarding} />}

      {/* 视图引导弹窗 */}
      <ViewOnboardingModal open={showViewOnboarding} onClose={dismissViewOnboarding} />

      {initError !== null && (
        <Alert
          showIcon
          type="warning"
          description={initError}
          action={
            <Button size="small" onClick={onRetryInit}>
              {t("重试")}
            </Button>
          }
          className="app-init-alert"
        />
      )}

      {viewMode !== "archive" && selectionMode && (
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
              <Typography.Text type="secondary">{t("加载标签页中...")}</Typography.Text>
            </div>
          </div>
        ) : tabCount === 0 && viewMode !== "archive" ? (
          <FeatureEmptyState
            title={t("没有打开的标签页")}
            description={t("打开一些网页，然后回到这里查看")}
            icon={<Globe size={ICON_SIZE.XXLARGE} />}
            hints={[
              t("按 Cmd+K 可快速搜索标签"),
              t("点击归档按钮可保存当前所有标签"),
              t("tabs.emptyHint3"),
            ]}
            actions={[
              { text: t("查看归档列表"), onClick: onOpenArchive, type: "primary" },
              { text: t("设置"), onClick: onOpenSettings, type: "default" },
            ]}
          />
        ) : ViewComponent !== null ? (
          <div ref={viewTransitionRef} className="app-view-transition">
            <Suspense
              fallback={
                <div className="app-suspense-fallback">
                  <Spin />
                </div>
              }
            >
              <ViewComponent />
            </Suspense>
          </div>
        ) : (
          <div ref={viewTransitionRef} className="app-view-transition">
            <TabsView />
          </div>
        )}
      </section>
    </>
  );
}
