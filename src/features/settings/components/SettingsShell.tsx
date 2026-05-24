import { Button, Drawer, Typography } from "antd";
import { useCallback } from "react";

import { useT } from "@/shared/i18n";
import type { SettingsTabKey } from "../settings-tab-keys";
import type { SettingsTabItem } from "../settings-tabs";
import styles from "../settings.module.less";

interface SettingsShellProps {
  open: boolean;
  activeTab: SettingsTabKey;
  tabs: SettingsTabItem[];
  onActiveTabChange: (tab: SettingsTabKey) => void;
  onOpenChange: (open: boolean) => void;
}

export function SettingsShell({
  open,
  activeTab,
  tabs,
  onActiveTabChange,
  onOpenChange,
}: SettingsShellProps) {
  const { t } = useT();
  const activeItem = tabs.find((tab) => tab.key === activeTab) ?? tabs[0];

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

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
        <nav className={styles["settings-nav"]} aria-label={t("settings.title")}>
          <div className={styles["settings-nav__list"]}>
            {tabs.map((tab) => {
              const selected = activeTab === tab.key;
              return (
                <Button
                  key={tab.key}
                  type="text"
                  aria-current={selected ? "page" : undefined}
                  className={`${styles["settings-nav__item"]}${selected ? ` ${styles["is-active"]}` : ""}`}
                  onClick={() => onActiveTabChange(tab.key)}
                >
                  <span className={styles["settings-nav__icon"]}>{tab.icon}</span>
                  <span className={styles["settings-nav__label"]}>{t(tab.labelKey)}</span>
                </Button>
              );
            })}
          </div>
        </nav>

        <main className={styles["settings-content"]}>
          <div className={styles["settings-content__header"]}>
            <Typography.Title level={2} className={styles["settings-content__title"]}>
              {activeItem ? t(activeItem.labelKey) : null}
            </Typography.Title>
          </div>
          <div className={styles["settings-content__body"]}>{activeItem?.content}</div>
        </main>
      </div>
    </Drawer>
  );
}
