/**
 * WorkspaceTemplatesPanel — 工作区模板管理面板
 *
 * 位于 设置 → 行为 → 工作区模板 子区域。
 * 用户可从当前标签页创建模板、一键恢复模板、编辑/删除模板。
 */

import { useState, useCallback } from "react";
import { Button, Card, Flex, Typography, Popconfirm, Empty, Input, Modal, theme } from "antd";
import { Plus, Trash2, Play, LayoutTemplate } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import { useSettingsStore, useTabsStore } from "@/store";
import type { WorkspaceTemplate, TemplateTab } from "@/shared/types";
import {
  addWorkspaceTemplate,
  deleteWorkspaceTemplate,
} from "@/repositories/workspace-template-repo";
import { createTab } from "@/chrome";

export function WorkspaceTemplatesPanel() {
  const { t } = useT();
  const { token } = theme.useToken();
  const templates = useSettingsStore((s) => s.workspaceTemplates ?? []);
  const setTemplates = useSettingsStore((s) => s.setWorkspaceTemplates);
  const tabs = useTabsStore((s) => s.tabs);
  const [showCreate, setShowCreate] = useState(false);
  const [templateName, setTemplateName] = useState("");

  const handleCreateFromCurrent = useCallback(async () => {
    if (!templateName.trim()) return;
    const now = Date.now();
    const templateTabs: TemplateTab[] = tabs.map((tab) => ({
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl || undefined,
    }));
    const template: WorkspaceTemplate = {
      id: `tpl_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: templateName.trim(),
      tabs: templateTabs,
      createdAt: now,
      updatedAt: now,
    };
    const updated = await addWorkspaceTemplate(template);
    setTemplates(updated.templates);
    setShowCreate(false);
    setTemplateName("");
  }, [templateName, tabs, setTemplates]);

  const handleRestore = useCallback(
    async (template: WorkspaceTemplate) => {
      for (const tab of template.tabs) {
        try {
          await createTab({ url: tab.url, active: false });
        } catch {
          // fallback
          try { window.open(tab.url, "_blank"); } catch { /* ignore */ }
        }
      }
    },
    [],
  );

  const handleDelete = useCallback(
    async (templateId: string) => {
      const updated = await deleteWorkspaceTemplate(templateId);
      setTemplates(updated.templates);
    },
    [setTemplates],
  );

  return (
    <Flex vertical gap="middle">
      <Flex justify="space-between" align="center">
        <Typography.Text strong>{t("工作区模板")}</Typography.Text>
        <Button
          type="primary"
          size="small"
          icon={<Plus size={ICON_SIZE.SMALL} />}
          onClick={() => setShowCreate(true)}
        >
          {t("保存当前标签为模板")}
        </Button>
      </Flex>

      <Modal
        open={showCreate}
        onCancel={() => {
          setShowCreate(false);
          setTemplateName("");
        }}
        onOk={() => void handleCreateFromCurrent()}
        title={t("新建工作区模板")}
        okText={t("保存")}
        okButtonProps={{ disabled: !templateName.trim() }}
      >
        <Flex vertical gap="middle">
          <Typography.Text type="secondary">
            {t("将当前 {count} 个标签页保存为模板，方便日后一键恢复", { count: tabs.length })}
          </Typography.Text>
          <Input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder={t("例如：晨会模板")}
            autoFocus
          />
        </Flex>
      </Modal>

      {templates.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("暂无工作区模板")}
        />
      ) : (
        templates.map((template) => (
          <Card
            key={template.id}
            size="small"
            style={{ borderColor: token.colorBorderSecondary }}
          >
            <Flex justify="space-between" align="center">
              <Flex align="center" gap="small">
                <LayoutTemplate size={ICON_SIZE.SMALL} style={{ color: token.colorPrimary }} />
                <Typography.Text strong>{template.name}</Typography.Text>
                <Typography.Text type="secondary">
                  {template.tabs.length} {t("个标签页")}
                </Typography.Text>
              </Flex>
              <Flex align="center" gap="small">
                <Button
                  type="primary"
                  size="small"
                  icon={<Play size={ICON_SIZE.SMALL} />}
                  onClick={() => void handleRestore(template)}
                >
                  {t("恢复")}
                </Button>
                <Popconfirm
                  title={t("确定删除此模板？")}
                  onConfirm={() => void handleDelete(template.id)}
                >
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<Trash2 size={ICON_SIZE.SMALL} />}
                  />
                </Popconfirm>
              </Flex>
            </Flex>
          </Card>
        ))
      )}
    </Flex>
  );
}
