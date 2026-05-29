/**
 * useKeyboardShortcuts — 全局键盘快捷键管理 Hook
 *
 * 提供统一的键盘快捷键支持：
 * - ⌘1-9：切换 7 个视图
 * - ↑↓：在标签列表中导航
 * - Space：勾选/取消勾选标签
 * - Delete：关闭选中标签
 * - Esc：取消选择/关闭弹窗
 */

import { useEffect, useCallback, useRef } from "react";

export type ViewType = "tabs" | "timeline" | "tabgroup" | "window" | "kanban" | "frequency" | "archive";

export interface KeyboardShortcutsOptions {
  /** 当前激活的视图 */
  activeView: ViewType;
  /** 切换视图回调 */
  onSwitchView: (view: ViewType) => void;
  /** 导航到上一个标签 */
  onNavigateUp: () => void;
  /** 导航到下一个标签 */
  onNavigateDown: () => void;
  /** 勾选/取消勾选当前标签 */
  onToggleSelect: () => void;
  /** 关闭选中标签 */
  onCloseSelected: () => void;
  /** 取消选择/关闭弹窗 */
  onCancel: () => void;
  /** 是否启用快捷键 */
  enabled?: boolean;
  /** 当前是否正在编辑（如 Input 聚焦时禁用） */
  isEditing?: boolean;
}

const VIEW_ORDER: ViewType[] = ["tabs", "timeline", "tabgroup", "window", "kanban", "frequency", "archive"];

/**
 * 全局键盘快捷键管理 Hook
 *
 * @example
 * ```tsx
 * useKeyboardShortcuts({
 *   activeView: currentView,
 *   onSwitchView: setCurrentView,
 *   onNavigateUp: () => navigateTab(-1),
 *   onNavigateDown: () => navigateTab(1),
 *   onToggleSelect: toggleCurrentTab,
 *   onCloseSelected: closeSelectedTabs,
 *   onCancel: clearSelection,
 * });
 * ```
 */
export function useKeyboardShortcuts({
  activeView,
  onSwitchView,
  onNavigateUp,
  onNavigateDown,
  onToggleSelect,
  onCloseSelected,
  onCancel,
  enabled = true,
  isEditing = false,
}: KeyboardShortcutsOptions) {
  const callbacksRef = useRef({
    onSwitchView,
    onNavigateUp,
    onNavigateDown,
    onToggleSelect,
    onCloseSelected,
    onCancel,
  });

  // 保持回调引用最新
  useEffect(() => {
    callbacksRef.current = {
      onSwitchView,
      onNavigateUp,
      onNavigateDown,
      onToggleSelect,
      onCloseSelected,
      onCancel,
    };
  }, [onSwitchView, onNavigateUp, onNavigateDown, onToggleSelect, onCloseSelected, onCancel]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled || isEditing) return;

      const { key, metaKey, ctrlKey, altKey, shiftKey } = event;
      const hasModifier = metaKey || ctrlKey || altKey || shiftKey;

      // 忽略在输入框、文本域中的按键
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.closest('[role="textbox"]')
      ) {
        return;
      }

      // ⌘1-9：切换视图
      if ((metaKey || ctrlKey) && /^[1-7]$/.test(key)) {
        event.preventDefault();
        const viewIndex = parseInt(key, 10) - 1;
        const targetView = VIEW_ORDER[viewIndex];
        if (targetView && targetView !== activeView) {
          callbacksRef.current.onSwitchView(targetView);
        }
        return;
      }

      // Esc：取消选择/关闭弹窗
      if (key === "Escape") {
        event.preventDefault();
        callbacksRef.current.onCancel();
        return;
      }

      // 以下快捷键不需要修饰键
      if (hasModifier) return;

      // ↑：导航到上一个标签
      if (key === "ArrowUp") {
        event.preventDefault();
        callbacksRef.current.onNavigateUp();
        return;
      }

      // ↓：导航到下一个标签
      if (key === "ArrowDown") {
        event.preventDefault();
        callbacksRef.current.onNavigateDown();
        return;
      }

      // Space：勾选/取消勾选
      if (key === " ") {
        event.preventDefault();
        callbacksRef.current.onToggleSelect();
        return;
      }

      // Delete：关闭选中标签
      if (key === "Delete" || key === "Backspace") {
        event.preventDefault();
        callbacksRef.current.onCloseSelected();
        return;
      }
    },
    [enabled, isEditing, activeView]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * 获取视图对应的快捷键编号
 */
export function getViewShortcut(view: ViewType): number {
  return VIEW_ORDER.indexOf(view) + 1;
}

/**
 * 获取快捷键说明文本
 */
export function getShortcutDescription(view: ViewType): string {
  const num = getViewShortcut(view);
  const isMac = navigator.platform.toLowerCase().includes("mac");
  const modifier = isMac ? "⌘" : "Ctrl+";
  return `${modifier}${num}`;
}
