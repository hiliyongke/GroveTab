/**
 * Settings Slice 单元测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock 外部依赖
vi.mock("@/repositories", () => ({
  getSettings: vi.fn().mockResolvedValue({ theme: "dark" }),
  saveSettings: vi.fn().mockResolvedValue(undefined),
  removeData: vi.fn().mockResolvedValue(undefined),
  getAutomationRules: vi.fn().mockResolvedValue({ rules: [] }),
  getWorkspaceTemplates: vi.fn().mockResolvedValue({ templates: [] }),
}));

vi.mock("@/shared/config/storage-keys", () => ({
  STORAGE_KEYS: { settings: "grove_settings" },
}));

import { useSettingsStore } from "@/store/settings-slice";
import { getSettings, saveSettings, removeData } from "@/repositories";

const DEFAULT_SETTINGS = {
  overrideNewTab: true,
  newtabPageMode: "workspace" as const,
  viewTabPosition: "top" as const,
  defaultView: "tabs" as const,
  theme: "system" as const,
  skinPreset: "glassmorphism" as const,
  showIncognito: false,
  language: "zh-CN" as const,
  domainGroupColumns: "auto" as const,
  windowCardColumns: "auto" as const,
  windowCardDefaultCollapsed: "current-only" as const,
  windowCardShowGroupSection: true,
  windowCardShowGhostDropZone: true,
  windowCardAccentBarPosition: "left" as const,
  windowCardOrder: [] as number[],
  timelineGranularity: "day" as const,
  timelineShowExactTime: false,
  searchScope: ["title", "hostname", "url"] as const,
  searchEnablePinyin: true,
  searchSortBy: "relevance" as const,
  searchDefaultEngine: "google" as const,
  searchEnabledEngines: ["google", "bing", "baidu", "duckduckgo"] as const,
  searchCustomEngines: [] as unknown[],
  searchAutoFallbackToWeb: true,
  searchUseHistorySuggestions: true,
  searchUseHotSuggestions: true,
  hotSuggestionSource: "trending" as const,
  layoutDensity: "default" as const,
  contentMaxWidth: 0,
  reducedMotion: "auto" as const,
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
  tabGroupSortBy: "tabCount" as const,
  dedupStrictness: "loose" as const,
  idleThresholdMinutes: 1440,
  undoWindowSeconds: 5,
  closeConfirmThreshold: 20,
  autoSnapshotFrequency: "12h" as const,
  enableOgFetch: false,
  speedDialGroupEnabled: false,
  trackTabFocusTime: true,
  historyEnabled: true,
  historyRecordEvents: true,
  historyMaxClosedTabs: 50,
  historyMaxEvents: 500,
  historyClosedTabsTtlHours: 168,
  historyUrlBlocklist: [] as string[],
  memoryGovernanceEnabled: false,
  memoryPressureThreshold: 80,
  memoryPressureAction: "notify" as const,
  memoryGovernanceAllowlist: [] as string[],
  memoryGovernanceMaxTabs: 5,
  memoryGovernanceCooldownMinutes: 10,
};

beforeEach(() => {
  vi.clearAllMocks();
  useSettingsStore.setState({
    settings: { ...DEFAULT_SETTINGS },
    loaded: false,
    automationRules: [],
    workspaceTemplates: [],
  });
});

describe("loadSettings", () => {
  it("加载后 settings 不为空且 loaded 为 true", async () => {
    (getSettings as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ theme: "dark" });
    await useSettingsStore.getState().loadSettings();
    const state = useSettingsStore.getState();
    expect(state.settings).toBeDefined();
    expect(state.loaded).toBe(true);
  });
});

describe("updateSettings", () => {
  it("更新单个字段", async () => {
    (saveSettings as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...DEFAULT_SETTINGS,
      theme: "dark",
    });
    await useSettingsStore.getState().updateSettings({ theme: "dark" });
    // 乐观更新后 theme 应为 dark
    expect(useSettingsStore.getState().settings.theme).toBe("dark");
    expect(saveSettings).toHaveBeenCalledWith({ theme: "dark" });
  });

  it("uiVisibility 合并逻辑：只传部分字段不丢失其他字段", async () => {
    (saveSettings as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (partial: Record<string, unknown>) => ({
        ...DEFAULT_SETTINGS,
        ...partial,
        uiVisibility: {
          ...DEFAULT_SETTINGS.uiVisibility,
          ...(partial.uiVisibility as Record<string, unknown>),
        },
      }),
    );
    await useSettingsStore.getState().updateSettings({ uiVisibility: { heroLogo: false } });

    const { uiVisibility } = useSettingsStore.getState().settings;
    expect(uiVisibility.heroLogo).toBe(false);
    // 其他字段应保留
    expect(uiVisibility.header).toBe(true);
    expect(uiVisibility.heroSearch).toBe(true);
  });
});

describe("resetSettings", () => {
  it("重置后恢复默认值", async () => {
    // 先改一个值
    (saveSettings as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...DEFAULT_SETTINGS,
      theme: "dark",
    });
    await useSettingsStore.getState().updateSettings({ theme: "dark" });
    expect(useSettingsStore.getState().settings.theme).toBe("dark");

    // 重置
    (removeData as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    (getSettings as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...DEFAULT_SETTINGS,
    });
    await useSettingsStore.getState().resetSettings();
    expect(useSettingsStore.getState().settings.theme).toBe("system");
    expect(removeData).toHaveBeenCalled();
  });
});

describe("mergeSettingsForStore", () => {
  it("嵌套设置合并正确：uiVisibility 部分覆盖不影响其他子字段", () => {
    // 此函数不是 export 的，但 updateSettings 内部调用了它
    // 通过 updateSettings 来间接验证
    const store = useSettingsStore;
    store.setState({
      settings: {
        ...DEFAULT_SETTINGS,
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
      },
    });

    // 同步设置部分 uiVisibility
    // updateSettings 是 async，但乐观更新是同步的，我们直接看内存状态
    (saveSettings as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...DEFAULT_SETTINGS,
      uiVisibility: { ...DEFAULT_SETTINGS.uiVisibility, header: false, viewSwitcher: false },
    });
    store.getState().updateSettings({ uiVisibility: { header: false, viewSwitcher: false } });

    const { uiVisibility } = store.getState().settings;
    expect(uiVisibility.header).toBe(false);
    expect(uiVisibility.viewSwitcher).toBe(false);
    expect(uiVisibility.heroLogo).toBe(true);
    expect(uiVisibility.heroSearch).toBe(true);
    expect(uiVisibility.quickStart).toBe(true);
  });

  it("不传 uiVisibility 时保持原值", () => {
    const store = useSettingsStore;
    store.setState({ settings: { ...DEFAULT_SETTINGS } });
    (saveSettings as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...DEFAULT_SETTINGS,
      theme: "dark",
    });
    store.getState().updateSettings({ theme: "dark" });
    expect(store.getState().settings.uiVisibility).toEqual(DEFAULT_SETTINGS.uiVisibility);
  });
});
