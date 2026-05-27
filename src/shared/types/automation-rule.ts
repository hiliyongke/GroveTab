/**
 * AutomationRule — 自动化规则类型定义
 *
 * 支持两类规则：
 *   1. 定时清理型（scheduled）：按间隔检查标签页状态，如"关闭 7 天未访问的标签"
 *   2. 事件触发型（onEvent）：当特定事件发生时执行动作，如"打开 github.com 时自动分组"
 *
 * 规则由用户在设置面板中创建/编辑/删除，持久化到 chrome.storage.local。
 * Service Worker 负责定时/事件驱动的规则执行。
 */

/** 规则动作类型 */
export type RuleAction =
  | { type: "close"; reason?: string }
  | { type: "discard" }
  | { type: "group"; groupName: string; color?: string }
  | { type: "pin" }
  | { type: "unpin" };

/** 定时清理条件 */
export interface ScheduledCondition {
  /** 条件类型判别 */
  kind: "scheduled";
  /** 闲置天数阈值 */
  idleDays: number;
  /** 是否排除固定标签 */
  excludePinned: boolean;
  /** 是否排除正在播放音频的标签 */
  excludeAudible: boolean;
  /** URL 匹配模式（支持 * 通配符），为空则匹配所有 */
  urlPattern?: string;
}

/** 事件触发条件 */
export interface OnEventCondition {
  /** 条件类型判别 */
  kind: "onEvent";
  /** 触发事件类型 */
  event: "tabCreated" | "tabUpdated";
  /** URL 匹配模式（支持 * 通配符） */
  urlPattern: string;
}

/** 自动化规则 */
export interface AutomationRule {
  /** 唯一标识 */
  id: string;
  /** 规则名称 */
  name: string;
  /** 是否启用 */
  enabled: boolean;
  /** 创建时间 */
  createdAt: number;
  /** 最后修改时间 */
  updatedAt: number;
  /** 规则触发条件 */
  condition: ScheduledCondition | OnEventCondition;
  /** 执行动作 */
  action: RuleAction;
}

/** 规则集合（存储结构） */
export interface AutomationRuleData {
  rules: AutomationRule[];
}
