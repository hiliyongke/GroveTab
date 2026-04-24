/**
 * Dashboard layout-migrator 单元测试
 *
 * 覆盖：
 *  1. toRglLayout / fromRglLayout 双向无损
 *  2. clampLayout 越界 clamp 正确
 *  3. compactLayoutVertical 垂直紧凑顺序正确
 */

import { describe, it, expect } from 'vitest';
import {
  clampLayout,
  compactLayoutVertical,
  fromRglLayout,
  toRglLayout,
} from '@/features/dashboard-widgets/layout-migrator';
import type { DashboardWidgetLayoutItem } from '@/shared/types';

const ITEM = (
  overrides: Partial<DashboardWidgetLayoutItem> & { id: string },
): DashboardWidgetLayoutItem => ({
  id: overrides.id,
  type: 'clock',
  title: 't',
  x: 0,
  y: 0,
  w: 3,
  h: 2,
  ...overrides,
});

describe('toRglLayout / fromRglLayout', () => {
  it('双向转换保持几何字段无损', () => {
    const source: DashboardWidgetLayoutItem[] = [
      ITEM({ id: 'a', x: 0, y: 0, w: 3, h: 2 }),
      ITEM({ id: 'b', x: 3, y: 0, w: 6, h: 2 }),
      ITEM({ id: 'c', x: 0, y: 2, w: 4, h: 3 }),
    ];
    const rgl = toRglLayout(source);
    const back = fromRglLayout(rgl, source);
    // id/type/title 保留，x/y/w/h 相等
    for (let i = 0; i < source.length; i++) {
      expect(back[i].id).toBe(source[i].id);
      expect(back[i].type).toBe(source[i].type);
      expect(back[i].x).toBe(source[i].x);
      expect(back[i].y).toBe(source[i].y);
      expect(back[i].w).toBe(source[i].w);
      expect(back[i].h).toBe(source[i].h);
    }
  });

  it('fromRglLayout 忽略 source 中找不到 id 的条目', () => {
    const source: DashboardWidgetLayoutItem[] = [ITEM({ id: 'a' })];
    const rgl = [
      { i: 'a', x: 0, y: 0, w: 3, h: 2 },
      { i: 'ghost', x: 0, y: 2, w: 3, h: 2 },
    ];
    const back = fromRglLayout(rgl, source);
    expect(back).toHaveLength(1);
    expect(back[0].id).toBe('a');
  });
});

describe('clampLayout: 越界夹紧', () => {
  it('超出右边界的 x 被夹进来', () => {
    const source = [ITEM({ id: 'a', x: 15, w: 3 })]; // 默认 12 列
    const out = clampLayout(source);
    expect(out[0].x + out[0].w).toBeLessThanOrEqual(12);
  });

  it('宽度过大被夹到最大宽', () => {
    const source = [ITEM({ id: 'a', x: 0, w: 100, h: 200 })];
    const out = clampLayout(source);
    expect(out[0].w).toBeLessThanOrEqual(12);
    expect(out[0].h).toBeLessThanOrEqual(6);
  });

  it('负数 y 被夹到 0', () => {
    const source = [ITEM({ id: 'a', x: 0, y: -5, w: 3, h: 2 })];
    const out = clampLayout(source);
    expect(out[0].y).toBe(0);
  });

  it('宽度过小被夹到最小宽 2', () => {
    const source = [ITEM({ id: 'a', x: 0, w: 1, h: 1 })];
    const out = clampLayout(source);
    expect(out[0].w).toBeGreaterThanOrEqual(2);
    expect(out[0].h).toBeGreaterThanOrEqual(2);
  });
});

describe('compactLayoutVertical: 垂直紧凑', () => {
  it('两个水平不重叠的 item 保留各自 y', () => {
    const source: DashboardWidgetLayoutItem[] = [
      ITEM({ id: 'a', x: 0, y: 0, w: 3, h: 2 }),
      ITEM({ id: 'b', x: 6, y: 0, w: 3, h: 2 }),
    ];
    const out = compactLayoutVertical(source);
    expect(out[0].y).toBe(0);
    expect(out[1].y).toBe(0);
  });

  it('中间有空隙的 item 会被向上吸附', () => {
    const source: DashboardWidgetLayoutItem[] = [
      ITEM({ id: 'a', x: 0, y: 0, w: 12, h: 2 }),
      // b 本来位于 y=10，应被压缩到 y=2
      ITEM({ id: 'b', x: 0, y: 10, w: 12, h: 2 }),
    ];
    const out = compactLayoutVertical(source);
    expect(out[0].y).toBe(0);
    expect(out[1].y).toBe(2);
  });

  it('水平相交的 item 会叠向下方', () => {
    const source: DashboardWidgetLayoutItem[] = [
      ITEM({ id: 'a', x: 0, y: 0, w: 6, h: 3 }),
      ITEM({ id: 'b', x: 3, y: 0, w: 6, h: 2 }), // 与 a 水平相交
    ];
    const out = compactLayoutVertical(source);
    expect(out[0].y).toBe(0);
    expect(out[1].y).toBe(3); // 叠到 a 下方
  });
});
