/**
 * Zustand Store — Feature Flag Slice
 *
 * Feature flag 运行时状态管理。启动时从 chrome.storage.local 加载，
 * 运行期通过 `setFlag()` 持久化变更，`isEnabled()` 提供同步读取。
 */

import { create } from 'zustand';
import { storageGet, storageSet } from '@/chrome';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';
import {
  FEATURE_FLAG_DEFAULTS,
  type FeatureFlagName,
} from '@/shared/config/feature-flags';

export type { FeatureFlagName } from '@/shared/config/feature-flags';

export interface FeatureFlagState {
  /** 内存中的 flag 值快照 */
  flags: Record<FeatureFlagName, boolean>;
  /** 是否已从 storage 加载完成 */
  loaded: boolean;
  /** 从 chrome.storage.local 加载 flag（storage 中存在的值优先，其余用默认值） */
  loadFlags: () => Promise<void>;
  /** 设置单个 flag 并持久化到 storage */
  setFlag: (name: FeatureFlagName, value: boolean) => Promise<void>;
  /** 同步读取当前内存中的 flag 值 */
  isEnabled: (name: FeatureFlagName) => boolean;
}

export const useFeatureFlagStore = create<FeatureFlagState>((set, get) => ({
  flags: { ...FEATURE_FLAG_DEFAULTS },
  loaded: false,

  loadFlags: async () => {
    try {
      const stored = await storageGet<
        Partial<Record<FeatureFlagName, boolean>>
      >(STORAGE_KEYS.featureFlags);
      const merged: Record<FeatureFlagName, boolean> = {
        ...FEATURE_FLAG_DEFAULTS,
        ...(stored ?? {}),
      };
      set({ flags: merged, loaded: true });
    } catch {
      // storage 不可用时使用默认值
      set({ flags: { ...FEATURE_FLAG_DEFAULTS }, loaded: true });
    }
  },

  setFlag: async (name: FeatureFlagName, value: boolean) => {
    // 乐观更新内存
    set((state) => ({
      flags: { ...state.flags, [name]: value },
    }));
    try {
      await storageSet(STORAGE_KEYS.featureFlags, get().flags);
    } catch (err) {
      console.warn('[feature-flag] setFlag persist failed:', err);
    }
  },

  isEnabled: (name: FeatureFlagName) => {
    return get().flags[name] ?? FEATURE_FLAG_DEFAULTS[name];
  },
}));
