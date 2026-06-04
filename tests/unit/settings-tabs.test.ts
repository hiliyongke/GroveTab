import { describe, expect, it } from "vitest";

import {
  DEFAULT_SETTINGS_TAB,
  isSettingsTabKey,
  normalizeSettingsTab,
} from "@/features/settings/settings-tab-keys";

describe("settings-tab-keys", () => {
  it("识别合法设置页签", () => {
    expect(isSettingsTabKey("appearance")).toBe(true);
    expect(isSettingsTabKey("general")).toBe(true);
    expect(isSettingsTabKey("view-layout")).toBe(true);
    expect(isSettingsTabKey("automation")).toBe(true);
    expect(isSettingsTabKey("system")).toBe(true);
  });

  it("非法或缺失页签回退到默认页签", () => {
    expect(normalizeSettingsTab(undefined)).toBe(DEFAULT_SETTINGS_TAB);
    expect(normalizeSettingsTab("unknown")).toBe(DEFAULT_SETTINGS_TAB);
  });
});
