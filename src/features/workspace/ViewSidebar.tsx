import { useMemo } from 'react';
import { Button } from 'antd';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useT } from '@/shared/i18n';
import { WORKSPACE_VIEW_CONFIGS } from '@/features/workspace/view-catalog';
import type { ViewMode } from '@/shared/types';

/**
 * 视图侧边栏
 *
 * 垂直排列视图图标 + 标签，支持左侧或右侧显示。
 *
 * @param props - 组件属性
 * @param props.viewMode - 当前视图模式
 * @param props.onViewChange - 视图切换回调
 * @param props.position - 侧边栏位置（'left' | 'right'）
 * @returns {void} 无返回值
 */
export function ViewSidebar({
  viewMode,
  onViewChange,
  position,
}: {
  viewMode: ViewMode;
  onViewChange: (v: ViewMode) => void;
  position: 'left' | 'right';
}) {
  const { t } = useT();

  /** 视图侧边栏导航项，缓存以避免每次渲染重建 JSX */
  const viewSidebarItems = useMemo(
    () =>
      WORKSPACE_VIEW_CONFIGS.map((v) => ({
        id: v.id,
        Icon: v.Icon,
        label: t(v.labelKey),
      })),
    [t],
  );

  return (
    <nav className={`app-view-sidebar app-view-sidebar--${position}`}>
      <div className="app-view-sidebar__list">
        {viewSidebarItems.map((v) => {
          const isActive = viewMode === v.id;
          return (
            <Button
              key={v.id}
              type="text"
              className={`app-view-sidebar__item${isActive ? ' is-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onViewChange(v.id)}
              title={v.label}
            >
              <v.Icon size={ICON_SIZE.MEDIUM} />
              <span className="app-view-sidebar__label">{v.label}</span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
