/**
 * SystemPanel —— 系统设置 Tab
 *
 * 合并数据管理 + 隐私设置：
 * 1. DataPanel - 配置预设、存储配额、导入导出
 * 2. PrivacyPanel - 历史记录、隐私控制
 */

import type { UserSettings } from "@/shared/types";
import { Flex, Typography } from "antd";
import { useT } from "@/shared/i18n";
import { DataPanel } from "./DataPanel";
import { PrivacyPanel } from "./PrivacyPanel";

interface SystemPanelProps {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void | Promise<void>;
}

export function SystemPanel({ settings, updateSettings }: SystemPanelProps) {
  const { t } = useT();
  const sections = [
    {
      key: "data",
      title: t("数据管理"),
      content: <DataPanel />,
    },
    {
      key: "privacy",
      title: t("隐私与安全"),
      content: <PrivacyPanel settings={settings} updateSettings={updateSettings} />,
    },
  ];

  return (
    <Flex vertical className="settings-panel-stack">
      {sections.map((section) => (
        <section key={section.key} className="settings-section">
          <Typography.Title level={3} className="settings-section__title">
            {section.title}
          </Typography.Title>
          <Flex vertical className="settings-section__body">
            {section.content}
          </Flex>
        </section>
      ))}
    </Flex>
  );
}
