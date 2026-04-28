/**
 * Zustand Store — Selection Slice（多选与批量操作）
 *
 * 职责：
 *   1. 维护全局多选状态：哪些 tabId 被选中、是否处于多选模式
 *   2. 提供切换/全选/清空/范围选等操作
 *   3. 与 tabs-slice 联动：执行批量操作后自动清空选中
 *
 * 设计决策：
 *   - 多选状态是纯 UI 状态，不持久化到 storage
 *   - 选中 ID 用 Set 存储，O(1) 查找
 *   - 批量操作（关闭/休眠/归档）走 tabs-slice 已有的 action，
 *     这里只管"选中谁"和"触发什么操作"
 */

import { create } from 'zustand';

interface SelectionState {
  /** 当前选中的 tab ID 集合 */
  selectedIds: Set<number>;
  /** 是否处于多选模式（长按/Shift 点击后激活） */
  selectionMode: boolean;
  /** 上一次点击的 tabId（用于 Shift 范围选） */
  lastClickedId: number | null;

  // Actions
  /** 切换某个 tab 的选中态；若 selectionMode 未开启则自动开启 */
  toggleSelect: (tabId: number, shiftKey?: boolean, allTabIds?: number[]) => void;
  /** 进入多选模式 */
  enterSelectionMode: () => void;
  /** 退出多选模式并清空选中 */
  exitSelectionMode: () => void;
  /** 全选（传入当前视图所有可见 tab ID） */
  selectAll: (tabIds: number[]) => void;
  /** 清空选中但保留 selectionMode */
  clearSelection: () => void;
  /** 批量操作后清空选中并退出多选模式 */
  resetAfterBatch: () => void;
  /** 从选区中移除已经不存在的标签页。 */
  removeIds: (tabIds: number[]) => void;
  /** 检查某个 tabId 是否被选中 */
  isSelected: (tabId: number) => boolean;
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  selectedIds: new Set<number>(),
  selectionMode: false,
  lastClickedId: null,

  toggleSelect: (tabId, shiftKey = false, allTabIds = []) => {
    const { selectedIds, lastClickedId } = get();

    // Shift 范围选：从上次点击到本次点击之间的 tab 全选
    if (shiftKey && lastClickedId !== null && allTabIds.length > 0) {
      const startIdx = allTabIds.indexOf(lastClickedId);
      const endIdx = allTabIds.indexOf(tabId);
      if (startIdx !== -1 && endIdx !== -1) {
        const [lo, hi] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        const rangeIds = allTabIds.slice(lo, hi + 1);
        const newSet = new Set(selectedIds);
        for (const id of rangeIds) {
          newSet.add(id);
        }
        set({ selectedIds: newSet, selectionMode: true, lastClickedId: tabId });
        return;
      }
    }

    // 普通 toggle
    const newSet = new Set(selectedIds);
    if (newSet.has(tabId)) {
      newSet.delete(tabId);
    } else {
      newSet.add(tabId);
    }
    set({
      selectedIds: newSet,
      selectionMode: newSet.size > 0 ? true : get().selectionMode,
      lastClickedId: tabId,
    });
  },

  enterSelectionMode: () => {
    set({ selectionMode: true });
  },

  exitSelectionMode: () => {
    set({ selectedIds: new Set<number>(), selectionMode: false, lastClickedId: null });
  },

  selectAll: (tabIds) => {
    set({ selectedIds: new Set(tabIds), selectionMode: true });
  },

  clearSelection: () => {
    set({ selectedIds: new Set<number>(), lastClickedId: null });
  },

  resetAfterBatch: () => {
    set({ selectedIds: new Set<number>(), selectionMode: false, lastClickedId: null });
  },

  removeIds: (tabIds) => {
    if (tabIds.length === 0) return;
    const staleIds = new Set(tabIds);
    const next = new Set([...get().selectedIds].filter((id) => !staleIds.has(id)));
    set({
      selectedIds: next,
      selectionMode: next.size > 0 ? get().selectionMode : false,
      lastClickedId: next.has(get().lastClickedId ?? -1) ? get().lastClickedId : null,
    });
  },

  isSelected: (tabId) => get().selectedIds.has(tabId),
}));
