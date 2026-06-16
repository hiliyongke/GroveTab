/**
 * useUrlSync —— URL Hash 路由与 React 组件双向同步 Hook
 *
 * 职责：
 *   1. 订阅 HashRouter 的路由变更 → 更新 React 状态
 *   2. 提供 navigate / openPanel / closePanel / switchView 等 API
 *   3. 在组件卸载时自动清理订阅
 *
 * 使用方式：
 *   const { route, navigate, openPanel, closePanel, switchView } = useUrlSync();
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getRouter,
  parseHash,
  type RouteDescriptor,
  type NavigationSource,
} from "./hash-router";
import { handleRouteTelemetry } from "./route-telemetry";
import type { ViewMode } from "@/shared/config/views";
import type { PanelId } from "./hash-router";
import { track } from "@/shared/utils/metrics";

export interface UrlSyncAPI {
  /** 当前路由描述符 */
  route: RouteDescriptor;
  /** 程序化导航到任意路由 */
  navigate: (route: Partial<RouteDescriptor>, options?: { replace?: boolean }) => void;
  /** 打开面板（push 模式） */
  openPanel: (panelId: PanelId, subId?: string) => void;
  /** 关闭面板（清除 panelId） */
  closePanel: () => void;
  /** 切换视图 */
  switchView: (viewId: ViewMode) => void;
  /** 替换当前路由（不产生历史记录） */
  replace: (route: Partial<RouteDescriptor>) => void;
  /** 返回上一页 */
  back: () => void;
  /** 上次导航来源 */
  lastSource: NavigationSource | null;
}

/**
 * useUrlSync —— 将 URL Hash 路由同步到 React 状态
 */
export function useUrlSync(): UrlSyncAPI {
  const router = useMemo(() => getRouter(), []);
  const [route, setRoute] = useState<RouteDescriptor>(() => router.getRoute());
  const [lastSource, setLastSource] = useState<NavigationSource | null>(null);

  // 启动路由器 + 订阅变更
  useEffect(() => {
    router.start();

    const unsubscribe = router.subscribe((event) => {
      setRoute(event.route);
      setLastSource(event.source);

      // 路由埋点
      handleRouteTelemetry(event);

      // 埋点：视图切换
      if (event.previous?.viewId !== event.route.viewId) {
        void track("route_view_change", {
          from: event.previous?.viewId ?? "none",
          to: event.route.viewId ?? "none",
          source: event.source,
        });
      }

      // 埋点：面板打开/关闭
      if (event.previous?.panelId !== event.route.panelId) {
        void track("route_panel_change", {
          from: event.previous?.panelId ?? "none",
          to: event.route.panelId ?? "none",
          source: event.source,
        });
      }
    });

    return () => {
      unsubscribe();
      router.stop();
    };
  }, [router]);

  const navigate = useCallback(
    (partial: Partial<RouteDescriptor>, options?: { replace?: boolean }) => {
      router.navigate(partial, options);
    },
    [router],
  );

  const openPanel = useCallback(
    (panelId: PanelId, subId?: string) => {
      router.navigate({ panelId, subId });
    },
    [router],
  );

  const closePanel = useCallback(() => {
    router.navigate({ panelId: undefined, subId: undefined });
  }, [router]);

  const switchView = useCallback(
    (viewId: ViewMode) => {
      router.navigate({ viewId });
    },
    [router],
  );

  const replace = useCallback(
    (partial: Partial<RouteDescriptor>) => {
      router.navigate(partial, { replace: true });
    },
    [router],
  );

  const back = useCallback(() => {
    router.back();
  }, [router]);

  return {
    route,
    navigate,
    openPanel,
    closePanel,
    switchView,
    replace,
    back,
    lastSource,
  };
}

/**
 * 工具函数：从 RouteDescriptor 生成初始路由
 * 用于 SSR / 初始渲染时同步 hash
 */
export function getInitialRoute(): RouteDescriptor {
  if (typeof window === "undefined") return {};
  return parseHash(window.location.hash);
}
