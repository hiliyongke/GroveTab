/**
 * 视图注册中心（ViewRegistry）
 *
 * 替代 App.tsx 中的硬编码视图条件渲染链。
 * 新增视图只需调用 registerView()，App.tsx 自动同步。
 *
 * 视图组件支持 React.lazy 懒加载，按需拆分 chunk 减小首屏体积。
 */

import type { ComponentType } from 'react';
import type { ViewMode } from '@/shared/config/views';

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

/**
 * 注册一个视图
 *
 * @param reg 视图注册信息
 */
export function registerView(reg: ViewRegistration): void {
  registry.set(reg.id, {
    enabled: true,
    order: 99,
    ...reg,
  });
}

/**
 * 批量注册视图
 */
export function registerViews(regs: ViewRegistration[]): void {
  for (const reg of regs) registerView(reg);
}

/**
 * 取消注册一个视图
 */
export function unregisterView(id: ViewMode): void {
  registry.delete(id);
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
 * 获取视图组件映射表（供 App.tsx 渲染用）
 *
 * 返回 Record<ViewMode, ComponentType>，在渲染时用 viewMode 查找对应组件。
 */
export function getViewComponentMap(): ViewComponentMap {
  const map = {} as ViewComponentMap;
  for (const [id, reg] of registry) {
    if (reg.enabled !== false) {
      map[id] = reg.component;
    }
  }
  return map;
}

