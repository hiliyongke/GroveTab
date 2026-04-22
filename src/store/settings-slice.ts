/**
 * Zustand Store — View Mode Slice
 */

import { create } from 'zustand';
import type { UserSettings } from '@/shared/types';
import { getSettings, saveSettings } from '@/repositories';

interface SettingsState {
  settings: UserSettings;
  loaded: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<UserSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: {
    overrideNewTab: true,
    defaultView: 'domain',
    theme: 'system',
    gradientPreset: 'slate',
    showIncognito: false,
    language: 'zh-CN',
    domainGroupColumns: 'auto',
    timelineGranularity: 'day',
    timelineShowExactTime: false,
  },
  loaded: false,

  loadSettings: async () => {
    const settings = await getSettings();
    set({ settings, loaded: true });
  },

  /**
   * 更新设置：**乐观更新**策略
   *
   * 旧实现是先 `await saveSettings()`（两次 chrome.storage 异步往返）再 `set()`，
   * 导致 UI（视图切换、设置项变更）有明显延迟，甚至在 storage 调用失败时
   * 界面看起来"没反应"。
   *
   * 新实现：
   *   1. 同步合并 & `set` → UI 立即刷新
   *   2. 后台 await `saveSettings` 落盘（本次调用返回 Promise 仍保持 async 语义，
   *      有需要等待持久化的调用者可以 await；UI 不受其阻塞）
   *   3. 若落盘失败（极少见，chrome.storage quota 等），记录到控制台但不回滚 —
   *      下次打开页面会以 storage 为准，暂不做回滚避免 UI 抖动。
   */
  updateSettings: async (partial) => {
    // 1) 同步乐观更新：立刻反映到 UI
    set((state) => ({ settings: { ...state.settings, ...partial } }));
    // 2) 后台落盘
    try {
      await saveSettings(partial);
    } catch (err) {
      console.error('[settings] saveSettings failed:', err);
    }
  },
}));
