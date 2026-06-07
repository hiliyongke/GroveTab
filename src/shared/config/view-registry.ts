/**
 * 视图注册中心（ViewRegistry）
 *
 * 替代 App.tsx 中的硬编码视图条件渲染链。
 * 新增视图只需调用 registerView()，App.tsx 自动同步。
 *
 * 视图组件支持 React.lazy 懒加载，按需拆分 chunk。
 * getViewComponentMap() 使用 module-level 缓存，仅在 register/unregister 时失效重建。
 */

import type { ComponentType } from "react";
import type { ViewMode } from "@/shared/config/views";
import { useFeatureFlagStore } from "@/shared/store/feature-flag-slice";

/** 视图注册条目 */
export interface ViewRegistration {
  id: ViewMode;
  /** 视图组件（支持 React.lazy 包裹的组件） */
  component: ComponentType;
  /** 是否默认启用（部分视图可能需要权限才显示） */
  enabled?: boolean;
  /** 排序权重（越小越靠前） */
  order?: number;
}

type ViewComponentMap = Record<ViewMode, ComponentType>;

/** 注册表存储 */
const registry = new Map<ViewMode, ViewRegistration>();

/** 组件映射缓存，仅在 register/unregister 时重建。 */
let componentMapCache: ViewComponentMap | null = null;

function invalidateCache(): void {
  componentMapCache = null;
}

/**
 * 检测是否为开发者模式（unpacked extension）。
 * 未发布的扩展没有 update_url，仅 developer load 时会缺失该字段。
 */
function isDevMode(): boolean {
  try {
    return !("update_url" in chrome.runtime.getManifest());
  } catch {
    return false;
  }
}

/**
 * 注册一个视图
 *
 * @param reg 视图注册信息
 */
export function registerView(reg: ViewRegistration): void {
  // tabgroup/window/timeline 已合并到 UnifiedTabsView 子维度，不再注册为顶层视图
  if (reg.id === "tabgroup" || reg.id === "window" || reg.id === "timeline") {
    return;
  }

  // Guard: archive_trash_merged 为 false 时，sessions 不注册
  if (reg.id === "sessions") {
    const flags = useFeatureFlagStore.getState().flags;
    if (flags.archive_trash_merged === false) {
      return;
    }
  }

  // Guard: devtools 仅开发者模式可见
  if (reg.id === "devtools" && !isDevMode()) {
    return;
  }

  registry.set(reg.id, {
    enabled: true,
    order: 99,
    ...reg,
  });
  invalidateCache();
}

/**
 * 批量注册视图
 */
export function registerViews(regs: ViewRegistration[]): void {
  for (const reg of regs) registerView(reg);
  invalidateCache();
}

/**
 * 取消注册一个视图
 */
export function unregisterView(id: ViewMode): void {
  registry.delete(id);
  invalidateCache();
}

/**
 * 获取单个视图的注册信息
 */
export function getViewRegistration(id: ViewMode): ViewRegistration | undefined {
  return registry.get(id);
}

/**
 * 获取所有已注册且启用的视图，按 order 排序
 */
export function getEnabledViews(): ViewRegistration[] {
  return Array.from(registry.values())
    .filter((r) => r.enabled !== false)
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

/**
 * 获取单个视图组件（供组合视图如 SessionsView 使用）
 */
export function getViewComponent(id: ViewMode): ComponentType | undefined {
  return registry.get(id)?.component;
}
/**
 * 获取视图组件映射表（供 App.tsx 渲染用）
 */
export function getViewComponentMap(): ViewComponentMap {
  if (componentMapCache !== null) return componentMapCache;
  const map = {} as ViewComponentMap;
  for (const [id, reg] of registry) {
    if (reg.enabled !== false) {
      map[id] = reg.component;
    }
  }
  componentMapCache = map;
  return map;
}
