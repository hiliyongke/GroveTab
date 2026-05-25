import { Drawer, Menu, Typography } from "antd";
import { useCallback, useMemo } from "react";

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
  const menuItems = useMemo(
    () =>
      tabs.map((tab) => ({
        key: tab.key,
        icon: <span className={styles["settings-nav__icon"]}>{tab.icon}</span>,
        label: <span className={styles["settings-nav__label"]}>{t(tab.labelKey)}</span>,
      })),
    [tabs, t],
  );

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      destroyOnClose
      width={704}
      title={t('设置')}
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
        <nav className={styles["settings-nav"]} aria-label={t('设置')}>
          <Menu
            mode="inline"
            selectedKeys={[activeTab]}
            items={menuItems}
            inlineIndent={12}
            className={styles["settings-nav__menu"]}
            onClick={({ key }) => onActiveTabChange(key as SettingsTabKey)}
          />
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
