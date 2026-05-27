export type SettingsTabKey = "appearance" | "behavior" | "data" | "privacy" | "about";

export const DEFAULT_SETTINGS_TAB: SettingsTabKey = "appearance";

export function isSettingsTabKey(value: string | undefined): value is SettingsTabKey {
  return (
    value === "appearance" ||
    value === "behavior" ||
    value === "data" ||
    value === "privacy" ||
    value === "about"
  );
}

export function normalizeSettingsTab(value: string | undefined): SettingsTabKey {
  return isSettingsTabKey(value) ? value : DEFAULT_SETTINGS_TAB;
}
