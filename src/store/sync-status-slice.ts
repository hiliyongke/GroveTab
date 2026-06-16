/**
 * Zustand Store — 跨设备同步状态
 *
 * 仅用于 UI 展示「上次同步时间 / 同步中 / 同步失败」。
 * lastSyncedAt 持久化到 chrome.storage.local，刷新后仍可显示。
 */

import { create } from "zustand";
import { storageGet, storageSet } from "@/chrome";
import { STORAGE_KEYS } from "@/shared/config/storage-keys";

interface SyncStatusState {
  /** 最近一次成功同步（推送或应用远端）的时间戳；null 表示尚未同步 */
  lastSyncedAt: number | null;
  /** 是否正在同步 */
  syncing: boolean;
  /** 最近一次同步是否失败 */
  error: boolean;
  /** 从 storage 加载持久化的 lastSyncedAt */
  loadStatus: () => Promise<void>;
  markSyncing: () => void;
  markSynced: () => void;
  markError: () => void;
}

export const useSyncStatusStore = create<SyncStatusState>((set) => ({
  lastSyncedAt: null,
  syncing: false,
  error: false,

  loadStatus: async () => {
    const ts = await storageGet<number>(STORAGE_KEYS.settingsSyncLastAt);
    set({ lastSyncedAt: typeof ts === "number" ? ts : null });
  },

  markSyncing: () => set({ syncing: true, error: false }),

  markSynced: () => {
    const now = Date.now();
    set({ syncing: false, error: false, lastSyncedAt: now });
    void storageSet(STORAGE_KEYS.settingsSyncLastAt, now);
  },

  markError: () => set({ syncing: false, error: true }),
}));
