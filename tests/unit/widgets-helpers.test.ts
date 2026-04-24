/**
 * widgets-helpers · v1.3
 *
 * 覆盖 TodoWidget / StickyWidget 的纯函数边界逻辑：
 *  - Todo 完成率统计 & 已完成 24h 折叠分组
 *  - Sticky 颜色代号归一（兼容旧 #hex）
 *  - Sticky 旧单条数据 → v1.3 多条结构的迁移
 */

import { describe, it, expect } from 'vitest';
import type { StickyNoteEntry, TodoEntry } from '@/shared/types';

// ── 这些实现与 widgets.tsx 中保持语义一致 ──

const TODO_COLLAPSE_MS = 24 * 60 * 60 * 1000;

function splitTodos(items: TodoEntry[], now: number) {
  const active: TodoEntry[] = [];
  const collapsed: TodoEntry[] = [];
  for (const item of items) {
    if (item.done && typeof item.completedAt === 'number' && now - item.completedAt >= TODO_COLLAPSE_MS) {
      collapsed.push(item);
    } else {
      active.push(item);
    }
  }
  return { active, collapsed };
}

function computeCompletion(items: TodoEntry[]) {
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  return { total, done };
}

const STICKY_COLOR_KEYS = ['yellow', 'pink', 'green', 'blue', 'purple'] as const;
type StickyColorKey = (typeof STICKY_COLOR_KEYS)[number];

function resolveStickyColor(raw?: string): StickyColorKey {
  if (raw && (STICKY_COLOR_KEYS as readonly string[]).includes(raw)) return raw as StickyColorKey;
  return 'yellow';
}

/**
 * 把 v1.2 的单条 sticky（可能为 `[{id, content}]` 或单对象）迁移到 v1.3 多条结构，
 * 并把 #hex / undefined 的颜色归一成 StickyColorKey。
 */
function migrateStickyNotes(raw: unknown): StickyNoteEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((n): n is StickyNoteEntry => n != null && typeof n === 'object' && 'id' in n && typeof (n as StickyNoteEntry).content === 'string')
    .map((n) => ({
      ...n,
      color: resolveStickyColor((n as StickyNoteEntry).color),
    }));
}

describe('TodoWidget 完成率 & 折叠分组', () => {
  it('计算完成率：5 条 3 条已完成', () => {
    const items: TodoEntry[] = [
      { id: '1', text: 'a', done: true, completedAt: Date.now() },
      { id: '2', text: 'b', done: false },
      { id: '3', text: 'c', done: true, completedAt: Date.now() },
      { id: '4', text: 'd', done: false },
      { id: '5', text: 'e', done: true, completedAt: Date.now() },
    ];
    expect(computeCompletion(items)).toEqual({ total: 5, done: 3 });
  });

  it('空列表完成率 0/0', () => {
    expect(computeCompletion([])).toEqual({ total: 0, done: 0 });
  });

  it('已完成超 24h 应被折叠；未完成或 24h 内保持活跃', () => {
    const now = 1_700_000_000_000;
    const items: TodoEntry[] = [
      { id: '1', text: '昨天刚勾', done: true, completedAt: now - 5 * 60 * 60 * 1000 }, // 5h 前
      { id: '2', text: '两天前', done: true, completedAt: now - 48 * 60 * 60 * 1000 }, // 48h 前
      { id: '3', text: '未完成', done: false },
      { id: '4', text: '完成无时间戳（兼容旧数据）', done: true },
    ];
    const { active, collapsed } = splitTodos(items, now);
    expect(active.map((i) => i.id).sort()).toEqual(['1', '3', '4']);
    expect(collapsed.map((i) => i.id)).toEqual(['2']);
  });
});

describe('StickyWidget 颜色归一', () => {
  it('有效色代号原样保留', () => {
    expect(resolveStickyColor('yellow')).toBe('yellow');
    expect(resolveStickyColor('pink')).toBe('pink');
    expect(resolveStickyColor('purple')).toBe('purple');
  });

  it('旧 #hex 色值或 undefined 回落为 yellow', () => {
    expect(resolveStickyColor('#fff7e6')).toBe('yellow');
    expect(resolveStickyColor(undefined)).toBe('yellow');
    expect(resolveStickyColor('')).toBe('yellow');
  });
});

describe('StickyWidget 旧数据迁移', () => {
  it('v1.2 单条 + hex 色值 → v1.3 结构、color 归一', () => {
    const legacy = [{ id: 's1', title: '便签', content: '记得买菜', color: '#fff7e6' }];
    const migrated = migrateStickyNotes(legacy);
    expect(migrated).toHaveLength(1);
    expect(migrated[0]).toMatchObject({ id: 's1', content: '记得买菜', color: 'yellow' });
  });

  it('多条数据完整保留、非法项被过滤', () => {
    const legacy = [
      { id: 'a', content: 'A', color: 'pink' },
      { id: 'b', content: 'B' },
      null,
      { content: '缺 id' },
    ];
    const migrated = migrateStickyNotes(legacy);
    expect(migrated).toHaveLength(2);
    expect(migrated[0].color).toBe('pink');
    expect(migrated[1].color).toBe('yellow');
  });

  it('非数组 raw 返回空数组', () => {
    expect(migrateStickyNotes(null)).toEqual([]);
    expect(migrateStickyNotes('foo')).toEqual([]);
    expect(migrateStickyNotes(undefined)).toEqual([]);
  });
});
