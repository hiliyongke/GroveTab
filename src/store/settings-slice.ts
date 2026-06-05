/**
 * Zustand Store — Settings Slice
 *
 * 用户设置状态管理，支持乐观更新与恢复默认配置。
 */

import { create } from "zustand";
import type { UserSettings, AutomationRule, WorkspaceTemplate } from "@/shared/types";
import { CLOSE_CONFIRM_THRESHOLD } from "@/shared/types/settings";
import {
  getSettings,
  saveSettings,
  removeData,
  getAutomationRules,
  getWorkspaceTemplates,
} from "@/repositories";
import { STORAGE_KEYS } from "@/shared/config/storage-keys";

interface SettingsState {
  settings: UserSettings;
  loaded: boolean;
  /** 自动化规则列表（独立于 UserSettings 存储） */
  automationRules: AutomationRule[];
  /** 工作区模板列表（独立于 UserSettings 存储） */
  workspaceTemplates: WorkspaceTemplate[];
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<UserSettings>) => Promise<void>;
  /** 恢复默认配置：同步重置 store 内存状态 + 删除 storage 键，无需刷新页面 */
  resetSettings: () => Promise<void>;
  /** 更新自动化规则列表 */
  setAutomationRules: (rules: AutomationRule[]) => void;
  /** 更新工作区模板列表 */
  setWorkspaceTemplates: (templates: WorkspaceTemplate[]) => void;
}

let settingsWriteQueue: Promise<unknown> = Promise.resolve();

/** 合并设置内存快照，避免嵌套设置被浅合并误覆盖。 */
function mergeSettingsForStore(
  current: UserSettings,
  partial: Partial<UserSettings>,
): UserSettings {
  return {
    ...current,
    ...partial,
    uiVisibility:
      partial.uiVisibility === undefined
        ? current.uiVisibility
        : { ...current.uiVisibility, ...partial.uiVisibility },
  };
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: {
    overrideNewTab: true,
    viewTabPosition: "top",
    defaultView: "tabs",
    theme: "system",
    skinPreset: "glassmorphism",
    showIncognito: false,
    language: "zh-CN",
    domainGroupColumns: "auto",
    windowCardColumns: "auto",
    windowCardShowGroupSection: true,
    windowCardShowGhostDropZone: true,
    windowCardAccentBarPosition: "left",
    windowCardOrder: [],
    windowShowIdleTime: true,
    windowShowHealthIndicator: true,
    timelineGranularity: "day",
    timelineShowExactTime: false,
    searchScope: ["title", "hostname", "url"],
    searchEnablePinyin: true,
    searchSortBy: "relevance",
    searchDefaultEngine: "google",
    searchEnabledEngines: ["google", "bing", "baidu", "duckduckgo"],
    searchCustomEngines: [],
    searchAutoFallbackToWeb: true,
    searchUseHistorySuggestions: true,
    searchUseHotSuggestions: true,
    hotSuggestionSource: "trending",
    layoutDensity: "default",
    contentMaxWidth: 0,
    reducedMotion: "auto",
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
    tabGroupSortBy: "tabCount",
    dedupStrictness: "loose",
    idleThresholdMinutes: 1440,
    undoWindowSeconds: 5,
    closeConfirmThreshold: CLOSE_CONFIRM_THRESHOLD,
    autoSnapshotFrequency: "12h",
    enableOgFetch: false,
    speedDialGroupEnabled: false,
    trackTabFocusTime: true,
    historyEnabled: true,
    historyRecordEvents: true,
    historyMaxClosedTabs: 50,
    historyMaxEvents: 500,
    historyClosedTabsTtlHours: 168,
    historyUrlBlocklist: [],
    memoryGovernanceEnabled: false,
    memoryPressureThreshold: 80,
    memoryPressureAction: "notify",
    memoryGovernanceAllowlist: [],
    memoryGovernanceMaxTabs: 5,
    memoryGovernanceCooldownMinutes: 10,
    popupSortMode: "recent",
    popupSortAsc: false,
    popupGroupByDomain: false,
  },
  loaded: false,
  automationRules: [],
  workspaceTemplates: [],

  loadSettings: async () => {
    const settings = await getSettings();
    const ruleData = await getAutomationRules();
    const templateData = await getWorkspaceTemplates();
    set({
      settings,
      loaded: true,
      automationRules: ruleData.rules,
      workspaceTemplates: templateData.templates,
    });
  },

  /** 乐观更新：先同步更新 UI，再异步持久化。 */
  updateSettings: async (partial) => {
    set((state) => ({ settings: mergeSettingsForStore(state.settings, partial) }));
    const writeTask = settingsWriteQueue.then(() => saveSettings(partial));
    settingsWriteQueue = writeTask.catch(() => undefined);
    try {
      const persisted = await writeTask;
      set({ settings: persisted, loaded: true });
    } catch (err) {
      console.error("[settings] saveSettings failed:", err);
    }
  },

  /** 恢复默认配置：删除存储 → 重新加载默认值。 */
  resetSettings: async () => {
    await removeData(STORAGE_KEYS.settings);
    const settings = await getSettings();
    const ruleData = await getAutomationRules();
    const templateData = await getWorkspaceTemplates();
    set({
      settings,
      loaded: true,
      automationRules: ruleData.rules,
      workspaceTemplates: templateData.templates,
    });
  },

  setAutomationRules: (rules) => {
    set({ automationRules: rules });
  },

  setWorkspaceTemplates: (templates) => {
    set({ workspaceTemplates: templates });
  },
}));
