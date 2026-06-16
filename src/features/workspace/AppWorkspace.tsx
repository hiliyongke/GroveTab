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

import { useMemo, useCallback, useRef, useEffect, useState, Suspense } from "react";
import { useShallow } from "zustand/shallow";
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
import { WelcomeTour } from "./WelcomeTour";

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
  /** 跳转到归档视图 */
  onOpenArchive: () => void;
  /** 打开设置 */
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

  /* ---------- Store 数据（合并 selector 减少重渲染） ---------- */
  const { loading, tabs, tabCount } = useTabsStore(
    useShallow((s) => ({ loading: s.loading, tabs: s.tabs, tabCount: s.tabs.length })),
  );
  const { selectedIds, selectionMode, selectAll, clearSelection, exitSelectionMode } =
    useSelectionStore(
      useShallow((s) => ({
        selectedIds: s.selectedIds,
        selectionMode: s.selectionMode,
        selectAll: s.selectAll,
        clearSelection: s.clearSelection,
        exitSelectionMode: s.exitSelectionMode,
      })),
    );

  /* ---------- 派生状态 ---------- */
  const selectedTabs = useMemo(
    () => tabs.filter((tab) => selectedIds.has(tab.id)),
    [tabs, selectedIds],
  );

  /* ---------- useMemo 缓存视图组件 ---------- */
  const ViewComponent = useMemo(() => {
    const Comp = getViewComponentMap()[viewMode];
    return Comp !== undefined ? Comp : null;
  }, [viewMode]);

  // 缓存上一帧视图，避免 React 卸载/挂载导致 Suspense Spin 闪现
  const previousViewRef = useRef<{ mode: ViewMode; Comp: React.ComponentType<Record<string, never>> | null }>({ mode: viewMode, Comp: ViewComponent });
  const showingOld = previousViewRef.current.mode !== viewMode && previousViewRef.current.Comp !== null;

  useEffect(() => {
    if (ViewComponent !== null) {
      previousViewRef.current = { mode: viewMode, Comp: ViewComponent };
    }
  }, [viewMode, ViewComponent]);

  const PrevComp = previousViewRef.current.Comp;
  // 切换时：旧视图 faded out，新视图 faded in（同一 DOM 容器，React 按 type 决定复用/重建）
  const isTransitioning = showingOld && ViewComponent !== null && PrevComp !== ViewComponent;

  /* ---------- 视图切换动画：新旧并行渲染，opacity 交叉淡入淡出 ---------- */
  const viewTransitionRef = useRef<HTMLDivElement>(null);
  const [transitionPhase, setTransitionPhase] = useState<"idle" | "fading">("idle");

  // 切换时：旧视图保留 300ms 做淡出，避免 Suspense spin 闪现
  useEffect(() => {
    if (!isTransitioning || PrevComp === null) return;
    setTransitionPhase("fading");
    const id = setTimeout(() => {
      // 300ms 后清除旧视图缓存，React 卸载旧组件、挂载新组件
      previousViewRef.current = { mode: viewMode, Comp: ViewComponent };
      setTransitionPhase("idle");
    }, 300);
    return () => clearTimeout(id);
  }, [viewMode, ViewComponent, PrevComp, isTransitioning]);

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

      {/* 首次使用的多步高亮引导 */}
      <WelcomeTour open={showViewOnboarding} onClose={dismissViewOnboarding} />

      {initError !== null && (
        <Alert
          showIcon
          type="warning"
          description={initError}
          action={
            <Button  onClick={onRetryInit}>
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
              t("右键标签卡片查看更多操作"),
            ]}
            actions={[
              { text: t("查看归档列表"), onClick: onOpenArchive, type: "primary" },
              { text: t("设置"), onClick: onOpenSettings, type: "default" },
            ]}
          />
        ) : ViewComponent !== null ? (
          <div ref={viewTransitionRef} className="app-view-transition">
            {/* 过渡态：旧视图保留在 DOM 中淡出，避免白屏 */}
            {isTransitioning && PrevComp !== null && transitionPhase === "fading" && (
              <div style={{ position: "absolute", inset: 0, opacity: 0.3, transition: "opacity 250ms ease", pointerEvents: "none" }}>
                <PrevComp />
              </div>
            )}
            {/* 新视图：正常渲染，无 loading */}
            <div style={isTransitioning && transitionPhase === "fading" ? { opacity: 0.7, transition: "opacity 250ms ease" } : { opacity: 1 }}>
              <Suspense fallback={null}>
                <ViewComponent />
              </Suspense>
            </div>
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
