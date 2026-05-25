/**
 * BehaviorPanel —— 行为设置 Tab（重构版）
 *
 * 组件结构：
 * 1. GeneralSettings - 通用行为设置
 * 2. ViewLayoutSettings - 视图与布局设置
 * 3. TimelineSettings - 时间轴设置
 * 4. SearchSettings - 搜索设置
 */

import type { UserSettings } from "@/shared/types";
import { Typography } from "antd";
import { useT } from "@/shared/i18n";
import { GeneralSettings } from "./GeneralSettings";
import { ViewLayoutSettings } from "./ViewLayoutSettings";
import { TimelineSettings } from "./TimelineSettings";
import { SearchSettings } from "./SearchSettings";

interface BehaviorPanelProps {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void | Promise<void>;
}

/**
 * 行为设置面板主组件
 *
 * 组合多个子组件，按功能模块展示所有行为相关设置项。
 */
export function BehaviorPanel({ settings, updateSettings }: BehaviorPanelProps) {
  const { t } = useT();
  const sections = [
    {
      key: "general",
      title: t('通用行为'),
      content: <GeneralSettings settings={settings} updateSettings={updateSettings} />,
    },
    {
      key: "view-layout",
      title: t('视图与布局'),
      content: <ViewLayoutSettings settings={settings} updateSettings={updateSettings} />,
    },
    {
      key: "timeline",
      title: t('时间轴'),
      content: <TimelineSettings settings={settings} updateSettings={updateSettings} />,
    },
    {
      key: "search",
      title: t('搜索'),
      content: <SearchSettings settings={settings} updateSettings={updateSettings} />,
    },
  ];

  return (
    <div className="settings-panel-stack">
      {sections.map((section) => (
        <section key={section.key} className="settings-section">
          <Typography.Title level={3} className="settings-section__title">
            {section.title}
          </Typography.Title>
          <div className="settings-section__body">{section.content}</div>
        </section>
      ))}
    </div>
  );
}
