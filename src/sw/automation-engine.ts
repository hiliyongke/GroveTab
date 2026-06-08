/**
 * Automation Rule Engine — 自动化规则执行引擎。
 *
 * 支持两种规则：
 *   - scheduled：定时清理（在 statsHeartbeat alarm 中触发）
 *   - onEvent：事件触发（在 tab 创建/更新时触发）
 *
 * 从 sw/index.ts 抽离以改善可维护性（CODE-01 阶段2）。
 */

import { getAutomationRules } from "@/repositories";
import type { OnEventCondition, ScheduledCondition } from "@/shared/types";
import { BRAND } from "@/shared/config/brand";

const SW_LOG_TAG = `${BRAND.logTag} SW`;

/**
 * URL 模式匹配：支持 * 通配符
 * 例如 "https://github.com/*" 匹配所有 github.com 页面
 */
function matchUrlPattern(url: string, pattern: string): boolean {
  if (!pattern) return true;
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  try {
    return new RegExp(`^${regexStr}$`, "i").test(url);
  } catch {
    return false;
  }
}

/** 执行定时清理型规则（在 statsHeartbeat alarm 中被调用） */
export async function executeScheduledRules(): Promise<void> {
  try {
    const ruleData = await getAutomationRules();
    const scheduledRules = ruleData.rules.filter(
      (r) => r.enabled && r.condition.kind === "scheduled",
    );
    if (scheduledRules.length === 0) return;

    const tabs = await chrome.tabs.query({});
    const now = Date.now();

    for (const rule of scheduledRules) {
      const cond = rule.condition as ScheduledCondition;
      const idleThresholdMs = cond.idleDays * 86400_000;
      const candidates = tabs.filter((tab) => {
        if (tab.id === undefined || tab.url === undefined) return false;
        if (cond.excludePinned && tab.pinned) return false;
        if (cond.excludeAudible && tab.audible) return false;
        if (cond.urlPattern && !matchUrlPattern(tab.url, cond.urlPattern)) return false;
        const lastAccessed = tab.lastAccessed ?? 0;
        return now - lastAccessed > idleThresholdMs;
      });

      for (const tab of candidates) {
        if (tab.id === undefined) continue;
        switch (rule.action.type) {
          case "close":
            try { await chrome.tabs.remove(tab.id); } catch { /* ignore */ }
            break;
          case "discard":
            try { await chrome.tabs.discard(tab.id); } catch { /* ignore */ }
            break;
        }
      }
    }
  } catch (err) {
    console.warn(`${SW_LOG_TAG} executeScheduledRules failed`, err);
  }
}

/** 执行事件触发型规则（在 onCreated/onUpdated 事件中被调用） */
export async function executeOnEventRules(
  _eventType: "tabCreated" | "tabUpdated",
  tab: chrome.tabs.Tab,
): Promise<void> {
  if (tab.id === undefined || !tab.url) return;
  try {
    const ruleData = await getAutomationRules();
    const eventRules = ruleData.rules.filter(
      (r) => r.enabled && r.condition.kind === "onEvent",
    );
    if (eventRules.length === 0) return;

    for (const rule of eventRules) {
      const cond = rule.condition as OnEventCondition;
      if (!matchUrlPattern(tab.url, cond.urlPattern)) continue;

      switch (rule.action.type) {
        case "group": {
          const groupId = await chrome.tabs.group?.({ tabIds: [tab.id] });
          if (groupId !== undefined && rule.action.groupName) {
            await chrome.tabGroups?.update?.(groupId, {
              title: rule.action.groupName,
              color: rule.action.color as
                | "grey" | "blue" | "red" | "yellow" | "green"
                | "pink" | "purple" | "cyan" | "orange"
                | undefined,
            });
          }
          break;
        }
        case "pin":
          try { await chrome.tabs.update(tab.id, { pinned: true }); } catch { /* ignore */ }
          break;
      }
    }
  } catch (err) {
    console.warn(`${SW_LOG_TAG} executeOnEventRules failed`, err);
  }
}
