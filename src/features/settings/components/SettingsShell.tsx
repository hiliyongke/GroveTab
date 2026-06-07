import { Drawer, Flex, Tabs, Typography } from "antd";
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

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      mask={false}
      size="large"
      title={t("设置")}
      classNames={{
        header: styles["settings-drawer__header"],
        title: styles["settings-drawer__title"],
        body: styles["settings-drawer__body"],
      }}
    >
      <Flex vertical className={styles["settings-shell"]}>
        <Tabs
          tabPosition="left"
          activeKey={activeTab}
          onChange={(key) => onActiveTabChange(key as SettingsTabKey)}
          size="small"
          className={styles["settings-tabs"]}
          items={tabs.map((tab) => ({
            key: tab.key,
            label: (
              <Flex align="center" gap={8}>
                {tab.icon}
                <Typography.Text>{tab.label}</Typography.Text>
              </Flex>
            ),
            children: <div className={styles["settings-content__body"]}>{tab.content}</div>,
          }))}
        />
      </Flex>
    </Drawer>
  );
}
