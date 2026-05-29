/**
 * useDragOnboarding — 拖拽功能引导提示 Hook
 *
 * 检测用户首次拖拽，显示 Ghost Drop Zone 使用引导
 * 使用 chrome.storage 存储引导完成状态
 */

import { useState, useEffect, useCallback } from "react";
import { useDndMonitor } from "@dnd-kit/core";

const STORAGE_KEY = "dragOnboardingDone";

/**
 * 拖拽引导提示 Hook
 *
 * @example
 * ```tsx
 * const { showOnboarding, dismissOnboarding } = useDragOnboarding();
 *
 * return (
 *   <DndContext>
 *     {showOnboarding && <DragOnboardingTooltip onClose={dismissOnboarding} />}
 *     {/* 拖拽内容 *\/}
 *   </DndContext>
 * );
 * ```
 */
export function useDragOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  // 检查是否已显示过引导
  useEffect(() => {
    const checkStorage = async () => {
      try {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        setShowOnboarding(!result[STORAGE_KEY]);
      } catch {
        // 如果存储不可用，默认不显示引导
        setShowOnboarding(false);
      }
      setHasChecked(true);
    };

    void checkStorage();
  }, []);

  // 监听拖拽开始
  useDndMonitor({
    onDragStart: () => {
      if (hasChecked && showOnboarding) {
        // 首次拖拽开始，保持引导显示状态
        // 引导会在用户点击「知道了」后关闭
      }
    },
  });

  /**
   * 关闭引导并标记为已完成
   */
  const dismissOnboarding = useCallback(async () => {
    setShowOnboarding(false);
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: true });
    } catch {
      // 忽略存储错误
    }
  }, []);

  return {
    showOnboarding: hasChecked && showOnboarding,
    dismissOnboarding,
    hasChecked,
  };
}
