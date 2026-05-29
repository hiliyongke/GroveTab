/**
 * usePanelStack —— 面板栈 React Hook
 *
 * 职责：
 *   1. 封装 PanelStackStore 的便捷操作
 *   2. 全局 ESC 键监听：逐级 pop 面板
 *   3. 与 URL Hash 路由同步（面板栈变更 → 更新 hash）
 *   4. 提供面向组件的 API（open / close / isOpen）
 */

import { useEffect, useCallback, useMemo } from "react";
import { usePanelStackStore, type PanelDescriptor } from "./panel-stack-store";
import type { PanelId } from "@/shared/routing";
import { getRouter } from "@/shared/routing";

// ── Hook 返回类型 ─────────────────────────────────────────────────────────────

export interface PanelStackAPI {
  /** 当前面板栈 */
  stack: PanelDescriptor[];
  /** 栈顶面板 */
  topPanel: PanelDescriptor | null;
  /** 栈深度 */
  depth: number;
  /** 推入面板 */
  push: (panel: PanelDescriptor) => void;
  /** 弹出栈顶 */
  pop: () => PanelDescriptor | null;
  /** 替换栈顶 */
  replace: (panel: PanelDescriptor) => void;
  /** 清空栈 */
  clear: () => void;
  /** 关闭指定面板 */
  close: (panelId: PanelId) => void;
  /** 判断面板是否打开 */
  isOpen: (panelId: PanelId) => boolean;
  /** 便捷方法：打开搜索面板 */
  openSearch: () => void;
  /** 便捷方法：打开设置面板 */
  openSettings: (subId?: string) => void;
  /** 便捷方法：打开洞察面板 */
  openInsights: () => void;
  /** 便捷方法：打开历史面板 */
  openHistory: () => void;
  /** 便捷方法：打开回收站面板 */
  openTrash: () => void;
  /** 便捷方法：打开命令面板 */
  openCommandPalette: () => void;
}

// ── Hook 实现 ──────────────────────────────────────────────────────────────────

export function usePanelStack(): PanelStackAPI {
  const stack = usePanelStackStore((s) => s.stack);
  const push = usePanelStackStore((s) => s.push);
  const pop = usePanelStackStore((s) => s.pop);
  const replace = usePanelStackStore((s) => s.replace);
  const clear = usePanelStackStore((s) => s.clear);
  const close = usePanelStackStore((s) => s.close);
  const isOpen = usePanelStackStore((s) => s.isOpen);

  const topPanel = useMemo(
    () => (stack.length > 0 ? stack[stack.length - 1] ?? null : null),
    [stack],
  );
  const depth = stack.length;

  // ── 全局 ESC 键监听 ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;

      // 如果有打开的面板，pop 栈顶（逐级关闭）
      const currentStack = usePanelStackStore.getState().stack;
      if (currentStack.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        usePanelStackStore.getState().pop();
      }
    };

    // 使用 capture 阶段，确保在 antd Modal 等组件的 ESC 处理之前拦截
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, []);

  // ── 面板栈 → URL Hash 同步 ──────────────────────────────────────────────
  useEffect(() => {
    const router = getRouter();
    const top = stack[stack.length - 1];

    if (top) {
      // 栈非空：将栈顶面板同步到 hash
      router.navigate({ panelId: top.id, subId: top.subId }, { replace: true });
    } else {
      // 栈空：清除 hash 中的面板段
      router.navigate({ panelId: undefined, subId: undefined }, { replace: true });
    }
  }, [stack]);

  // ── URL Hash → 面板栈 同步（监听 hashchange） ───────────────────────────
  useEffect(() => {
    const router = getRouter();
    const unsubscribe = router.subscribe((event) => {
      const { panelId, subId } = event.route;
      const currentTop = usePanelStackStore.getState().stack.at(-1);

      // hash 中的面板与栈顶不一致时，同步到栈
      if (panelId && currentTop?.id !== panelId) {
        usePanelStackStore.getState().push({ id: panelId as PanelId, subId });
      } else if (!panelId && currentTop) {
        // hash 中无面板但栈中有 → 清空栈（用户按了浏览器后退）
        usePanelStackStore.getState().clear();
      } else if (panelId && currentTop?.id === panelId && currentTop?.subId !== subId) {
        // 同一面板但 subId 变了（如 settings 从 appearance 切到 about）
        usePanelStackStore.getState().replace({ id: panelId, subId });
      }
    });

    return unsubscribe;
  }, []);

  // ── 便捷方法 ──────────────────────────────────────────────────────────────
  const openSearch = useCallback(() => push({ id: "search" }), [push]);
  const openSettings = useCallback(
    (subId?: string) => push({ id: "settings", subId }),
    [push],
  );
  const openInsights = useCallback(() => push({ id: "insights" }), [push]);
  const openHistory = useCallback(() => push({ id: "history" }), [push]);
  const openTrash = useCallback(() => push({ id: "trash" }), [push]);
  const openCommandPalette = useCallback(() => push({ id: "commandPalette" }), [push]);

  return {
    stack,
    topPanel,
    depth,
    push,
    pop,
    replace,
    clear,
    close,
    isOpen,
    openSearch,
    openSettings,
    openInsights,
    openHistory,
    openTrash,
    openCommandPalette,
  };
}
