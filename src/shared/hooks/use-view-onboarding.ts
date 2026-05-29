/**
 * useViewOnboarding — 视图引导弹窗状态管理
 *
 * 功能：
 *   - 检测是否需要显示视图引导（首次使用）
 *   - 标记视图引导已完成
 *   - 支持跳过/关闭引导
 */

import { useEffect, useState, useCallback } from "react";
import {
  hasCompletedViewOnboarding,
  markViewOnboardingDone,
} from "@/repositories/storage-repo";

interface UseViewOnboardingReturn {
  /** 是否显示视图引导弹窗 */
  showViewOnboarding: boolean;
  /** 关闭视图引导弹窗 */
  dismissViewOnboarding: () => void;
  /** 是否正在加载状态 */
  loading: boolean;
}

/**
 * 使用视图引导弹窗状态
 *
 * @param appReady 应用是否已完成初始化
 * @returns 视图引导状态和控制函数
 */
export function useViewOnboarding(appReady: boolean): UseViewOnboardingReturn {
  const [showViewOnboarding, setShowViewOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  // 检测是否需要显示视图引导
  useEffect(() => {
    if (!appReady) return;

    let cancelled = false;

    void (async () => {
      try {
        const completed = await hasCompletedViewOnboarding();
        if (!cancelled) {
          setShowViewOnboarding(!completed);
        }
      } catch (err) {
        console.warn("[useViewOnboarding] Failed to check onboarding status:", err);
        // 出错时默认显示引导
        if (!cancelled) {
          setShowViewOnboarding(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [appReady]);

  // 关闭视图引导并标记已完成
  const dismissViewOnboarding = useCallback(() => {
    setShowViewOnboarding(false);
    void markViewOnboardingDone().catch((err) => {
      console.warn("[useViewOnboarding] Failed to mark onboarding done:", err);
    });
  }, []);

  return {
    showViewOnboarding,
    dismissViewOnboarding,
    loading,
  };
}
