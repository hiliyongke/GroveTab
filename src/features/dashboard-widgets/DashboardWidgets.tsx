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
import { Button, Dropdown, Space, Tag, theme } from 'antd';
import { Check, EyeOff, LayoutGrid, Plus, RotateCcw, Sparkles } from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import type { LayoutItem } from 'react-grid-layout';
import { useSettingsStore } from '@/store';
import type { DashboardWidgetLayoutItem, DashboardWidgetType, UserSettings } from '@/shared/types';
import { ensureReactGridLayoutCss } from '@/shared/lazy-deps';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { SkeletonWidget } from '@/shared/ui/SkeletonWidget';
import { WidgetCard } from './WidgetCard';
import {
  WIDGET_DEFINITIONS,
  DASHBOARD_GRID_COLUMNS,
  DASHBOARD_GAP,
  DASHBOARD_ROW_HEIGHT,
} from './types';
import {
  createWidgetLayoutItem,
  findBestWidgetPosition,
  normalizeWidgetLayout,
  removeWidgetItem,
} from './utils';
import { clampLayout, fromRglLayout, toRglLayout } from './layout-migrator';
import { getWidgetTitle, renderWidgetBody } from './widgets';

const DEFAULT_LAYOUT: DashboardWidgetLayoutItem[] = [
  { id: 'clock-main', type: 'clock', x: 0, y: 0, w: 3, h: 2, title: '时钟' },
  { id: 'weather-main', type: 'weather', x: 3, y: 0, w: 3, h: 2, title: '天气' },
  { id: 'calendar-main', type: 'calendar', x: 6, y: 0, w: 3, h: 2, title: '日历' },
  { id: 'work-countdown-main', type: 'workCountdown', x: 9, y: 0, w: 3, h: 2, title: '下班倒计时' },
  { id: 'search-main', type: 'searchBox', x: 0, y: 2, w: 6, h: 2, title: '极速搜索' },
  { id: 'speed-dial-main', type: 'speedDial', x: 6, y: 2, w: 6, h: 3, title: '常用网站' },
  { id: 'todo-main', type: 'todo', x: 0, y: 5, w: 4, h: 3, title: '待办' },
  { id: 'pomodoro-main', type: 'pomodoro', x: 4, y: 5, w: 4, h: 3, title: '番茄钟' },
  { id: 'daily-quote-main', type: 'dailyQuote', x: 8, y: 5, w: 4, h: 3, title: '每日金句' },
];

// 动态 import —— RGL 进 vendor-grid chunk，首屏不加载。
// react-grid-layout 2.x 的 ResponsiveGridLayout 已经内置容器宽度自适应，无需 WidthProvider。
const ResponsiveGridLayout = lazy(async () => {
  const mod = await import('react-grid-layout');
  return { default: mod.ResponsiveGridLayout };
});

const BREAKPOINTS = { lg: 1024, md: 768, sm: 0 } as const;
const DRAG_HANDLE_CLASS = 'grovetab-dashboard__drag-handle';

function isDashboardWidgetEnabled(settings: UserSettings, type: DashboardWidgetType): boolean {
  switch (type) {
    case 'clock':
      return settings.heroWidgets?.clock?.enabled !== false;
    case 'weather':
      return settings.heroWidgets?.weather?.mode !== 'off';
    case 'calendar':
      return settings.heroWidgets?.calendar?.enabled !== false;
    case 'dailyQuote':
      return settings.dailyQuote?.enabled !== false;
    case 'speedDial':
      return settings.speedDial?.enabled !== false;
    case 'pomodoro':
      return settings.pomodoro?.enabled !== false;
    case 'todo':
      return settings.todoWidget?.enabled !== false;
    case 'sticky':
      return settings.stickyNotes?.enabled !== false;
    case 'countdown':
      return settings.countdowns?.enabled !== false;
    case 'workCountdown':
      return settings.workCountdown?.enabled !== false;
    case 'waterReminder':
      return settings.waterReminder?.enabled !== false;
    case 'habitTracker':
      return settings.habitTracker?.enabled !== false;
    case 'searchBox':
    case 'timestampTool':
    case 'jsonFormatter':
    case 'networkInfo':
      return true;
  }
}

interface DashboardWidgetsProps {
  title?: string;
  description?: string;
}

export function DashboardWidgets({
  title = '小组件工作台',
  description = '精选常用工具，支持拖拽排序、缩放尺寸和按需添加。',
}: DashboardWidgetsProps = {}) {
  const { token } = theme.useToken();
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const config = settings.dashboardWidgets;
  const enabled = config?.enabled !== false;
  const editing = config?.editMode === true;

  const rowHeight = config?.rowHeight ?? DASHBOARD_ROW_HEIGHT;
  const gap = config?.gap ?? DASHBOARD_GAP;
  const desktopColumns = config?.columns ?? DASHBOARD_GRID_COLUMNS;
  const cols = useMemo(
    () => ({ lg: desktopColumns, md: Math.min(8, desktopColumns), sm: 1 }),
    [desktopColumns],
  );
  const [activeColumns, setActiveColumns] = useState(desktopColumns);

  useEffect(() => {
    setActiveColumns(desktopColumns);
  }, [desktopColumns]);

  // 存量数据：先走 clampLayout 清洗（防御旧数据里超界的坐标），再 normalize
  const storedItems = useMemo(
    () =>
      normalizeWidgetLayout(
        clampLayout(config?.items ?? DEFAULT_LAYOUT, desktopColumns),
        desktopColumns,
      ),
    [config?.items, desktopColumns],
  );
  const visibleItems = useMemo(
    () =>
      storedItems.filter(
        (item) =>
          config?.availableWidgets?.[item.type] !== false &&
          isDashboardWidgetEnabled(settings, item.type),
      ),
    [config?.availableWidgets, settings, storedItems],
  );
  const usedTypes = useMemo(() => new Set(visibleItems.map((item) => item.type)), [visibleItems]);
  const addMenuItems = useMemo(() => {
    const candidates = WIDGET_DEFINITIONS.filter(
      (item) =>
        config?.availableWidgets?.[item.type] !== false &&
        isDashboardWidgetEnabled(settings, item.type) &&
        !usedTypes.has(item.type),
    );
    if (candidates.length === 0) {
      return [{ key: '__empty', label: '所有可用组件都已添加', disabled: true }];
    }
    return candidates.map((item) => ({
      key: item.type,
      label: `${item.title} · ${item.description}`,
    }));
  }, [config?.availableWidgets, settings, usedTypes]);

  // 生成 RGL layouts：各断点分别夹紧，避免中屏复用桌面布局导致越界。
  const layouts = useMemo<Record<'lg' | 'md' | 'sm', LayoutItem[]>>(() => {
    const mdColumns = cols.md;
    const lg = toRglLayout(clampLayout(visibleItems, desktopColumns), desktopColumns);
    const md = toRglLayout(clampLayout(visibleItems, mdColumns), mdColumns);
    const sm: LayoutItem[] = visibleItems.map((item, idx) => ({
      i: item.id,
      x: 0,
      y: idx * 3,
      w: 1,
      h: Math.max(2, item.h),
      minW: 1,
      minH: 2,
      maxW: 1,
      maxH: 6,
    }));
    return { lg, md, sm };
  }, [cols.md, desktopColumns, visibleItems]);

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
          items: normalizeWidgetLayout(clampLayout(nextItems, desktopColumns), desktopColumns),
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
      const nextVisible = fromRglLayout(current, visibleItems, activeColumns);
      const visibleIds = new Set(visibleItems.map((item) => item.id));
      const hiddenItems = storedItems.filter((item) => !visibleIds.has(item.id));
      const next = normalizeWidgetLayout([...nextVisible, ...hiddenItems], desktopColumns);
      // 若无实质变化则跳过（避免循环）
      const sameShape =
        next.length === storedItems.length &&
        next.every((n, i) => {
          const s = storedItems[i];
          return (
            Boolean(s) && s.id === n.id && s.x === n.x && s.y === n.y && s.w === n.w && s.h === n.h
          );
        });
      if (sameShape) return;
      void saveItems(next);
    },
    [activeColumns, desktopColumns, editing, storedItems, visibleItems, saveItems],
  );

  const addWidget = async (type: DashboardWidgetType) => {
    if (usedTypes.has(type) || config?.availableWidgets?.[type] === false) return;
    const def = WIDGET_DEFINITIONS.find((item) => item.type === type);
    if (!def) return;
    const pos = findBestWidgetPosition(
      visibleItems,
      def.defaultSize.w,
      def.defaultSize.h,
      desktopColumns,
    );
    const nextItem = createWidgetLayoutItem(type, pos.y);
    nextItem.x = pos.x;
    nextItem.w = def.defaultSize.w;
    nextItem.h = def.defaultSize.h;
    await saveItems([...storedItems, nextItem]);
  };

  const hiddenCount = storedItems.length - visibleItems.length;

  const removeWidget = async (id: string) => {
    await saveItems(removeWidgetItem(storedItems, id));
  };

  const resetLayout = async () => {
    await updateSettings({
      dashboardWidgets: {
        ...(config ?? {}),
        items: normalizeWidgetLayout(clampLayout(DEFAULT_LAYOUT, desktopColumns), desktopColumns),
        editMode: false,
      },
    });
  };

  if (!enabled) return null;

  return (
    <section style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          width: '100%',
          padding: '10px 12px',
          borderRadius: 16,
          background: token.colorFillQuaternary,
          border: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 10,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: token.colorPrimary,
              background: token.colorPrimaryBg,
              flexShrink: 0,
            }}
          >
            <LayoutGrid size={ICON_SIZE.MEDIUM} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: token.colorText }}>{title}</span>
              <Tag
                color={editing ? 'processing' : 'default'}
                style={{ margin: 0, fontSize: 11, border: 0 }}
              >
                {editing ? '正在编辑' : `${visibleItems.length} 个组件`}
              </Tag>
              {hiddenCount > 0 && (
                <Tag color="default" style={{ margin: 0, fontSize: 11, border: 0 }}>
                  已隐藏 {hiddenCount}
                </Tag>
              )}
            </div>
            <div style={{ fontSize: 12, color: token.colorTextTertiary, marginTop: 2 }}>
              {description}
            </div>
          </div>
        </div>

        <Space wrap size={8}>
          <Dropdown
            menu={{
              items: addMenuItems,
              onClick: ({ key }) => {
                if (key !== '__empty') void addWidget(key as DashboardWidgetType);
              },
            }}
            trigger={['click']}
          >
            <Button icon={<Plus size={ICON_SIZE.MEDIUM} />}>添加</Button>
          </Dropdown>
          <Button
            icon={
              editing ? <Check size={ICON_SIZE.MEDIUM} /> : <Sparkles size={ICON_SIZE.MEDIUM} />
            }
            type={editing ? 'primary' : 'default'}
            onClick={() =>
              void updateSettings({
                dashboardWidgets: { ...(config ?? {}), editMode: !editing },
              })
            }
          >
            {editing ? '完成' : '自定义'}
          </Button>
          {editing && (
            <Button icon={<RotateCcw size={ICON_SIZE.MEDIUM} />} onClick={() => void resetLayout()}>
              精选布局
            </Button>
          )}
          <Button
            type="text"
            icon={<EyeOff size={ICON_SIZE.MEDIUM} />}
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

      {visibleItems.length === 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            minHeight: 160,
            padding: 24,
            borderRadius: 18,
            background: 'var(--canopy-glass-bg)',
            border: `1px dashed ${token.colorBorderSecondary}`,
            color: token.colorTextSecondary,
            textAlign: 'center',
          }}
        >
          <LayoutGrid size={ICON_SIZE.XXL} color={token.colorTextTertiary} />
          <div style={{ fontSize: 14, fontWeight: 700, color: token.colorText }}>
            暂无可见小组件
          </div>
          <div style={{ fontSize: 12 }}>可以在组件库重新启用，或添加尚未放入工作台的工具。</div>
          <Dropdown
            menu={{
              items: addMenuItems,
              onClick: ({ key }) => {
                if (key !== '__empty') void addWidget(key as DashboardWidgetType);
              },
            }}
            trigger={['click']}
          >
            <Button type="primary" icon={<Plus size={ICON_SIZE.MEDIUM} />}>
              添加组件
            </Button>
          </Dropdown>
        </div>
      )}

      <div
        ref={containerRef}
        className={editing ? 'grovetab-dashboard--editing' : ''}
        style={{
          width: '100%',
          display: visibleItems.length === 0 ? 'none' : undefined,
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
            cols={cols}
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
            onBreakpointChange={(_, nextColumns) => setActiveColumns(nextColumns)}
          >
            {visibleItems.map((item) => (
              <div key={item.id} data-widget-id={item.id}>
                <WidgetCard
                  title={item.title ?? getWidgetTitle(item.type)}
                  type={item.type}
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
