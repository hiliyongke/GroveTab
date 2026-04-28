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
export function toRglLayout(
  items: DashboardWidgetLayoutItem[],
  columns: number = DASHBOARD_GRID_COLUMNS,
): LayoutItem[] {
  const normalizedColumns = Math.max(1, Math.floor(columns));
  const minW = Math.min(DASHBOARD_MIN_ITEM_W, normalizedColumns);
  const maxW = Math.max(minW, Math.min(DASHBOARD_MAX_ITEM_W, normalizedColumns));
  return items.map<LayoutItem>((item) => {
    const w = clampInt(item.w, minW, maxW);
    return {
      i: item.id,
      x: clampInt(item.x, 0, normalizedColumns - w),
      y: Math.max(0, Math.floor(item.y)),
      w,
      h: clampInt(item.h, DASHBOARD_MIN_ITEM_H, DASHBOARD_MAX_ITEM_H),
      minW,
      minH: DASHBOARD_MIN_ITEM_H,
      maxW,
      maxH: DASHBOARD_MAX_ITEM_H,
    };
  });
}

/**
 * 把 RGL 的 LayoutItem[] 写回老结构（保留 id/type/title 等元信息）
 * —— 仅更新几何字段 x/y/w/h
 */
export function fromRglLayout(
  layout: readonly LayoutItem[],
  source: DashboardWidgetLayoutItem[],
  columns: number = DASHBOARD_GRID_COLUMNS,
): DashboardWidgetLayoutItem[] {
  const normalizedColumns = Math.max(1, Math.floor(columns));
  const minW = Math.min(DASHBOARD_MIN_ITEM_W, normalizedColumns);
  const maxW = Math.max(minW, Math.min(DASHBOARD_MAX_ITEM_W, normalizedColumns));
  const byId = new Map(source.map((s) => [s.id, s] as const));
  return layout
    .map<DashboardWidgetLayoutItem | null>((l) => {
      const src = byId.get(l.i);
      if (!src) return null; // 数据偏差：RGL 返回了不存在的项，直接丢弃
      const w = clampInt(l.w, minW, maxW);
      return {
        ...src,
        x: clampInt(l.x, 0, normalizedColumns - w),
        y: Math.max(0, Math.floor(l.y)),
        w,
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
  const normalizedColumns = Math.max(1, Math.floor(columns));
  const minW = Math.min(DASHBOARD_MIN_ITEM_W, normalizedColumns);
  const maxW = Math.max(minW, Math.min(DASHBOARD_MAX_ITEM_W, normalizedColumns));
  return items.map((item) => {
    const w = clampInt(item.w, minW, maxW);
    const h = clampInt(item.h, DASHBOARD_MIN_ITEM_H, DASHBOARD_MAX_ITEM_H);
    const x = clampInt(item.x, 0, normalizedColumns - w);
    const y = Math.max(0, Math.floor(item.y));
    return { ...item, x, y, w, h };
  });
}

/**
 * 网格紧凑 —— 把每个 item 向"左上"尽量压缩，同时避免重叠。
 * 相比纯垂直紧凑，本函数还会在同一行内尝试向左填充空隙，
 * 使过滤掉某些组件后的布局更整齐。
 */
export function compactLayoutVertical(
  items: DashboardWidgetLayoutItem[],
  columns: number = DASHBOARD_GRID_COLUMNS,
): DashboardWidgetLayoutItem[] {
  const normalizedColumns = Math.max(1, Math.floor(columns));
  // 按 (y, x) 排序，保证稳定的"先上后左"顺序
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const placed: DashboardWidgetLayoutItem[] = [];

  for (const item of sorted) {
    // 先找能放下的最小 y
    let targetY = 0;
    for (const p of placed) {
      const overlapX = !(item.x + item.w <= p.x || p.x + p.w <= item.x);
      if (overlapX) {
        targetY = Math.max(targetY, p.y + p.h);
      }
    }

    // 再尝试在同一行内向左移动（贪心：从 0 开始试，找到不冲突的最小 x）
    let targetX = item.x;
    for (let tryX = 0; tryX <= item.x; tryX++) {
      if (tryX + item.w > normalizedColumns) continue;
      const conflict = placed.some((p) => {
        const overlapX = !(tryX + item.w <= p.x || p.x + p.w <= tryX);
        const overlapY = !(targetY + item.h <= p.y || p.y + p.h <= targetY);
        return overlapX && overlapY;
      });
      if (!conflict) {
        targetX = tryX;
        break;
      }
    }

    placed.push({ ...item, x: targetX, y: targetY });
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
