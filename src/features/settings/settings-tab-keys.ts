export type SettingsTabKey = "appearance" | "general" | "view-layout" | "automation" | "system";

export const DEFAULT_SETTINGS_TAB: SettingsTabKey = "appearance";

export function isSettingsTabKey(value: string | undefined): value is SettingsTabKey {
  return (
    value === "appearance" ||
    value === "general" ||
    value === "view-layout" ||
    value === "automation" ||
    value === "system"
  );
}

export function normalizeSettingsTab(value: string | undefined): SettingsTabKey {
  return isSettingsTabKey(value) ? value : DEFAULT_SETTINGS_TAB;
}
