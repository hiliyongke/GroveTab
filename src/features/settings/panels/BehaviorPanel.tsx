/**
 * BehaviorPanel —— 行为设置 Tab（带锚点导航）
 *
 * 组件结构：
 * 左侧：锚点导航菜单
 * 右侧：8 个设置模块
 *   1. GeneralSettings - 通用行为设置
 *   2. ViewLayoutSettings - 视图与布局设置
 *   3. TimelineSettings - 时间轴设置
 *   4. SearchSettings - 搜索设置
 *   5. MemoryGovernanceSettings - 内存治理
 *   6. ShortcutsPanel - 快捷键
 *   7. AutomationPanel - 自动化规则
 *   8. WorkspaceTemplatesPanel - 工作区模板
 */

import type { UserSettings } from "@/shared/types";
import { Flex, Typography, Anchor } from "antd";
import { useT } from "@/shared/i18n";
import { GeneralSettings } from "./GeneralSettings";
import { ViewLayoutSettings } from "./ViewLayoutSettings";
import { TimelineSettings } from "./TimelineSettings";
import { SearchSettings } from "./SearchSettings";
import { MemoryGovernanceSettings } from "./MemoryGovernanceSettings";
import { ShortcutsPanel } from "./ShortcutsPanel";
import { AutomationPanel } from "./AutomationPanel";
import { WorkspaceTemplatesPanel } from "./WorkspaceTemplatesPanel";
import { useEffect, useRef, useState } from "react";

interface BehaviorPanelProps {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void | Promise<void>;
}

interface SectionConfig {
  key: string;
  title: string;
  href: string;
}

/**
 * 行为设置面板主组件（带锚点导航）
 *
 * 左侧锚点导航，右侧设置内容，点击锚点平滑滚动到对应模块
 */
export function BehaviorPanel({ settings, updateSettings }: BehaviorPanelProps) {
  const { t } = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setActiveSection] = useState<string>("general");

  const sections: SectionConfig[] = [
    { key: "general", title: t("settings.behavior.general.title"), href: "#general" },
    { key: "view-layout", title: t("settings.behavior.viewLayout.title"), href: "#view-layout" },
    { key: "timeline", title: t("settings.behavior.timeline.title"), href: "#timeline" },
    { key: "search", title: t("settings.behavior.search.title"), href: "#search" },
    { key: "memory-governance", title: t("settings.behavior.memoryGovernance.title"), href: "#memory-governance" },
    { key: "shortcuts", title: t("settings.behavior.shortcuts.title"), href: "#shortcuts" },
    { key: "automation", title: t("settings.behavior.automation.title"), href: "#automation" },
    { key: "workspace-templates", title: t("settings.behavior.workspaceTemplates.title"), href: "#workspace-templates" },
  ];

  // 监听滚动，高亮当前可见模块
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionKey = entry.target.getAttribute("data-section");
            if (sectionKey) {
              setActiveSection(sectionKey);
            }
          }
        });
      },
      {
        root: container,
        threshold: 0.5,
        rootMargin: "-100px 0px -50% 0px",
      }
    );

    const sectionElements = container.querySelectorAll("[data-section]");
    sectionElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  const handleAnchorClick = (e: React.MouseEvent<HTMLElement, MouseEvent>, link: { href: string }) => {
    e.preventDefault();
    const sectionKey = link.href.replace("#", "");
    const element = document.querySelector(`[data-section="${sectionKey}"]`);
    if (element && containerRef.current) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(sectionKey);
    }
  };

  return (
    <Flex className="behavior-panel" gap={24}>
      {/* 左侧锚点导航 */}
      <div className="behavior-panel__anchor">
        <Anchor
          affix={false}
          bounds={100}
          targetOffset={100}
          getContainer={() => containerRef.current || window}
          onClick={handleAnchorClick}
          items={sections.map((section) => ({
            key: section.key,
            href: section.href,
            title: section.title,
          }))}
        />
      </div>

      {/* 右侧设置内容 */}
      <div ref={containerRef} className="behavior-panel__content">
        <Flex vertical className="settings-panel-stack" gap={32}>
          {/* 通用行为 */}
          <section data-section="general" id="general" className="settings-section">
            <Typography.Title level={3} className="settings-section__title">
              {t("settings.behavior.general.title")}
            </Typography.Title>
            <Flex vertical className="settings-section__body">
              <GeneralSettings settings={settings} updateSettings={updateSettings} />
            </Flex>
          </section>

          {/* 视图与布局 */}
          <section data-section="view-layout" id="view-layout" className="settings-section">
            <Typography.Title level={3} className="settings-section__title">
              {t("settings.behavior.viewLayout.title")}
            </Typography.Title>
            <Flex vertical className="settings-section__body">
              <ViewLayoutSettings settings={settings} updateSettings={updateSettings} />
            </Flex>
          </section>

          {/* 时间轴 */}
          <section data-section="timeline" id="timeline" className="settings-section">
            <Typography.Title level={3} className="settings-section__title">
              {t("settings.behavior.timeline.title")}
            </Typography.Title>
            <Flex vertical className="settings-section__body">
              <TimelineSettings settings={settings} updateSettings={updateSettings} />
            </Flex>
          </section>

          {/* 搜索 */}
          <section data-section="search" id="search" className="settings-section">
            <Typography.Title level={3} className="settings-section__title">
              {t("settings.behavior.search.title")}
            </Typography.Title>
            <Flex vertical className="settings-section__body">
              <SearchSettings settings={settings} updateSettings={updateSettings} />
            </Flex>
          </section>

          {/* 内存治理 */}
          <section data-section="memory-governance" id="memory-governance" className="settings-section">
            <Typography.Title level={3} className="settings-section__title">
              {t("settings.behavior.memoryGovernance.title")}
            </Typography.Title>
            <Flex vertical className="settings-section__body">
              <MemoryGovernanceSettings settings={settings} updateSettings={updateSettings} />
            </Flex>
          </section>

          {/* 快捷键 */}
          <section data-section="shortcuts" id="shortcuts" className="settings-section">
            <Typography.Title level={3} className="settings-section__title">
              {t("settings.behavior.shortcuts.title")}
            </Typography.Title>
            <Flex vertical className="settings-section__body">
              <ShortcutsPanel />
            </Flex>
          </section>

          {/* 自动化规则 */}
          <section data-section="automation" id="automation" className="settings-section">
            <Typography.Title level={3} className="settings-section__title">
              {t("settings.behavior.automation.title")}
            </Typography.Title>
            <Flex vertical className="settings-section__body">
              <AutomationPanel />
            </Flex>
          </section>

          {/* 工作区模板 */}
          <section data-section="workspace-templates" id="workspace-templates" className="settings-section">
            <Typography.Title level={3} className="settings-section__title">
              {t("settings.behavior.workspaceTemplates.title")}
            </Typography.Title>
            <Flex vertical className="settings-section__body">
              <WorkspaceTemplatesPanel />
            </Flex>
          </section>
        </Flex>
      </div>
    </Flex>
  );
}
