/**
 * SettingsPanel — 设置抽屉（Drawer 版）
 *
 * 布局：
 *   - 右侧抽屉（带毛玻璃遮罩）
 *   - 左侧图标导航栏 + 右侧内容区（可滚动）
 *
 * 支持受控激活 Tab（defaultActiveTab），便于从外部 hash（#about）直接切到指定 Tab。
 */

import { useEffect, useMemo, useState } from "react";

import { useT } from "@/shared/i18n";
import { useSettingsStore } from "@/store";
import { SettingsShell } from "./components/SettingsShell";
import { createSettingsTabs } from "./settings-tabs";
import { normalizeSettingsTab, type SettingsTabKey } from "./settings-tab-keys";

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 初始激活的 Tab，非法值会回退到 appearance。 */
  defaultActiveTab?: string;
}

export function SettingsPanel({
  open,
  onOpenChange,
  defaultActiveTab = "appearance",
}: SettingsPanelProps) {
  const { t } = useT();
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const [activeTab, setActiveTab] = useState<SettingsTabKey>(() =>
    normalizeSettingsTab(defaultActiveTab),
  );

  useEffect(() => {
    setActiveTab(normalizeSettingsTab(defaultActiveTab));
  }, [defaultActiveTab]);

  const tabs = useMemo(
    () => createSettingsTabs({ settings, updateSettings, t }),
    [settings, updateSettings, t],
  );

  return (
    <SettingsShell
      open={open}
      activeTab={activeTab}
      tabs={tabs}
      onActiveTabChange={setActiveTab}
      onOpenChange={onOpenChange}
    />
  );
}
