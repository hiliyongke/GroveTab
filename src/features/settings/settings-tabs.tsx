import type { ReactNode } from "react";
import { Database, Info, Layout, Palette, Settings, Zap } from "lucide-react";

import type { UserSettings } from "@/shared/types";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import type { SettingsTabKey } from "./settings-tab-keys";
import { AboutPanel } from "./panels/AboutPanel";
import { AppearancePanel } from "./panels/appearance/AppearancePanel";
import { GeneralSettings } from "./panels/GeneralSettings";
import { SearchSettings } from "./panels/SearchSettings";
import { ShortcutsPanel } from "./panels/ShortcutsPanel";
import { ViewLayoutSettings } from "./panels/ViewLayoutSettings";
import { TimelineSettings } from "./panels/TimelineSettings";
import { AutomationPanel } from "./panels/AutomationPanel";
import { WorkspaceTemplatesPanel } from "./panels/WorkspaceTemplatesPanel";
import { MemoryGovernanceSettings } from "./panels/MemoryGovernanceSettings";
import { DataPanel } from "./panels/DataPanel";
import { PrivacyPanel } from "./panels/PrivacyPanel";

export interface SettingsTabItem {
  key: SettingsTabKey;
  icon: ReactNode;
  labelKey: string;
  content: ReactNode;
}

export interface CreateSettingsTabsOptions {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void | Promise<void>;
}

export function createSettingsTabs({
  settings,
  updateSettings,
}: CreateSettingsTabsOptions): SettingsTabItem[] {
  const iconSize = ICON_SIZE.SMALL;

  return [
    // ── 外观 ──
    {
      key: "appearance",
      icon: <Palette size={iconSize} />,
      labelKey: "settings.appearance",
      content: <AppearancePanel settings={settings} updateSettings={updateSettings} />,
    },
    // ── 通用 ──
    {
      key: "general",
      icon: <Settings size={iconSize} />,
      labelKey: "settings.general",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <GeneralSettings settings={settings} updateSettings={updateSettings} />
          <SearchSettings settings={settings} updateSettings={updateSettings} />
          <TimelineSettings settings={settings} updateSettings={updateSettings} />
          <ShortcutsPanel />
        </div>
      ),
    },
    // ── 视图布局 ──
    {
      key: "view-layout",
      icon: <Layout size={iconSize} />,
      labelKey: "settings.viewLayout",
      content: <ViewLayoutSettings settings={settings} updateSettings={updateSettings} />,
    },
    // ── 自动化 ──
    {
      key: "automation",
      icon: <Zap size={iconSize} />,
      labelKey: "settings.automation",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <AutomationPanel />
          <WorkspaceTemplatesPanel />
          <MemoryGovernanceSettings settings={settings} updateSettings={updateSettings} />
        </div>
      ),
    },
    // ── 系统与关于 ──
    {
      key: "system",
      icon: <Database size={iconSize} />,
      labelKey: "settings.system",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <DataPanel />
          <PrivacyPanel settings={settings} updateSettings={updateSettings} />
          <div style={{ marginTop: 16, padding: "24px 0 0", borderTop: "1px solid var(--ant-color-border-secondary)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Info size={iconSize} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ant-color-text)" }}>关于</span>
            </div>
            <AboutPanel />
          </div>
        </div>
      ),
    },
  ];
}
