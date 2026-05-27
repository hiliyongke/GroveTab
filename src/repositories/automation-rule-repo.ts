/**
 * automation-rule-repo — 自动化规则持久化仓库
 */

import { storageGet, storageSet } from "@/chrome";
import { STORAGE_KEYS } from "@/shared/config/storage-keys";
import type { AutomationRule, AutomationRuleData } from "@/shared/types";

const EMPTY_DATA: AutomationRuleData = { rules: [] };

export async function getAutomationRules(): Promise<AutomationRuleData> {
  const data = await storageGet<AutomationRuleData>(STORAGE_KEYS.automationRules);
  return data ?? EMPTY_DATA;
}

export async function saveAutomationRules(data: AutomationRuleData): Promise<void> {
  await storageSet(STORAGE_KEYS.automationRules, data);
}

export async function addAutomationRule(rule: AutomationRule): Promise<AutomationRuleData> {
  const data = await getAutomationRules();
  data.rules.push(rule);
  await saveAutomationRules(data);
  return data;
}

export async function updateAutomationRule(
  ruleId: string,
  patch: Partial<Omit<AutomationRule, "id" | "createdAt">>,
): Promise<AutomationRuleData> {
  const data = await getAutomationRules();
  const idx = data.rules.findIndex((r) => r.id === ruleId);
  if (idx >= 0) {
    data.rules[idx] = { ...data.rules[idx]!, ...patch, updatedAt: Date.now() };
    await saveAutomationRules(data);
  }
  return data;
}

export async function deleteAutomationRule(ruleId: string): Promise<AutomationRuleData> {
  const data = await getAutomationRules();
  data.rules = data.rules.filter((r) => r.id !== ruleId);
  await saveAutomationRules(data);
  return data;
}
