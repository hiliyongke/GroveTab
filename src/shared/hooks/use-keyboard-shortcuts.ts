/**
 * useKeyboardShortcuts — 全局键盘快捷键管理 Hook（v1.4 收敛版）
 *
 * 提供统一的键盘快捷键支持：
 * - ⌘1..⌘9：按 VIEW_CONFIGS 顺序切换前 9 个视图
 * - Esc：取消选择/关闭弹窗
 * - 输入框 / contenteditable 焦点中自动跳过非 ⌘ / Ctrl 前缀的按键
 *
 * 注：tabs 列表光标导航（↑↓Space/Delete）不在此处实现 ——
 * 它们需要列表层维护"游标 tab"状态，应由 list 组件本地处理（见 useKeyboardNav）。
 */

import { useEffect, useCallback, useRef } from "react";
import { VIEW_CONFIGS, type ViewMode } from "@/shared/config/views";

export type ViewType = ViewMode;

export interface KeyboardShortcutsOptions {
  /** 当前激活的视图 */
  activeView: ViewType;
  /** 切换视图回调 */
  onSwitchView: (view: ViewType) => void;
  /** 取消选择/关闭弹窗（Esc） */
  onCancel?: () => void;
  /** 是否启用快捷键（默认 true） */
  enabled?: boolean;
}

/**
 * 视图顺序 = VIEW_CONFIGS 中 primary 视图（前 7 个），映射 ⌘1-⌘7
 */
const VIEW_ORDER: readonly ViewType[] = VIEW_CONFIGS.filter((v) => v.primary).map((v) => v.id);

function isEditingTarget(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  // window / document 等非 Element 节点上没有 tagName，直接判定为非输入区
  const tag = target.tagName;
  if (typeof tag !== "string") return false;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  // jsdom 下 isContentEditable getter 不会根据 attribute 动态计算，
  // 这里同时检查 attribute 作为傅锁。
  if (target.isContentEditable === true) return true;
  if (typeof target.getAttribute === "function") {
    const ce = target.getAttribute("contenteditable");
    if (ce !== null && ce !== "false") return true;
  }
  if (typeof target.closest === "function") {
    return target.closest('[role="textbox"]') !== null;
  }
  return false;
}

export function useKeyboardShortcuts({
  activeView,
  onSwitchView,
  onCancel,
  enabled = true,
}: KeyboardShortcutsOptions): void {
  const callbacksRef = useRef({ onSwitchView, onCancel });

  useEffect(() => {
    callbacksRef.current = { onSwitchView, onCancel };
  }, [onSwitchView, onCancel]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;
      const { key, metaKey, ctrlKey } = event;

      // ⌘1..⌘7：切换视图（即使在输入框内也允许 —— 与 macOS 系统级一致）
      if ((metaKey || ctrlKey) && /^[1-7]$/.test(key)) {
        event.preventDefault();
        const viewIndex = parseInt(key, 10) - 1;
        const targetView = VIEW_ORDER[viewIndex];
        if (targetView !== undefined && targetView !== activeView) {
          callbacksRef.current.onSwitchView(targetView);
        }
        return;
      }

      // 在输入框 / contenteditable 中跳过其他无修饰键
      if (isEditingTarget(event)) return;

      // Esc：取消选择/关闭弹窗
      if (key === "Escape") {
        callbacksRef.current.onCancel?.();
        return;
      }
    },
    [enabled, activeView],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * 获取视图对应的快捷键编号（⌘N 中的 N，从 1 起）。
 * 返回 0 表示该视图不在快捷键列表中（理论上不会发生）。
 */
export function getViewShortcut(view: ViewType): number {
  return VIEW_ORDER.indexOf(view) + 1;
}

/**
 * 获取快捷键说明文本（如 "⌘1" / "Ctrl+1"），用于 Tooltip / 帮助面板。
 */
export function getShortcutDescription(view: ViewType): string {
  const num = getViewShortcut(view);
  if (num === 0) return "";
  const isMac =
    typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac");
  const modifier = isMac ? "⌘" : "Ctrl+";
  return `${modifier}${num}`;
}
