/**
 * useWindowThumbnail — 窗口缩略图预览 Hook
 *
 * 提供窗口缩略图预览功能：
 * - 悬停窗口标题时调用 chrome.tabs.captureVisibleTab
 * - 鼠标离开时延迟清除缩略图（让淡出动画完成）
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { safeCall } from '@/chrome/tabs';

interface UseWindowThumbnailReturn {
  thumbnailUrl: string | null;
  thumbnailVisible: boolean;
  handleThumbnailHover: (windowId: number) => void;
  handleThumbnailLeave: () => void;
}

/**
 *
 */
export function useWindowThumbnail(): UseWindowThumbnailReturn {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailVisible, setThumbnailVisible] = useState(false);
  const thumbnailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 组件卸载时清理 timer
  useEffect(() => {
    return () => {
      if (thumbnailTimerRef.current) {
        clearTimeout(thumbnailTimerRef.current);
      }
    };
  }, []);

  /** 窗口缩略图预览：悬停窗口标题时调用 chrome.tabs.captureVisibleTab */
  const handleThumbnailHover = useCallback(
    (windowId: number) => {
      if (typeof chrome === 'undefined' || !chrome.tabs?.captureVisibleTab) return;
      void safeCall('tabs.captureVisibleTab', () =>
        chrome.tabs.captureVisibleTab(windowId, {
          format: 'jpeg',
          quality: 50,
        }),
      ).then((dataUrl) => {
        setThumbnailUrl(dataUrl as string);
        setThumbnailVisible(true);
      }).catch(() => {
        // 权限不足或窗口已关闭，静默忽略
      });
    },
    [],
  );

  const handleThumbnailLeave = useCallback(() => {
    setThumbnailVisible(false);
    // 延迟清除图片，让淡出动画完成
    if (thumbnailTimerRef.current) {
      clearTimeout(thumbnailTimerRef.current);
    }
    thumbnailTimerRef.current = setTimeout(() => setThumbnailUrl(null), 300);
  }, []);

  return {
    thumbnailUrl,
    thumbnailVisible,
    handleThumbnailHover,
    handleThumbnailLeave,
  };
}
