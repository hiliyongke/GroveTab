import { useMemo } from 'react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useT } from '@/shared/i18n';
import { WORKSPACE_VIEW_CONFIGS } from '@/features/workspace/view-catalog';
import type { ViewMode } from '@/shared/types';

/**
 * 视图切换底部固定栏
 *
 * 设计要点：
 *   - 通过 CSS `position: fixed; bottom: 0` 钉在视口底部，左右居中
 *   - 玻璃质感背景 + hairline 边框，与顶部 header 风格呼应
 *   - 标签数量有限（≤ 6），水平排列、横向居中、不滚动
 *   - 在小屏下文字会自动隐藏，仅显示图标（由 CSS 控制）
 *
 * @param props - 组件属性
 * @param props.viewMode - 当前视图模式
 * @param props.onViewChange - 视图切换回调
 * @returns {void} 无返回值
 */
export function ViewBottomBar({
  viewMode,
  onViewChange,
}: {
  viewMode: ViewMode;
  onViewChange: (v: ViewMode) => void;
}) {
  const { t } = useT();

  /** 视图栏导航项，缓存避免每次渲染重建 JSX */
  const items = useMemo(
    () =>
      WORKSPACE_VIEW_CONFIGS.map((v) => ({
        id: v.id,
        Icon: v.Icon,
        label: t(v.labelKey),
      })),
    [t],
  );

  return (
    <nav className="app-view-bottom" aria-label="view switcher">
      <div className="app-view-bottom__list">
        {items.map((v) => {
          const isActive = viewMode === v.id;
          return (
            <button
              key={v.id}
              type="button"
              className={`app-view-bottom__item${isActive ? ' is-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onViewChange(v.id)}
              title={v.label}
            >
              <v.Icon size={ICON_SIZE.MEDIUM} />
              <span className="app-view-bottom__label">{v.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
