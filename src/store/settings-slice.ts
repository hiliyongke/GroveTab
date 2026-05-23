/**
 * Zustand Store — Settings Slice
 *
 * Slice 依赖关系（下游依赖本 slice 的有）：
 *   - tabs-slice：读取 settings（defaultView, uiVisibility, closeConfirmThreshold 等）
 *   - undo-slice：读取 settings（undoWindowSeconds）
 *   - metadata-slice：间接依赖（通过 tabs-slice 关闭后的 undo 逻辑）
 *   - stats-slice：无直接依赖
 *   - useAppInitialization：读取 settings（初始化加载）
 *   - AppWorkspace：读取 settings（pageMode, contentMaxWidth 等 UI 配置）
 */

import { create } from 'zustand';
import type { UserSettings } from '@/shared/types';
import { getSettings, saveSettings, removeData, DEFAULT_SETTINGS } from '@/repositories';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';

interface SettingsState {
  /** 用户设置对象（内存快照，乐观更新） */
  settings: UserSettings;
  /** 是否已从 storage 完成首次加载 */
  loaded: boolean;

  // Actions
  /** 从 chrome.storage.local 加载设置到内存 */
  loadSettings: () => Promise<void>;
  /**
   * 更新设置（乐观更新策略）
   *
   * 先同步合并到内存并触发 UI 刷新，再后台串行落盘，
   * 避免存储 I/O 阻塞用户界面。
   *
   * @param partial 要更新的部分设置
   */
  updateSettings: (partial: Partial<UserSettings>) => Promise<void>;
  /** 恢复默认配置：同步重置 store 内存状态 + 删除 storage 键，无需刷新页面 */
  resetSettings: () => Promise<void>;
}

let settingsWriteQueue: Promise<unknown> = Promise.resolve();

/**
 * 合并设置内存快照，避免嵌套设置被浅合并误覆盖。
 *
 * 特殊处理 uiVisibility：因为它是嵌套对象，需要深层合并，
 * 否则 `updateSettings({ uiVisibility: { someField: value } })` 会覆盖整个 uiVisibility。
 *
 * @param current 当前完整的用户设置
 * @param partial 要合并的部分设置
 * @returns 合并后的完整用户设置
 */
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
  settings: { ...DEFAULT_SETTINGS },
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
   * @param partial
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
