/**
 * dashboard-widget-utils · 智能放置算法测试
 */

import { describe, it, expect } from 'vitest';
import { findBestWidgetPosition } from '@/features/dashboard-widgets/utils';
import type { DashboardWidgetLayoutItem } from '@/shared/types';

function ITEM(p: Partial<DashboardWidgetLayoutItem> & { id: string }): DashboardWidgetLayoutItem {
  return {
    id: p.id,
    type: 'clock',
    x: p.x ?? 0,
    y: p.y ?? 0,
    w: p.w ?? 3,
    h: p.h ?? 2,
    title: p.title ?? '',
  };
}

describe('findBestWidgetPosition', () => {
  it('空列表返回 (0, 0)', () => {
    const pos = findBestWidgetPosition([], 3, 2, 12);
    expect(pos).toEqual({ x: 0, y: 0 });
  });

  it('单个组件右侧有空位，新组件放右侧', () => {
    const items = [ITEM({ id: 'a', x: 0, y: 0, w: 3, h: 2 })];
    const pos = findBestWidgetPosition(items, 3, 2, 12);
    expect(pos).toEqual({ x: 3, y: 0 });
  });

  it('第一行排满后，新组件放第二行', () => {
    const items = [
      ITEM({ id: 'a', x: 0, y: 0, w: 4, h: 2 }),
      ITEM({ id: 'b', x: 4, y: 0, w: 4, h: 2 }),
      ITEM({ id: 'c', x: 8, y: 0, w: 4, h: 2 }),
    ];
    const pos = findBestWidgetPosition(items, 4, 2, 12);
    expect(pos).toEqual({ x: 0, y: 2 });
  });

  it('优先填补中间空隙', () => {
    const items = [
      ITEM({ id: 'a', x: 0, y: 0, w: 3, h: 2 }),
      ITEM({ id: 'b', x: 6, y: 0, w: 3, h: 2 }),
    ];
    // 中间 x=3..6 有个 3 列的空隙
    const pos = findBestWidgetPosition(items, 3, 2, 12);
    expect(pos).toEqual({ x: 3, y: 0 });
  });

  it('下方空隙也能被填补', () => {
    const items = [
      ITEM({ id: 'a', x: 0, y: 0, w: 6, h: 2 }),
      ITEM({ id: 'b', x: 6, y: 0, w: 6, h: 4 }),
    ];
    // a 下方 y=2..4, x=0..6 有 6x2 的空隙
    const pos = findBestWidgetPosition(items, 6, 2, 12);
    expect(pos).toEqual({ x: 0, y: 2 });
  });

  it('宽组件放不下的空隙会被跳过', () => {
    const items = [
      ITEM({ id: 'a', x: 0, y: 0, w: 3, h: 2 }),
      ITEM({ id: 'b', x: 6, y: 0, w: 3, h: 2 }),
    ];
    // 中间只有 3 列空隙，但新组件宽 6，放不下
    const pos = findBestWidgetPosition(items, 6, 2, 12);
    // y=0 时 x=3 会与 b(6,0,3,2) 冲突（3+6=9>6）；y=2 时 x=0 不冲突，优先左上
    expect(pos).toEqual({ x: 0, y: 2 });
  });
});
