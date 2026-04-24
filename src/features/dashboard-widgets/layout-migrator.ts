/**
 * Dashboard 网格布局迁移器 · v1.3
 *
 * 背景：v1.2 之前 Dashboard 使用手写指针事件 + 碰撞推挤算法，布局存储字段为
 *   `DashboardWidgetLayoutItem { id, type, x, y, w, h, title }`
 *
 * v1.3 改为 `react-grid-layout`，它要求 `Layout[]` 形态为
 *   `{ i, x, y, w, h, minW?, minH?, maxW?, maxH? }`
 *
 * 本模块提供双向转换，保证老用户存量数据 0 丢失。
 *
 * 除纯转换外还提供 `compactLayout`（垂直紧凑）和 `clampLayout`（越界夹紧），
 * 供单测与 UI 防御性处理共用。
 */

import type { LayoutItem } from 'react-grid-layout';
import type { DashboardWidgetLayoutItem } from '@/shared/types';
import {
  DASHBOARD_GRID_COLUMNS,
  DASHBOARD_MAX_ITEM_H,
  DASHBOARD_MAX_ITEM_W,
  DASHBOARD_MIN_ITEM_H,
  DASHBOARD_MIN_ITEM_W,
} from './types';

/**
 * 把老结构转换为 RGL 的 LayoutItem[]
 * 老字段 `id/type/title` 里只有 `id` 会落入 RGL 的 `i`，其余靠外部 items[] 数组通过 id 反查
 */
export function toRglLayout(items: DashboardWidgetLayoutItem[]): LayoutItem[] {
  return items.map<LayoutItem>((item) => ({
    i: item.id,
    x: clampInt(item.x, 0, DASHBOARD_GRID_COLUMNS - 1),
    y: Math.max(0, Math.floor(item.y)),
    w: clampInt(item.w, DASHBOARD_MIN_ITEM_W, DASHBOARD_MAX_ITEM_W),
    h: clampInt(item.h, DASHBOARD_MIN_ITEM_H, DASHBOARD_MAX_ITEM_H),
    minW: DASHBOARD_MIN_ITEM_W,
    minH: DASHBOARD_MIN_ITEM_H,
    maxW: DASHBOARD_MAX_ITEM_W,
    maxH: DASHBOARD_MAX_ITEM_H,
  }));
}

/**
 * 把 RGL 的 LayoutItem[] 写回老结构（保留 id/type/title 等元信息）
 * —— 仅更新几何字段 x/y/w/h
 */
export function fromRglLayout(
  layout: readonly LayoutItem[],
  source: DashboardWidgetLayoutItem[],
): DashboardWidgetLayoutItem[] {
  const byId = new Map(source.map((s) => [s.id, s] as const));
  return layout
    .map<DashboardWidgetLayoutItem | null>((l) => {
      const src = byId.get(l.i);
      if (!src) return null; // 数据偏差：RGL 返回了不存在的项，直接丢弃
      return {
        ...src,
        x: clampInt(l.x, 0, DASHBOARD_GRID_COLUMNS - 1),
        y: Math.max(0, Math.floor(l.y)),
        w: clampInt(l.w, DASHBOARD_MIN_ITEM_W, DASHBOARD_MAX_ITEM_W),
        h: clampInt(l.h, DASHBOARD_MIN_ITEM_H, DASHBOARD_MAX_ITEM_H),
      };
    })
    .filter((x): x is DashboardWidgetLayoutItem => x !== null);
}

/**
 * 越界夹紧 —— 在渲染前做一次防御性清洗，避免存量数据里有不合法坐标导致 RGL 崩溃
 */
export function clampLayout(
  items: DashboardWidgetLayoutItem[],
  columns: number = DASHBOARD_GRID_COLUMNS,
): DashboardWidgetLayoutItem[] {
  return items.map((item) => {
    const w = clampInt(item.w, DASHBOARD_MIN_ITEM_W, Math.min(DASHBOARD_MAX_ITEM_W, columns));
    const h = clampInt(item.h, DASHBOARD_MIN_ITEM_H, DASHBOARD_MAX_ITEM_H);
    const x = clampInt(item.x, 0, columns - w);
    const y = Math.max(0, Math.floor(item.y));
    return { ...item, x, y, w, h };
  });
}

/**
 * 垂直紧凑 —— 把每个 item 的 y 往上尽量压缩，同时避免重叠。
 * 行为等价于 react-grid-layout 的 `compactType: 'vertical'`，但作为纯函数便于测试。
 */
export function compactLayoutVertical(
  items: DashboardWidgetLayoutItem[],
): DashboardWidgetLayoutItem[] {
  // 按 (y, x) 排序，保证稳定的"先上后左"顺序
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const placed: DashboardWidgetLayoutItem[] = [];

  for (const item of sorted) {
    // 找到当前 item 在 y 轴上能"落到最低"（数值最小）的位置
    let targetY = 0;
    for (const p of placed) {
      // 水平投影是否相交
      const overlapX = !(item.x + item.w <= p.x || p.x + p.w <= item.x);
      if (overlapX) {
        targetY = Math.max(targetY, p.y + p.h);
      }
    }
    placed.push({ ...item, y: targetY });
  }
  return placed;
}

function clampInt(value: number, min: number, max: number): number {
  const v = Math.floor(value);
  if (Number.isNaN(v)) return min;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}
