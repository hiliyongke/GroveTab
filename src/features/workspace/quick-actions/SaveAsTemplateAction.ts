/**
 * SaveAsTemplateAction — 保存当前标签页为工作区模板。
 */

import { feedback } from "@/shared/ui/feedback";
import { useSettingsStore } from "@/store";
import { useTabsStore } from "@/store";
import { translate } from "@/shared/i18n/core";
import type { WorkspaceTemplate, TemplateTab } from "@/shared/types/workspace-template";

/**
 * 保存当前标签页为模板
 * 可从 CommandPalette 命令调用，无需导航到设置面板
 */
export function saveAsTemplateAction(): void {
  const tabs = useTabsStore.getState().tabs;

  feedback.modal.confirm({
    title: translate("保存为工作区模板"),
    content: translate("将当前 {count} 个标签页保存为模板，稍后可一键恢复。", { count: tabs.length }),
    okText: translate("保存"),
    cancelText: translate("取消"),
    onOk: () => {
      const name = translate("模板 {date}", { date: new Date().toLocaleDateString() });
      const templateTabs: TemplateTab[] = tabs.map((tab) => ({
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl,
      }));

      const newTemplate: WorkspaceTemplate = {
        id: `tpl_${Date.now()}`,
        name,
        tabs: templateTabs,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const currentTemplates = useSettingsStore.getState().workspaceTemplates;
      useSettingsStore.getState().setWorkspaceTemplates([...currentTemplates, newTemplate]);

      feedback.success(
        translate("已保存模板「{name}」({count} 个标签页 )", { name, count: tabs.length }),
      );
    },
  });
}

/**
 * 注册"保存为模板"命令
 */
export function createTemplateCommands() {
  return [
    {
      id: "workspace.saveAsTemplate",
      label: translate("保存当前为工作区模板"),
      category: "workspace" as const,
      keywords: [
        "baocun",
        "save",
        translate("保存"),
        "muban",
        "template",
        translate("模板"),
        translate("工作区"),
      ],
      shortcut: "Mod+Shift+S",
      execute: saveAsTemplateAction,
    },
  ];
}
