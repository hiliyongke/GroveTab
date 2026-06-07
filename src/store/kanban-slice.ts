// @i18n-noscan — 看板列名中文原文在 getDefaultColumns() 中；翻译在 KanbanView 的 t(col.name)
/**
 * Zustand Store — Kanban Slice (F-20 看板视图)
 *
 * 看板数据结构：多列，每列含 KanbanCard 数组。拖拽不关闭原 Tab，
 * 仅在看板中聚合 URL 视图。
 *
 * Slice 依赖关系：
 *   - 独立 slice，不依赖其他 slice（数据自给自足，持久化到 chrome.storage.local）
 *   - 被 AppWorkspace 间接消费（KanbanView 组件读取 columns, loaded）
 */

import { create } from 'zustand';
import type { KanbanCard, KanbanColumn, KanbanLayout } from '@/shared/types';
import { getKanbanLayout, saveKanbanLayout } from '@/repositories';
/**
 * 默认看板列 —— 中文原文，运行时由 KanbanView 通过 t() 翻译。
 * 不使用模块层 translate() 是为了避免循环依赖：
 *   kanban-slice → i18n/core → @/store → kanban-slice
 */
function getDefaultColumns(): KanbanColumn[] {
  return [
    { id: 'work', name: '工作', cards: [] },
    { id: 'study', name: '学习', cards: [] },
    { id: 'fun', name: '娱乐', cards: [] },
    { id: 'later', name: '待看', cards: [] },
  ];
}

interface KanbanState {
  columns: KanbanColumn[];
  loaded: boolean;

  loadKanban: () => Promise<void>;
  addColumn: (name: string, color?: string) => Promise<void>;
  renameColumn: (id: string, name: string) => Promise<void>;
  removeColumn: (id: string) => Promise<void>;
  addCard: (columnId: string, card: KanbanCard) => Promise<void>;
  removeCard: (columnId: string, url: string) => Promise<void>;
  moveCard: (fromColumnId: string, toColumnId: string, url: string, toIndex?: number) => Promise<void>;
  reorderCard: (columnId: string, fromIndex: number, toIndex: number) => Promise<void>;
  /** 列的整体重排序，由列拖拽 UI 触发。 */
  reorderColumns: (fromIndex: number, toIndex: number) => Promise<void>;
  /** 将某列的 URL 列表导出为 ArchivedSession 所需的 url 数组 */
  exportColumnUrls: (columnId: string) => string[];
  reset: () => Promise<void>;
}

export const useKanbanStore = create<KanbanState>((set, get) => ({
  columns: getDefaultColumns(),
  loaded: false,

  loadKanban: async () => {
    const layout = await getKanbanLayout();
    if (!layout || !Array.isArray(layout.columns) || layout.columns.length === 0) {
      set({ columns: getDefaultColumns(), loaded: true });
      return;
    }
    set({ columns: layout.columns, loaded: true });
  },

  addColumn: async (name, color) => {
    const next = [...get().columns, { id: `col-${Date.now()}`, name, color, cards: [] }];
    await persist(next);
    set({ columns: next });
  },

  renameColumn: async (id, name) => {
    const next = get().columns.map((c) => (c.id === id ? { ...c, name } : c));
    await persist(next);
    set({ columns: next });
  },

  removeColumn: async (id) => {
    const next = get().columns.filter((c) => c.id !== id);
    await persist(next);
    set({ columns: next });
  },

  addCard: async (columnId, card) => {
    const next = get().columns.map((c) => {
      if (c.id !== columnId) return c;
      if (c.cards.some((x) => x.url === card.url)) return c;
      return { ...c, cards: [...c.cards, card] };
    });
    await persist(next);
    set({ columns: next });
  },

  removeCard: async (columnId, url) => {
    const next = get().columns.map((c) =>
      c.id === columnId ? { ...c, cards: c.cards.filter((x) => x.url !== url) } : c,
    );
    await persist(next);
    set({ columns: next });
  },

  moveCard: async (fromColumnId, toColumnId, url, toIndex) => {
    const columns = get().columns;
    const fromCol = columns.find((c) => c.id === fromColumnId);
    const card = fromCol?.cards.find((x) => x.url === url);
    if (!card) return;
    const next = columns.map((c) => {
      if (c.id === fromColumnId) {
        return { ...c, cards: c.cards.filter((x) => x.url !== url) };
      }
      if (c.id === toColumnId) {
        const cards = [...c.cards];
        const insertAt = toIndex ?? cards.length;
        cards.splice(insertAt, 0, card);
        return { ...c, cards };
      }
      return c;
    });
    await persist(next);
    set({ columns: next });
  },

  reorderCard: async (columnId, fromIndex, toIndex) => {
    const next = get().columns.map((c) => {
      if (c.id !== columnId) return c;
      const cards = [...c.cards];
      const [item] = cards.splice(fromIndex, 1);
      if (!item) return c;
      cards.splice(toIndex, 0, item);
      return { ...c, cards };
    });
    await persist(next);
    set({ columns: next });
  },

  reorderColumns: async (fromIndex, toIndex) => {
    const columns = [...get().columns];
    if (fromIndex < 0 || fromIndex >= columns.length) return;
    if (toIndex < 0 || toIndex >= columns.length) return;
    const [moved] = columns.splice(fromIndex, 1);
    if (!moved) return;
    columns.splice(toIndex, 0, moved);
    await persist(columns);
    set({ columns });
  },

  exportColumnUrls: (columnId) => {
    const col = get().columns.find((c) => c.id === columnId);
    return col ? col.cards.map((x) => x.url) : [];
  },

  reset: async () => {
    await persist(getDefaultColumns());
    set({ columns: getDefaultColumns() });
  },
}));

async function persist(columns: KanbanColumn[]): Promise<void> {
  const layout: KanbanLayout = { columns, updatedAt: Date.now() };
  await saveKanbanLayout(layout);
}
