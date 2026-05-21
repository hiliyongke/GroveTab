/**
 * Zustand Store — View Mode Slice
 */

import { create } from 'zustand';
import type { UserSettings } from '@/shared/types';
import { getSettings, saveSettings, removeData } from '@/repositories';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';

interface SettingsState {
  settings: UserSettings;
  loaded: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<UserSettings>) => Promise<void>;
  /** 恢复默认配置：同步重置 store 内存状态 + 删除 storage 键，无需刷新页面 */
  resetSettings: () => Promise<void>;
}

let settingsWriteQueue: Promise<unknown> = Promise.resolve();

/** 合并设置内存快照，避免嵌套设置被浅合并误覆盖。 */
function mergeSettingsForStore(current: UserSettings, partial: Partial<UserSettings>): UserSettings {
  return {
    ...current,
    ...partial,
    uiVisibility: partial.uiVisibility === undefined
      ? current.uiVisibility
      : { ...current.uiVisibility, ...partial.uiVisibility },
  };
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: {
    overrideNewTab: true,
    newtabPageMode: 'workspace',
    viewTabPosition: 'top',
    defaultView: 'domain',
    theme: 'system',
    gradientPreset: 'default',
    skinPreset: 'glassmorphism',
    showIncognito: false,
    language: 'zh-CN',
    domainGroupColumns: 'auto',
    timelineGranularity: 'day',
    timelineShowExactTime: false,
    searchScope: ['title', 'hostname', 'url'],
    searchEnablePinyin: true,
    searchSortBy: 'relevance',
    searchDefaultEngine: 'google',
    searchEnabledEngines: ['google', 'bing', 'baidu', 'duckduckgo'],
    searchAutoFallbackToWeb: true,
    searchUseHistorySuggestions: true,
    searchUseHotSuggestions: true,
    layoutDensity: 'default',
    contentMaxWidth: 1360,
    reducedMotion: 'auto',
    uiVisibility: {
      header: true,
      heroLogo: true,
      heroTitle: true,
      heroSlogan: true,
      heroSearch: true,
      viewSwitcher: true,
      tidySuggestion: true,
      quickStart: true,
    },
    // v1.0 封板新增默认值
    dedupStrictness: 'loose',
    idleThresholdMinutes: 1440,
    undoWindowSeconds: 5,
    closeConfirmThreshold: 20,
    autoSnapshotFrequency: '12h',
    enableOgFetch: false,
    speedDialGroupEnabled: false,
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
    set((state) => ({ settings: mergeSettingsForStore(state.settings, partial) }));
    // 2) 串行落盘：避免多个 chrome.storage 写入基于旧快照相互覆盖
    const writeTask = settingsWriteQueue.then(() => saveSettings(partial));
    settingsWriteQueue = writeTask.catch(() => undefined);
    try {
      const persisted = await writeTask;
      set({ settings: persisted, loaded: true });
    } catch (err) {
      console.error('[settings] saveSettings failed:', err);
    }
  },

  /**
   * 恢复默认配置：
   *   1. 删除 storage 中的设置键
   *   2. 重新 loadSettings → getSettings 在 storage 为空时自动返回 DEFAULT_SETTINGS
   *   3. 内存 + storage 同步重置，无需刷新页面
   */
  resetSettings: async () => {
    await removeData(STORAGE_KEYS.settings);
    const settings = await getSettings();
    set({ settings, loaded: true });
  },
}));
