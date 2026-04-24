/**
 * Kanban 数据操作单元测试 · v1.3
 *
 * 不测 UI，只覆盖 store actions 的纯数据流转：
 *  1. reorderCard：同列内重排序保持卡片顺序正确
 *  2. moveCard：跨列移动时，源列删除且目标列按 toIndex 插入
 *  3. reorderColumns：列索引正确交换
 *
 * 通过给 kanban-slice 直接 setState 注入列数据，再派发 action，断言结果。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// 阻止 repositories 真正读写 chrome.storage（测试环境无 chrome 对象）
vi.mock('@/repositories', () => ({
  getKanbanLayout: vi.fn().mockResolvedValue(null),
  saveKanbanLayout: vi.fn().mockResolvedValue(undefined),
}));

import { useKanbanStore } from '@/store/kanban-slice';
import type { KanbanColumn } from '@/shared/types';

const mk = (id: string, cards: string[] = []): KanbanColumn => ({
  id,
  name: id,
  cards: cards.map((url) => ({ url, title: url, favIconUrl: '', addedAt: 0 })),
});

beforeEach(() => {
  // 重置 store 到已知初态
  useKanbanStore.setState({
    columns: [mk('a', ['x', 'y', 'z']), mk('b', ['1', '2']), mk('c', [])],
    loaded: true,
  });
});

describe('reorderCard（列内重排序）', () => {
  it('把 a 列的 "x" 从 index 0 移到 index 2，结果应为 [y, z, x]', async () => {
    await useKanbanStore.getState().reorderCard('a', 0, 2);
    const col = useKanbanStore.getState().columns.find((c) => c.id === 'a');
    expect(col?.cards.map((c) => c.url)).toEqual(['y', 'z', 'x']);
  });

  it('把 a 列的 "z" 从 index 2 移到 index 0，结果应为 [z, x, y]', async () => {
    await useKanbanStore.getState().reorderCard('a', 2, 0);
    const col = useKanbanStore.getState().columns.find((c) => c.id === 'a');
    expect(col?.cards.map((c) => c.url)).toEqual(['z', 'x', 'y']);
  });

  it('不影响其他列', async () => {
    await useKanbanStore.getState().reorderCard('a', 0, 2);
    const b = useKanbanStore.getState().columns.find((c) => c.id === 'b');
    expect(b?.cards.map((c) => c.url)).toEqual(['1', '2']);
  });
});

describe('moveCard（跨列移动）', () => {
  it('把 a 列的 "y" 移到 b 列末尾（未指定 toIndex）', async () => {
    await useKanbanStore.getState().moveCard('a', 'b', 'y');
    const cols = useKanbanStore.getState().columns;
    expect(cols.find((c) => c.id === 'a')?.cards.map((c) => c.url)).toEqual(['x', 'z']);
    expect(cols.find((c) => c.id === 'b')?.cards.map((c) => c.url)).toEqual(['1', '2', 'y']);
  });

  it('把 a 列的 "x" 插入到 b 列 index 1', async () => {
    await useKanbanStore.getState().moveCard('a', 'b', 'x', 1);
    const cols = useKanbanStore.getState().columns;
    expect(cols.find((c) => c.id === 'a')?.cards.map((c) => c.url)).toEqual(['y', 'z']);
    expect(cols.find((c) => c.id === 'b')?.cards.map((c) => c.url)).toEqual(['1', 'x', '2']);
  });
});

describe('reorderColumns（列排序）', () => {
  it('把 index 0 移到 index 2，结果顺序应为 [b, c, a]', async () => {
    await useKanbanStore.getState().reorderColumns(0, 2);
    expect(useKanbanStore.getState().columns.map((c) => c.id)).toEqual(['b', 'c', 'a']);
  });

  it('把 index 2 移到 index 0，结果顺序应为 [c, a, b]', async () => {
    await useKanbanStore.getState().reorderColumns(2, 0);
    expect(useKanbanStore.getState().columns.map((c) => c.id)).toEqual(['c', 'a', 'b']);
  });

  it('无效索引时安全忽略（不抛错、不改变顺序）', async () => {
    const before = useKanbanStore.getState().columns.map((c) => c.id);
    await useKanbanStore.getState().reorderColumns(-1, 2);
    await useKanbanStore.getState().reorderColumns(0, 10);
    expect(useKanbanStore.getState().columns.map((c) => c.id)).toEqual(before);
  });
});
