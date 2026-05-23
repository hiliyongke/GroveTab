/**
 * SettingsPanel — 设置抽屉（Drawer 版）
 *
 * 布局：
 *   - 右侧抽屉（带毛玻璃遮罩）
 *   - 左侧图标导航栏 + 右侧内容区（可滚动）
 *
 * 支持受控激活 Tab（defaultActiveTab），便于从外部 hash（#about）直接切到指定 Tab。
 */

import { Drawer, Button, Typography } from "antd";
import { useState, useEffect, useCallback } from "react";
import { Palette, SlidersHorizontal, Database, KeyRound, Info, Shield } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useSettingsStore } from "@/store";
import { useT } from "@/shared/i18n";
import styles from "./settings.module.less";
import { AppearancePanel } from "./panels/AppearancePanel";
import { BehaviorPanel } from "./panels/BehaviorPanel";
import { DataPanel } from "./panels/DataPanel";
import { ShortcutsPanel } from "./panels/ShortcutsPanel";
import { AboutPanel } from "./panels/AboutPanel";
import { PrivacyPanel } from "./panels/PrivacyPanel";

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 初始激活的 Tab（可选），支持 'appearance' | 'behavior' | 'data' | 'shortcuts' | 'about'。 */
  defaultActiveTab?: string;
}

/** Tab 配置项 */
interface TabConfig {
  key: string;
  icon: React.ReactNode;
  labelKey: string;
  component: React.ReactNode;
}

export function SettingsPanel({
  open,
  onOpenChange,
  defaultActiveTab = "appearance",
}: SettingsPanelProps) {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const { t } = useT();
  /** 受控的 Tabs activeKey */
  const [activeTab, setActiveTab] = useState(defaultActiveTab);
  /** 当 defaultActiveTab 变化时，更新 activeTab（支持外部控制初始 Tab） */
  useEffect(() => {
    setActiveTab(defaultActiveTab);
  }, [defaultActiveTab]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  /** Tab 配置 */
  const tabs: TabConfig[] = [
    {
      key: "appearance",
      icon: <Palette size={ICON_SIZE.MEDIUM} />,
      labelKey: "settings.appearance",
      component: <AppearancePanel settings={settings} updateSettings={updateSettings} />,
    },
    {
      key: "behavior",
      icon: <SlidersHorizontal size={ICON_SIZE.MEDIUM} />,
      labelKey: "settings.behavior",
      component: <BehaviorPanel settings={settings} updateSettings={updateSettings} />,
    },
    {
      key: "data",
      icon: <Database size={ICON_SIZE.MEDIUM} />,
      labelKey: "settings.data",
      component: <DataPanel />,
    },
    {
      key: "privacy",
      icon: <Shield size={ICON_SIZE.MEDIUM} />,
      labelKey: "settings.privacy",
      component: <PrivacyPanel settings={settings} updateSettings={updateSettings} />,
    },
    {
      key: "shortcuts",
      icon: <KeyRound size={ICON_SIZE.MEDIUM} />,
      labelKey: "settings.shortcuts",
      component: <ShortcutsPanel />,
    },
    {
      key: "about",
      icon: <Info size={ICON_SIZE.MEDIUM} />,
      labelKey: "settings.about",
      component: <AboutPanel />,
    },
  ];

  /** 当前激活的 Tab 内容 */
  const activeItem = tabs.find((tab) => tab.key === activeTab);

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      destroyOnClose
      width={704}
      title={t("settings.title")}
      classNames={{
        mask: styles["settings-drawer__mask"],
        header: styles["settings-drawer__header"],
        title: styles["settings-drawer__title"],
        body: styles["settings-drawer__body"],
        section: styles["settings-drawer__section"],
      }}
      rootClassName={styles["settings-drawer"]}
    >
      <div className={styles["settings-shell"]}>
        {/* 左侧图标导航 */}
        <nav className={styles["settings-nav"]}>
          <div className={styles["settings-nav__list"]}>
            {tabs.map((tab) => (
              <Button
                key={tab.key}
                type="text"
                className={`${styles["settings-nav__item"]}${activeTab === tab.key ? ` ${styles["is-active"]}` : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <span className={styles["settings-nav__icon"]}>{tab.icon}</span>
                <span className={styles["settings-nav__label"]}>{t(tab.labelKey)}</span>
              </Button>
            ))}
          </div>
        </nav>

        {/* 右侧内容区 */}
        <main className={styles["settings-content"]}>
          <div className={styles["settings-content__header"]}>
            <Typography.Title level={2} className={styles["settings-content__title"]}>
              {activeItem && t(activeItem.labelKey)}
            </Typography.Title>
          </div>
          <div className={styles["settings-content__body"]}>{activeItem?.component}</div>
        </main>
      </div>
    </Drawer>
  );
}
