/**
 * Kanban Type Definitions
 * 看板相关类型 (F-20)
 */

export interface KanbanCard {
  url: string;
  title: string;
  favIconUrl?: string;
  addedAt: number;
}

export interface KanbanColumn {
  id: string;
  name: string;
  color?: string;
  cards: KanbanCard[];
}

export interface KanbanLayout {
  columns: KanbanColumn[];
  updatedAt: number;
}
