import { Drawer, Flex, Input, Menu, Typography } from "antd";
import { Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { useT } from "@/shared/i18n";
import { ICON_SIZE } from "@/shared/utils/icon-size";
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
  const [searchQuery, setSearchQuery] = useState("");

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredTabs = useMemo(() => {
    if (normalizedQuery === "") return tabs;
    // 命中 labelKey 翻译后的中英文（labelKey 本身常常是中文短语）
    return tabs.filter((tab) => {
      const label = t(tab.labelKey).toLowerCase();
      return label.includes(normalizedQuery) || tab.key.toLowerCase().includes(normalizedQuery);
    });
  }, [tabs, t, normalizedQuery]);

  const activeItem =
    filteredTabs.find((tab) => tab.key === activeTab) ??
    tabs.find((tab) => tab.key === activeTab) ??
    tabs[0];

  const menuItems = useMemo(
    () =>
      filteredTabs.map((tab) => ({
        key: tab.key,
        icon: <span className={styles["settings-nav__icon"]}>{tab.icon}</span>,
        label: <span className={styles["settings-nav__label"]}>{t(tab.labelKey)}</span>,
      })),
    [filteredTabs, t],
  );

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      destroyOnClose
      mask={false}
      width={704}
      title={t("设置")}
      classNames={{
        header: styles["settings-drawer__header"],
        title: styles["settings-drawer__title"],
        body: styles["settings-drawer__body"],
        section: styles["settings-drawer__section"],
      }}
      rootClassName={styles["settings-drawer"]}
    >
      <Flex className={styles["settings-shell"]}>
        <nav className={styles["settings-nav"]} aria-label={t("设置")}>
          <Input
            allowClear
            size="small"
            value={searchQuery}
            placeholder={t("搜索设置")}
            onChange={(event) => setSearchQuery(event.target.value)}
            prefix={<Search size={ICON_SIZE.SMALL} aria-hidden />}
            className={styles["settings-nav__search"]}
            aria-label={t("搜索设置")}
          />
          <Menu
            mode="inline"
            selectedKeys={[activeTab]}
            items={menuItems}
            inlineIndent={12}
            className={styles["settings-nav__menu"]}
            onClick={({ key }) => onActiveTabChange(key as SettingsTabKey)}
          />
          {filteredTabs.length === 0 && normalizedQuery !== "" ? (
            <Typography.Text
              type="secondary"
              className={styles["settings-nav__empty"]}
              role="status"
            >
              {t("没有匹配的设置项")}
            </Typography.Text>
          ) : null}
        </nav>

        <main className={styles["settings-content"]}>
          <Flex align="center" className={styles["settings-content__header"]}>
            <Typography.Title level={2} className={styles["settings-content__title"]}>
              {activeItem ? t(activeItem.labelKey) : null}
            </Typography.Title>
          </Flex>
          <div className={styles["settings-content__body"]}>{activeItem?.content}</div>
        </main>
      </Flex>
    </Drawer>
  );
}
