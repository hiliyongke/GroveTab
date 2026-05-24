import type { ReactNode } from "react";
import { Database, Info, KeyRound, Palette, Shield, SlidersHorizontal } from "lucide-react";

import type { UserSettings } from "@/shared/types";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import type { SettingsTabKey } from "./settings-tab-keys";
import { AboutPanel } from "./panels/AboutPanel";
import { AppearancePanel } from "./panels/AppearancePanel";
import { BehaviorPanel } from "./panels/BehaviorPanel";
import { DataPanel } from "./panels/DataPanel";
import { PrivacyPanel } from "./panels/PrivacyPanel";
import { ShortcutsPanel } from "./panels/ShortcutsPanel";

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
  return [
    {
      key: "appearance",
      icon: <Palette size={ICON_SIZE.MEDIUM} />,
      labelKey: "settings.appearance",
      content: <AppearancePanel settings={settings} updateSettings={updateSettings} />,
    },
    {
      key: "behavior",
      icon: <SlidersHorizontal size={ICON_SIZE.MEDIUM} />,
      labelKey: "settings.behavior",
      content: <BehaviorPanel settings={settings} updateSettings={updateSettings} />,
    },
    {
      key: "data",
      icon: <Database size={ICON_SIZE.MEDIUM} />,
      labelKey: "settings.data",
      content: <DataPanel />,
    },
    {
      key: "privacy",
      icon: <Shield size={ICON_SIZE.MEDIUM} />,
      labelKey: "settings.privacy",
      content: <PrivacyPanel settings={settings} updateSettings={updateSettings} />,
    },
    {
      key: "shortcuts",
      icon: <KeyRound size={ICON_SIZE.MEDIUM} />,
      labelKey: "settings.shortcuts",
      content: <ShortcutsPanel />,
    },
    {
      key: "about",
      icon: <Info size={ICON_SIZE.MEDIUM} />,
      labelKey: "settings.about",
      content: <AboutPanel />,
    },
  ];
}
