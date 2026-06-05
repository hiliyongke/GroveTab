/**
 * PanelStack —— 面板栈状态管理
 *
 * 替代 use-panel-state.ts 的 6 个独立 useState，统一管理所有浮层面板。
 *
 * 核心设计：
 *   - 使用 PanelDescriptor 栈（数组），支持嵌套面板
 *   - 操作：push / pop / replace / clear
 *   - 栈顶为当前活跃面板
 *   - 与 URL Hash 路由双向同步
 *     当前仅路由→面板栈单向生效，面板关闭时未清除 URL hash）
 */

import { create } from "zustand";
import type { PanelId } from "@/shared/routing";

// ── 类型 ──────────────────────────────────────────────────────────────────────

/** 面板描述符 */
export interface PanelDescriptor {
  /** 面板唯一 ID */
  id: PanelId;
  /** 面板子 ID（如 settings 的 about / appearance / behavior / system） */
  subId?: string;
  /** 面板上下文数据（任意） */
  context?: unknown;
}

/** PanelStack 操作方法 */
export interface PanelStackActions {
  /** 将面板推入栈顶（打开面板） */
  push: (panel: PanelDescriptor) => void;
  /** 弹出栈顶面板（关闭当前面板），返回弹出的面板或 null */
  pop: () => PanelDescriptor | null;
  /** 替换栈顶面板 */
  replace: (panel: PanelDescriptor) => void;
  /** 清空整个面板栈 */
  clear: () => void;
  /** 关闭指定 ID 的面板（从栈中移除） */
  close: (panelId: PanelId) => void;
  /** 检查面板是否在栈中 */
  isOpen: (panelId: PanelId) => boolean;
  /** 获取栈顶面板 */
  getTop: () => PanelDescriptor | null;
  /** 获取面板栈深度 */
  getDepth: () => number;
}

/** PanelStack 完整 Store 类型 */
export type PanelStackStore = {
  /** 面板栈（栈底 → 栈顶） */
  stack: PanelDescriptor[];
} & PanelStackActions;

// ── Store 创建 ────────────────────────────────────────────────────────────────

export const usePanelStackStore = create<PanelStackStore>((set, get) => ({
  stack: [],

  push: (panel: PanelDescriptor) => {
    set((state) => {
      // 如果面板已在栈中，先移除旧的（避免重复）
      const filtered = state.stack.filter((p) => p.id !== panel.id);
      return { stack: [...filtered, panel] };
    });
  },

  pop: () => {
    const { stack } = get();
    if (stack.length === 0) return null;
    const top = stack[stack.length - 1];
    set({ stack: stack.slice(0, -1) });
    return top ?? null;
  },

  replace: (panel: PanelDescriptor) => {
    set((state) => {
      const base = state.stack.slice(0, -1);
      // 移除栈中已有的同 ID 面板
      const filtered = base.filter((p) => p.id !== panel.id);
      return { stack: [...filtered, panel] };
    });
  },

  clear: () => {
    set({ stack: [] });
  },

  close: (panelId: PanelId) => {
    set((state) => ({
      stack: state.stack.filter((p) => p.id !== panelId),
    }));
  },

  isOpen: (panelId: PanelId) => {
    return get().stack.some((p) => p.id === panelId);
  },

  getTop: (): PanelDescriptor | null => {
    const { stack } = get();
    return stack.length > 0 ? (stack[stack.length - 1] ?? null) : null;
  },

  getDepth: () => {
    return get().stack.length;
  },
}));
