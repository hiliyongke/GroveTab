/**
 * Dashboard 网格 · v1.3 重构
 *
 * 历史：v1.2 的版本是手写指针事件 + 260 行碰撞推挤算法。v1.3 全面改为
 * `react-grid-layout`（2.x 原生 TS），得到成熟的：
 *   - 响应式断点（lg/md/sm → 12/8/1 列）
 *   - 垂直紧凑 + 占位预览 + 避让动画
 *   - 拖拽句柄 / 缩放句柄 / 触屏支持
 *
 * 关键实现点：
 *   1. `react-grid-layout` 体积 ~30KB gz，通过 `React.lazy` 只在本组件挂载时
 *      加载 `vendor-grid` chunk，首屏 0 影响。
 *   2. `layout-migrator` 把旧的 `{id,x,y,w,h}` 结构转换为 RGL 的 `LayoutItem`。
 *   3. 拖拽句柄用 `.grovetab-dashboard__drag-handle` 类精准指定，避免
 *      影响 widget 内部控件（input / button）。
 *   4. 编辑模式外禁用 drag/resize，防止误操作。
 */

import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dropdown, Space, theme } from 'antd';
import { Edit3, Plus, RotateCcw, Check, EyeOff } from 'lucide-react';
import type { LayoutItem } from 'react-grid-layout';
import { useSettingsStore } from '@/store';
import type { DashboardWidgetLayoutItem, DashboardWidgetType } from '@/shared/types';
import { ensureReactGridLayoutCss } from '@/shared/lazy-deps';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { SkeletonWidget } from '@/shared/ui/SkeletonWidget';
import { WidgetCard } from './WidgetCard';
import { WIDGET_DEFINITIONS, DASHBOARD_GRID_COLUMNS, DASHBOARD_GAP, DASHBOARD_ROW_HEIGHT } from './types';
import {
  createWidgetLayoutItem,
  getNextWidgetY,
  normalizeWidgetLayout,
  removeWidgetItem,
} from './utils';
import { clampLayout, fromRglLayout, toRglLayout } from './layout-migrator';
import { getWidgetTitle, renderWidgetBody } from './widgets';

const DEFAULT_LAYOUT: DashboardWidgetLayoutItem[] = [
  { id: 'clock-main', type: 'clock', x: 0, y: 0, w: 3, h: 2, title: '时钟' },
  { id: 'weather-main', type: 'weather', x: 3, y: 0, w: 3, h: 2, title: '天气' },
  { id: 'calendar-main', type: 'calendar', x: 6, y: 0, w: 3, h: 2, title: '日历' },
  { id: 'work-countdown-main', type: 'workCountdown', x: 9, y: 0, w: 3, h: 2, title: '距离下班' },
  { id: 'search-main', type: 'searchBox', x: 0, y: 2, w: 6, h: 2, title: '极速搜索' },
  { id: 'water-main', type: 'waterReminder', x: 6, y: 2, w: 3, h: 2, title: '喝水提醒' },
  { id: 'network-main', type: 'networkInfo', x: 9, y: 2, w: 3, h: 2, title: '网络信息' },
  { id: 'speed-dial-main', type: 'speedDial', x: 0, y: 4, w: 6, h: 3, title: '常用网站' },
  { id: 'countdown-main', type: 'countdown', x: 6, y: 4, w: 3, h: 3, title: '纪念日' },
  { id: 'pomodoro-main', type: 'pomodoro', x: 9, y: 4, w: 3, h: 3, title: '番茄钟' },
  { id: 'habit-main', type: 'habitTracker', x: 0, y: 7, w: 4, h: 3, title: '习惯打卡' },
  { id: 'todo-main', type: 'todo', x: 4, y: 7, w: 4, h: 3, title: '待办' },
  { id: 'sticky-main', type: 'sticky', x: 8, y: 7, w: 4, h: 3, title: '便签' },
  { id: 'timestamp-main', type: 'timestampTool', x: 0, y: 10, w: 4, h: 2, title: '时间戳' },
  { id: 'json-main', type: 'jsonFormatter', x: 4, y: 10, w: 4, h: 4, title: 'JSON 格式化' },
  { id: 'daily-quote-main', type: 'dailyQuote', x: 8, y: 10, w: 4, h: 3, title: '金句' },
];

// 动态 import —— RGL 进 vendor-grid chunk，首屏不加载。
// react-grid-layout 2.x 的 ResponsiveGridLayout 已经内置容器宽度自适应，无需 WidthProvider。
const ResponsiveGridLayout = lazy(async () => {
  const mod = await import('react-grid-layout');
  return { default: mod.ResponsiveGridLayout };
});

const BREAKPOINTS = { lg: 1024, md: 768, sm: 0 } as const;
const COLS = { lg: DASHBOARD_GRID_COLUMNS, md: 8, sm: 1 } as const;

const DRAG_HANDLE_CLASS = 'grovetab-dashboard__drag-handle';

export function DashboardWidgets() {
  const { token } = theme.useToken();
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const config = settings.dashboardWidgets;
  const enabled = config?.enabled !== false;
  const legacyVisible = settings.uiVisibility?.heroWidgets !== false;
  const editing = config?.editMode === true;

  const rowHeight = config?.rowHeight ?? DASHBOARD_ROW_HEIGHT;
  const gap = config?.gap ?? DASHBOARD_GAP;

  // 存量数据：先走 clampLayout 清洗（防御旧数据里超界的坐标），再 normalize
  const storedItems = useMemo(
    () => normalizeWidgetLayout(clampLayout(config?.items ?? DEFAULT_LAYOUT)),
    [config?.items],
  );

  // 生成 RGL layouts：lg 与 md 走同一份；sm 强制单列
  const layouts = useMemo<Record<'lg' | 'md' | 'sm', LayoutItem[]>>(() => {
    const lg = toRglLayout(storedItems);
    const sm: LayoutItem[] = storedItems.map((item, idx) => ({
      i: item.id,
      x: 0,
      y: idx * 3,
      w: 1,
      h: Math.max(2, item.h),
      minH: 2,
      maxH: 6,
    }));
    return { lg, md: lg, sm };
  }, [storedItems]);

  // 只在首次挂载时加载 RGL 样式（幂等）
  useEffect(() => {
    void ensureReactGridLayoutCss();
  }, []);

  // 测量容器宽度 —— ResponsiveGridLayout 2.x 要求显式传入 width prop。
  // 我们通过 ResizeObserver 监听外层 div，变化时更新 state 触发重排。
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1024);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setContainerWidth(Math.round(w));
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const saveItems = useCallback(
    async (nextItems: DashboardWidgetLayoutItem[]) => {
      await updateSettings({
        dashboardWidgets: {
          ...(config ?? {}),
          items: normalizeWidgetLayout(clampLayout(nextItems)),
        },
      });
    },
    [config, updateSettings],
  );

  // RGL 在拖拽 / 缩放 / compact 后回调，把 layout 转回老结构落盘
  const onLayoutChange = useCallback(
    (current: readonly LayoutItem[]) => {
      // 只在编辑模式下才写回（编辑关闭时 RGL 也可能触发一次初始 compact，忽略即可）
      if (!editing) return;
      const next = fromRglLayout(current, storedItems);
      // 若无实质变化则跳过（避免循环）
      const sameShape =
        next.length === storedItems.length &&
        next.every((n, i) => {
          const s = storedItems[i];
          return Boolean(s) && s.id === n.id && s.x === n.x && s.y === n.y && s.w === n.w && s.h === n.h;
        });
      if (sameShape) return;
      void saveItems(next);
    },
    [editing, storedItems, saveItems],
  );

  const addWidget = async (type: DashboardWidgetType) => {
    const nextItem = createWidgetLayoutItem(type, getNextWidgetY(storedItems));
    await saveItems([...storedItems, nextItem]);
  };

  const removeWidget = async (id: string) => {
    await saveItems(removeWidgetItem(storedItems, id));
  };

  const resetLayout = async () => {
    await updateSettings({
      dashboardWidgets: {
        ...(config ?? {}),
        items: DEFAULT_LAYOUT,
        editMode: false,
      },
    });
  };

  if (!enabled || !legacyVisible) return null;

  return (
    <section style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: token.colorText }}>顶部工作台</div>
          <div style={{ fontSize: 12, color: token.colorTextTertiary }}>
            点击"编辑布局"后，可从卡片顶部拖拽移动、拖拽右下角缩放；松手自动避让。
          </div>
        </div>

        <Space wrap>
          <Dropdown
            menu={{
              items: WIDGET_DEFINITIONS.map((item) => ({
                key: item.type,
                label: `${item.title} · ${item.description}`,
              })),
              onClick: ({ key }) => void addWidget(key as DashboardWidgetType),
            }}
            trigger={['click']}
          >
            <Button icon={<Plus size={14} />}>添加组件</Button>
          </Dropdown>
          <Button
            icon={editing ? <Check size={14} /> : <Edit3 size={14} />}
            type={editing ? 'primary' : 'default'}
            onClick={() =>
              void updateSettings({
                dashboardWidgets: { ...(config ?? {}), editMode: !editing },
              })
            }
          >
            {editing ? '完成编辑' : '编辑布局'}
          </Button>
          <Button icon={<RotateCcw size={14} />} onClick={() => void resetLayout()}>
            重置布局
          </Button>
          <Button
            icon={<EyeOff size={14} />}
            onClick={() =>
              void updateSettings({
                dashboardWidgets: { ...(config ?? {}), enabled: false, editMode: false },
              })
            }
          >
            隐藏
          </Button>
        </Space>
      </div>

      <div
        ref={containerRef}
        className={editing ? 'grovetab-dashboard--editing' : ''}
        style={{
          width: '100%',
          background: editing ? token.colorFillQuaternary : 'transparent',
          borderRadius: 16,
          padding: editing ? 4 : 0,
          transition: 'background 0.2s ease',
        }}
      >
        <Suspense fallback={<SkeletonWidget rows={4} label="组件加载中" />}>
          <ResponsiveGridLayout
            className="layout"
            width={containerWidth}
            layouts={layouts}
            breakpoints={BREAKPOINTS}
            cols={COLS}
            rowHeight={rowHeight}
            margin={[gap, gap]}
            containerPadding={[0, 0]}
            dragConfig={{
              enabled: editing,
              bounded: false,
              handle: `.${DRAG_HANDLE_CLASS}`,
              threshold: 4,
            }}
            resizeConfig={{
              enabled: editing,
              handles: ['se'],
            }}
            compactor={undefined /* 默认 vertical */}
            autoSize={true}
            onLayoutChange={onLayoutChange}
          >
            {storedItems.map((item) => (
              <div key={item.id} data-widget-id={item.id}>
                <WidgetCard
                  title={item.title ?? getWidgetTitle(item.type)}
                  editing={editing}
                  onRemove={() => void removeWidget(item.id)}
                  dragHandleClassName={DRAG_HANDLE_CLASS}
                >
                  <ErrorBoundary label={item.title ?? getWidgetTitle(item.type)}>
                    {renderWidgetBody(item)}
                  </ErrorBoundary>
                </WidgetCard>
              </div>
            ))}
          </ResponsiveGridLayout>
        </Suspense>
      </div>
    </section>
  );
}

// 占位：保留一个无用导出以防其他地方 import 了旧 handler
export const __unused_handleLayoutChange = null;
