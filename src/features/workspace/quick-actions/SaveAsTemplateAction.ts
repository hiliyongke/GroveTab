/**
 * SaveAsTemplateAction —— 保存当前标签页为工作区模板的快捷操作
 *
 * UX-P0-11：从 CommandPalette 直达，3 秒内完成保存
 *
 * 流程：
 *   1. 获取当前所有标签页
 *   2. 弹出命名输入框（Modal.prompt）
 *   3. 保存到 workspaceTemplates
 *   4. Toast 反馈
 */

import { Modal } from "antd";
import { feedback } from "@/shared/ui/feedback";
import { useSettingsStore } from "@/store";
import { useTabsStore } from "@/store";
import type { WorkspaceTemplate, TemplateTab } from "@/shared/types/workspace-template";

/**
 * 保存当前标签页为模板
 * 可从 CommandPalette 命令调用，无需导航到设置面板
 */
export function saveAsTemplateAction(): void {
  const tabs = useTabsStore.getState().tabs;

  Modal.confirm({
    title: "保存为工作区模板",
    content: `将当前 ${tabs.length} 个标签页保存为模板，稍后可一键恢复。`,
    okText: "保存",
    cancelText: "取消",
    onOk: async () => {
      const name = `模板 ${new Date().toLocaleDateString()}`;
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

      feedback.success(`已保存模板「${name}」(${tabs.length} 个标签页)`);
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
      label: "保存当前为工作区模板",
      category: "workspace" as const,
      keywords: ["baocun", "save", "保存", "muban", "template", "模板", "工作区"],
      shortcut: "Mod+Shift+S",
      execute: saveAsTemplateAction,
    },
  ];
}
