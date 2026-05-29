/**
 * Zustand Store — Smart Sort Slice
 *
 * 智能排序功能的状态管理：
 * - 权重配置（最近访问、频率、时长、域名、手动调整）
 * - 置顶标签列表
 * - 手动调整记录
 * - 运行时评分缓存
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  SmartSortConfig,
  SortWeights,
} from "@/features/smart-sort/types";
import {
  DEFAULT_WEIGHTS,
  DEFAULT_SMART_SORT_CONFIG,
} from "@/features/smart-sort/types";
import { STORAGE_KEYS } from "@/shared/config/storage-keys";

interface SmartSortState extends SmartSortConfig {
  /** 置顶标签 ID 集合 */
  pinnedTabIds: number[];
  /** 用户手动调整记录（序列化为数组） */
  manualOverrides: Array<[number, number]>;
  /** 加载状态 */
  loaded: boolean;
  /** 初始化完成 */
  init: () => void;

  // Actions
  setEnabled: (enabled: boolean) => void;
  setWeights: (weights: SortWeights) => void;
  updateWeight: (key: keyof SortWeights, value: number) => void;
  setDecayRate: (rate: number) => void;
  resetToDefaults: () => void;

  // Pinned tabs
  addPinnedTab: (tabId: number) => void;
  removePinnedTab: (tabId: number) => void;
  togglePinnedTab: (tabId: number) => void;
  clearPinnedTabs: () => void;
  isPinned: (tabId: number) => boolean;

  // Manual overrides
  setManualOverride: (tabId: number, score: number) => void;
  removeManualOverride: (tabId: number) => void;
  clearManualOverrides: () => void;
  getManualOverride: (tabId: number) => number | undefined;
}

export const useSmartSortStore = create<SmartSortState>()(
  persist(
    (set, get) => ({
      // Initial state
      enabled: DEFAULT_SMART_SORT_CONFIG.enabled,
      weights: { ...DEFAULT_WEIGHTS },
      decayRate: DEFAULT_SMART_SORT_CONFIG.decayRate,
      pinnedTabIds: [],
      manualOverrides: [],
      loaded: false,

      init: () => set({ loaded: true }),

      // Actions
      setEnabled: (enabled) => set({ enabled }),

      setWeights: (weights) => set({ weights: { ...weights } }),

      updateWeight: (key, value) =>
        set((state) => ({
          weights: { ...state.weights, [key]: value },
        })),

      setDecayRate: (rate) => set({ decayRate: rate }),

      resetToDefaults: () =>
        set({
          weights: { ...DEFAULT_WEIGHTS },
          decayRate: DEFAULT_SMART_SORT_CONFIG.decayRate,
        }),

      // Pinned tabs
      addPinnedTab: (tabId) =>
        set((state) => {
          if (state.pinnedTabIds.includes(tabId)) return state;
          return {
            pinnedTabIds: [...state.pinnedTabIds, tabId],
          };
        }),

      removePinnedTab: (tabId) =>
        set((state) => ({
          pinnedTabIds: state.pinnedTabIds.filter((id) => id !== tabId),
        })),

      togglePinnedTab: (tabId) => {
        const state = get();
        if (state.pinnedTabIds.includes(tabId)) {
          state.removePinnedTab(tabId);
        } else {
          state.addPinnedTab(tabId);
        }
      },

      clearPinnedTabs: () => set({ pinnedTabIds: [] }),

      isPinned: (tabId) => get().pinnedTabIds.includes(tabId),

      // Manual overrides
      setManualOverride: (tabId, score) =>
        set((state) => {
          const filtered = state.manualOverrides.filter(
            ([id]) => id !== tabId,
          );
          return {
            manualOverrides: [...filtered, [tabId, score]],
          };
        }),

      removeManualOverride: (tabId) =>
        set((state) => ({
          manualOverrides: state.manualOverrides.filter(
            ([id]) => id !== tabId,
          ),
        })),

      clearManualOverrides: () => set({ manualOverrides: [] }),

      getManualOverride: (tabId) => {
        const entry = get().manualOverrides.find(([id]) => id === tabId);
        return entry?.[1];
      },
    }),
    {
      name: STORAGE_KEYS.smartSort,
      partialize: (state) => ({
        enabled: state.enabled,
        weights: state.weights,
        decayRate: state.decayRate,
        pinnedTabIds: state.pinnedTabIds,
        manualOverrides: state.manualOverrides,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.loaded = true;
        }
      },
    },
  ),
);
