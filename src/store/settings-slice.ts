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
    gradientPreset: 'aurora',
    showIncognito: false,
    language: 'zh-CN',
  },
  loaded: false,

  loadSettings: async () => {
    const settings = await getSettings();
    set({ settings, loaded: true });
  },

  updateSettings: async (partial) => {
    const merged = await saveSettings(partial);
    set({ settings: merged });
  },
}));
