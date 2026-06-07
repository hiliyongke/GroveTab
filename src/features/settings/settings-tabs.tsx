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

const GAP = { display: "flex", flexDirection: "column", gap: 20 } as const;

export interface SettingsTabItem {
  key: SettingsTabKey;
  icon: ReactNode;
  label: string;
  content: ReactNode;
}

export interface CreateSettingsTabsOptions {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void | Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function createSettingsTabs({
  settings,
  updateSettings,
  t,
}: CreateSettingsTabsOptions): SettingsTabItem[] {
  const iconSize = ICON_SIZE.SMALL;
  const advanced = settings.showAdvancedSettings === true;

  return [
    // ── 外观 ──
    {
      key: "appearance",
      icon: <Palette size={iconSize} />,
      label: t("外观"),
      content: <AppearancePanel settings={settings} updateSettings={updateSettings} />,
    },
    // ── 通用 ──
    {
      key: "general",
      icon: <Settings size={iconSize} />,
      label: t("通用"),
      content: (
        <div style={GAP}>
          <GeneralSettings settings={settings} updateSettings={updateSettings} />
          <SearchSettings settings={settings} updateSettings={updateSettings} />
          {advanced && <TimelineSettings settings={settings} updateSettings={updateSettings} />}
          {advanced && <ShortcutsPanel />}
        </div>
      ),
    },
    // ── 视图布局 ──
    {
      key: "view-layout",
      icon: <Layout size={iconSize} />,
      label: t("视图布局"),
      content: <ViewLayoutSettings settings={settings} updateSettings={updateSettings} />,
    },
    // ── 自动化 ──
    {
      key: "automation",
      icon: <Zap size={iconSize} />,
      label: t("自动化"),
      content: (
        <div style={GAP}>
          <AutomationPanel />
          <WorkspaceTemplatesPanel />
          {advanced && <MemoryGovernanceSettings settings={settings} updateSettings={updateSettings} />}
        </div>
      ),
    },
    // ── 系统 ──
    {
      key: "system",
      icon: <Database size={iconSize} />,
      label: t("系统"),
      content: (
        <div style={GAP}>
          <DataPanel />
          <PrivacyPanel settings={settings} updateSettings={updateSettings} />
        </div>
      ),
    },
    // ── 关于 ──
    {
      key: "about",
      icon: <Info size={iconSize} />,
      label: t("关于"),
      content: (
        <div style={GAP}>
          <AboutPanel />
        </div>
      ),
    },
  ];
}


