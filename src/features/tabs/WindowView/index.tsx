/**
 * WindowView — 窗口管理视图（重构版）
 */

import { useCallback, useMemo, useRef, useLayoutEffect, useState } from 'react';
import { ConfigProvider, Empty, theme, App as AntdApp } from 'antd';
import { useTabsStore } from '@/store';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { WindowCard } from './components/WindowCard';
import { DragPreview } from './components/DragPreview';
import { useWindowDrag } from './hooks/use-window-drag';
import { useWindowKeyboard } from './hooks/use-window-keyboard';
import { useWindowMerge } from './hooks/use-window-merge';
import { useWindowThumbnail } from './hooks/use-window-thumbnail';
import styles from './WindowView.module.less';

/**
 * 监听 Alt 键状态
 *
 * 用于检测用户是否按住 Alt 键，实现跨窗口拖拽复制功能。
 *
 * @returns Alt 键是否被按住的布尔值
 */
function useAltKey(): boolean {
  const [held, setHeld] = useState(false);
  useLayoutEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setHeld(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setHeld(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);
  return held;
}

/**
 * 窗口管理视图（重构版）
 *
 * 设计：
 *   - 使用 @dnd-kit/core 实现窗口卡片拖拽排序
 *   - 支持键盘导航（Arrow keys + Enter + Space）
 *   - 触屏支持（TouchSensor with delay）
 *   - Alt+拖拽复制标签到目标窗口
 *
 * @returns 窗口视图 JSX 元素
 */
function WindowView() {
  const tabs = useTabsStore((s) => s.tabs);
  const altHeld = useAltKey();
  const containerRef = useRef<HTMLDivElement>(null);
  const jumpToTabAction = useTabsStore((state) => state.jumpToTab);
  const closeSingleTabAction = useTabsStore((state) => state.closeSingleTab);

  // 当前聚焦的窗口 ID
  const currentWindowId = useTabsStore((s) => s.currentWindowId);

  // 按窗口 ID 分组
  const windows = useMemo(() => {
    const map = new Map<number, typeof tabs>();
    for (const tab of tabs) {
      const wid = tab.windowId ?? -1;
      if (!map.has(wid)) map.set(wid, []);
      map.get(wid)!.push(tab);
    }
    return map;
  }, [tabs]);

  // 所有标签 ID（用于 TabItem 高亮）
  const allTabIds = useMemo(() => tabs.map((t) => t.id), [tabs]);

  /** 跳转 + 聚焦窗口 */
  const jumpToTab = useCallback(
    (tabId: number, windowId: number): void => {
      void jumpToTabAction(tabId, windowId);
    },
    [jumpToTabAction],
  );

  /** 关闭单个标签 */
  const closeSingleTab = useCallback((tabId: number): void => {
    void closeSingleTabAction(tabId);
  }, [closeSingleTabAction]);

  // —— Hooks ——
  const { activeDrag, handleDragStart, handleDragOver, handleDragEnd } = useWindowDrag({
    t: (key: string) => key,
    altHeld,
    windowGroups: windows,
    tabs,
  });

  const { handleKeyDown } = useWindowKeyboard({
    tabs,
    activeDrag,
    onJumpToTab: jumpToTab,
    onCloseSingleTab: closeSingleTab,
  });

  const { handleMergeAll } = useWindowMerge({
    currentWindowId,
    tabs,
  });

  const {
    thumbnailUrl,
    thumbnailVisible,
    handleThumbnailHover,
    handleThumbnailLeave,
  } = useWindowThumbnail();

  // —— dnd-kit 传感器 ——
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );
  const handleDragEndSync = useCallback((event: Parameters<typeof handleDragEnd>[0]) => {
    void handleDragEnd(event);
  }, [handleDragEnd]);

  // 简单的 t() fallback
  const t = (key: string): string => key;
  const translateWindowKey = useCallback(
    (key: string, _params?: Record<string, string | number>) => key,
    [],
  );

  // token fallback
  const token = {
    colorBorderSecondary: '#eee',
    colorBorder: '#ddd',
    colorText: '#333',
    colorTextTertiary: '#999',
    colorFillSecondary: '#f5f5f5',
  };

  return (
    <ConfigProvider theme={{ algorithm: theme.compactAlgorithm }}>
      <AntdApp>
        <div
          ref={containerRef}
          className={styles['app-window-view']}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="application"
          aria-label={t('window.windows')}
        >
          {/* 工具栏 */}
          <div className={styles['app-window-toolbar']}>
            <button
              type="button"
              onClick={() => {
                void handleMergeAll();
              }}
            >
              {t('window.mergeAll')}
            </button>
          </div>

          {/* 窗口网格 */}
          {windows.size === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('window.noWindows')}
            />
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEndSync}
            >
              <div className={styles['app-window-grid']}>
                {Array.from(windows.entries()).map(([windowId, windowTabs]) => {
                  const isCurrent = windowId === currentWindowId;
                  return (
                    <WindowCard
                      key={windowId}
                      windowId={windowId}
                      windowTabs={windowTabs}
                      windowInfo={undefined}
                      isCurrent={isCurrent}
                      allTabIds={allTabIds}
                      jumpToTab={jumpToTab}
                      closeSingleTab={closeSingleTab}
                      activeDrag={activeDrag}
                      t={translateWindowKey}
                      token={token}
                      reduced={false}
                      altHeld={altHeld}
                      onThumbnailHover={handleThumbnailHover}
                      onThumbnailLeave={handleThumbnailLeave}
                      thumbnailUrl={thumbnailVisible ? thumbnailUrl : null}
                    />
                  );
                })}
              </div>

              {/* 拖拽预览 */}
              <DragOverlay dropAnimation={null}>
                {activeDrag ? (
                  <DragPreview active={activeDrag} t={t} isAltHeld={altHeld} />
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </AntdApp>
    </ConfigProvider>
  );
}

export default WindowView;
