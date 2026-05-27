/**
 * AutomationPanel — 自动化规则管理面板
 *
 * 位于 设置 → 行为 → 自动化规则 子区域。
 * 用户可创建/编辑/删除/启用禁用规则。
 */

import { useState, useCallback } from "react";
import { Button, Card, Flex, Switch, Typography, Tag, Popconfirm, Empty, theme } from "antd";
import { Plus, Trash2, Edit3, Clock, Globe } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import { useSettingsStore } from "@/store";
import type { AutomationRule, RuleAction } from "@/shared/types";
import {
  addAutomationRule,
  updateAutomationRule,
  deleteAutomationRule,
} from "@/repositories/automation-rule-repo";
import { AutomationRuleEditor } from "./AutomationRuleEditor";

export function AutomationPanel() {
  const { t } = useT();
  const { token } = theme.useToken();
  const rules = useSettingsStore((s) => s.automationRules ?? []);
  const setRules = useSettingsStore((s) => s.setAutomationRules);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const handleAdd = useCallback(() => {
    setEditingRule(null);
    setShowEditor(true);
  }, []);

  const handleEdit = useCallback((rule: AutomationRule) => {
    setEditingRule(rule);
    setShowEditor(true);
  }, []);

  const handleToggle = useCallback(
    async (ruleId: string, enabled: boolean) => {
      const updated = await updateAutomationRule(ruleId, { enabled });
      setRules(updated.rules);
    },
    [setRules],
  );

  const handleDelete = useCallback(
    async (ruleId: string) => {
      const updated = await deleteAutomationRule(ruleId);
      setRules(updated.rules);
    },
    [setRules],
  );

  const handleSave = useCallback(
    async (rule: AutomationRule) => {
      if (editingRule) {
        const updated = await updateAutomationRule(rule.id, {
          name: rule.name,
          condition: rule.condition,
          action: rule.action,
        });
        setRules(updated.rules);
      } else {
        const updated = await addAutomationRule(rule);
        setRules(updated.rules);
      }
      setShowEditor(false);
      setEditingRule(null);
    },
    [editingRule, setRules],
  );

  const getConditionLabel = (rule: AutomationRule): string => {
    const cond = rule.condition;
    if (cond.kind === "onEvent") {
      return cond.event === "tabCreated"
        ? t("打开匹配 {pattern} 的页面时", { pattern: cond.urlPattern })
        : t("访问匹配 {pattern} 的页面时", { pattern: cond.urlPattern });
    }
    return t("闲置超过 {days} 天的标签页", { days: cond.idleDays });
  };

  const getActionLabel = (action: RuleAction): string => {
    switch (action.type) {
      case "close": return t("关闭");
      case "discard": return t("休眠");
      case "group": return t("分组到 {name}", { name: action.groupName });
      case "pin": return t("固定");
      case "unpin": return t("取消固定");
    }
  };

  if (showEditor) {
    return (
      <AutomationRuleEditor
        rule={editingRule}
        onSave={handleSave}
        onCancel={() => {
          setShowEditor(false);
          setEditingRule(null);
        }}
      />
    );
  }

  return (
    <Flex vertical gap="middle">
      <Flex justify="space-between" align="center">
        <Typography.Text strong>{t("自动化规则")}</Typography.Text>
        <Button
          type="primary"
          size="small"
          icon={<Plus size={ICON_SIZE.SMALL} />}
          onClick={handleAdd}
        >
          {t("新建规则")}
        </Button>
      </Flex>

      {rules.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("暂无自动化规则，点击「新建规则」创建")}
        />
      ) : (
        rules.map((rule) => (
          <Card
            key={rule.id}
            size="small"
            style={{
              opacity: rule.enabled ? 1 : 0.55,
              borderColor: rule.enabled ? token.colorPrimary : token.colorBorderSecondary,
            }}
          >
            <Flex justify="space-between" align="center">
              <Flex align="center" gap="small">
                {rule.condition.kind === "onEvent" ? (
                  <Globe size={ICON_SIZE.SMALL} style={{ color: token.colorPrimary }} />
                ) : (
                  <Clock size={ICON_SIZE.SMALL} style={{ color: token.colorTextTertiary }} />
                )}
                <Typography.Text strong>{rule.name}</Typography.Text>
                <Tag>{getConditionLabel(rule)}</Tag>
                <Tag color="blue">{getActionLabel(rule.action)}</Tag>
              </Flex>
              <Flex align="center" gap="small">
                <Switch
                  size="small"
                  checked={rule.enabled}
                  onChange={(v) => void handleToggle(rule.id, v)}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<Edit3 size={ICON_SIZE.SMALL} />}
                  onClick={() => handleEdit(rule)}
                />
                <Popconfirm
                  title={t("确定删除此规则？")}
                  onConfirm={() => void handleDelete(rule.id)}
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
