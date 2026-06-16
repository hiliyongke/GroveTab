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

/**
 * 旧版 defaultView → v2 视图体系的迁移映射表（v1.4 核心整合）。
 * 运行期检测到 legacy defaultView 时自动迁移到 tabsSubView / tabsLayout。
 */
export const LEGACY_DEFAULT_VIEW_MIGRATION: Record<
  string,
  { defaultView: string; tabsSubView?: string; tabsLayout?: string }
> = {
  domain: { defaultView: "tabs", tabsLayout: "masonry" },
  compact: { defaultView: "tabs", tabsLayout: "compact" },
  grid: { defaultView: "tabs", tabsLayout: "grid" },
  tabgroup: { defaultView: "tabs", tabsSubView: "tabgroup" },
  window: { defaultView: "tabs", tabsSubView: "window" },
  timeline: { defaultView: "tabs", tabsSubView: "timeline" },
};

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
    viewTabPosition: "right",
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
    tabsSubView: "auto",
    schemaVersion: 2,
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
    // 注：跨设备配置同步（含 settings）由 config-sync 在应用启动时统一拉取并回灌，
    // 此处不再单独处理，避免双重机制。
  },

  /** 乐观更新：先同步更新 UI，再异步持久化。 */
  updateSettings: async (partial) => {
    set((state) => ({ settings: mergeSettingsForStore(state.settings, partial) }));
    const writeTask = settingsWriteQueue.then(() => saveSettings(partial));
    settingsWriteQueue = writeTask.catch(() => undefined);
    try {
      const persisted = await writeTask;
      set({ settings: persisted, loaded: true });
      // 注：开启同步时，settings 的变更由 config-sync 的 storage.onChanged 监听统一推送。
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
