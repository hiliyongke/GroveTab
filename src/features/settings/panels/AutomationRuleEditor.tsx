/**
 * AutomationRuleEditor — 自动化规则编辑器
 */

import { useState } from "react";
import { Button, Flex, Input, InputNumber, Select, Typography, Space } from "antd";
import { useT } from "@/shared/i18n";
import type {
  AutomationRule,
  RuleAction,
  ScheduledCondition,
  OnEventCondition,
} from "@/shared/types";

interface AutomationRuleEditorProps {
  rule: AutomationRule | null;
  onSave: (rule: AutomationRule) => void;
  onCancel: () => void;
}

type ConditionType = "scheduled" | "onEvent";

export function AutomationRuleEditor({ rule, onSave, onCancel }: AutomationRuleEditorProps) {
  const { t } = useT();
  const [name, setName] = useState(rule?.name ?? "");
  const [conditionType, setConditionType] = useState<ConditionType>(
    rule?.condition.kind === "onEvent" ? "onEvent" : "scheduled",
  );
  const [idleDays, setIdleDays] = useState(
    rule?.condition.kind === "scheduled" ? rule.condition.idleDays : 7,
  );
  const [urlPattern, setUrlPattern] = useState(
    rule?.condition.kind === "onEvent" ? rule.condition.urlPattern : "",
  );
  const [actionType, setActionType] = useState<RuleAction["type"]>(rule?.action.type ?? "close");
  const [groupName, setGroupName] = useState(
    rule?.action.type === "group" ? rule.action.groupName : "",
  );

  const handleSave = () => {
    if (!name.trim()) return;

    const condition: ScheduledCondition | OnEventCondition =
      conditionType === "scheduled"
        ? {
            kind: "scheduled",
            idleDays,
            excludePinned: true,
            excludeAudible: true,
            urlPattern: urlPattern || undefined,
          }
        : { kind: "onEvent", event: "tabCreated", urlPattern: urlPattern || "*" };

    const action: RuleAction =
      actionType === "group"
        ? { type: "group", groupName: groupName || "Untagged" }
        : actionType === "close"
          ? { type: "close" }
          : actionType === "discard"
            ? { type: "discard" }
            : actionType === "pin"
              ? { type: "pin" }
              : { type: "unpin" };

    const now = Date.now();
    const newRule: AutomationRule = rule
      ? { ...rule, name, condition, action, updatedAt: now }
      : {
          id: `rule_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          name,
          enabled: true,
          createdAt: now,
          updatedAt: now,
          condition,
          action,
        };

    onSave(newRule);
  };

  return (
    <Flex vertical gap="middle">
      <Typography.Text strong>{rule ? t("编辑规则") : t("新建规则")}</Typography.Text>

      <Flex vertical gap={4}>
        <Typography.Text type="secondary">{t("规则名称")}</Typography.Text>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("例如：清理闲置标签")}
        />
      </Flex>

      <Flex vertical gap={4}>
        <Typography.Text type="secondary">{t("触发条件类型")}</Typography.Text>
        <Select
          value={conditionType}
          onChange={setConditionType}
          options={[
            { value: "scheduled", label: t("定时清理（闲置检查）") },
            { value: "onEvent", label: t("事件触发（打开/访问页面时）") },
          ]}
        />
      </Flex>

      {conditionType === "scheduled" ? (
        <Flex vertical gap={4}>
          <Typography.Text type="secondary">{t("闲置天数阈值")}</Typography.Text>
          <InputNumber min={1} max={365} value={idleDays} onChange={(v) => setIdleDays(v ?? 7)} />
        </Flex>
      ) : (
        <Flex vertical gap={4}>
          <Typography.Text type="secondary">{t("URL 匹配模式（支持 * 通配符）")}</Typography.Text>
          <Input
            value={urlPattern}
            onChange={(e) => setUrlPattern(e.target.value)}
            placeholder="https://github.com/*"
          />
        </Flex>
      )}

      {conditionType === "scheduled" && (
        <Flex vertical gap={4}>
          <Typography.Text type="secondary">
            {t("URL 匹配模式（可选，留空匹配所有）")}
          </Typography.Text>
          <Input
            value={urlPattern}
            onChange={(e) => setUrlPattern(e.target.value)}
            placeholder="https://*/*"
          />
        </Flex>
      )}

      <Flex vertical gap={4}>
        <Typography.Text type="secondary">{t("执行动作")}</Typography.Text>
        <Select
          value={actionType}
          onChange={setActionType}
          options={[
            { value: "close", label: t("关闭标签页") },
            { value: "discard", label: t("休眠标签页") },
            { value: "group", label: t("自动分组") },
            { value: "pin", label: t("固定标签页") },
          ]}
        />
      </Flex>

      {actionType === "group" && (
        <Flex vertical gap={4}>
          <Typography.Text type="secondary">{t("分组名称")}</Typography.Text>
          <Input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder={t("例如：Dev")}
          />
        </Flex>
      )}

      <Space>
        <Button type="primary" onClick={handleSave} disabled={!name.trim()}>
          {t("保存")}
        </Button>
        <Button onClick={onCancel}>{t("取消")}</Button>
      </Space>
    </Flex>
  );
}
