/**
 * 命令注册器
 *
 * 所有 CommandPalette 可用的命令集中在此定义和注册。
 * 每个 feature 模块可自行 export 命令数组，由消费处汇总传入 registerCommands。
 *
 * 命令 ID 命名空间：{feature}.{action}
 * 例：view.switchTimeline, tab.closeAll, panel.openSettings
 */

import type { ViewMode } from "@/shared/config/views";
import type { PanelId } from "@/shared/routing";
import { translate } from "@/shared/i18n/core";

// ── 类型定义 ──────────────────────────────────────────────────────────────────

/** 命令分类 */
export type CommandCategory =
  | "navigation"    // 导航：视图切换、空间切换
  | "panel"         // 面板：打开/关闭面板
  | "tab"           // 标签操作：关闭、整理、归档
  | "settings"      // 设置项跳转
  | "workspace"     // 工作区：模板、保存
  | "other";        // 其他

/** 命令定义 */
export interface CommandDef {
  /** 命令 ID（命名空间格式：feature.action） */
  id: string;
  /** 显示文案（i18n key 或直接文本） */
  label: string;
  /** 分类 */
  category: CommandCategory;
  /** 快捷键提示（可选） */
  shortcut?: string;
  /** 拼音关键词（用于搜索） */
  keywords?: string[];
  /** 执行函数 */
  execute: () => void;
  /** 是否可用（动态判断） */
  enabled?: () => boolean;
}

// ── 命令注册表 ────────────────────────────────────────────────────────────────

const commandMap = new Map<string, CommandDef>();

/**
 * 注册命令（支持批量）
 */
export function registerCommands(commands: CommandDef[]): void {
  for (const cmd of commands) {
    commandMap.set(cmd.id, cmd);
  }
}

/**
 * 注销命令
 */
export function unregisterCommand(id: string): void {
  commandMap.delete(id);
}

/**
 * 获取所有已注册且可用的命令
 */
export function getAvailableCommands(): CommandDef[] {
  return Array.from(commandMap.values()).filter(
    (cmd) => !cmd.enabled || cmd.enabled(),
  );
}

/**
 * 按 ID 获取命令
 */
export function getCommand(id: string): CommandDef | undefined {
  return commandMap.get(id);
}

// ── 内置命令：视图导航 ─────────────────────────────────────────────────────────

const VIEW_LABELS: Record<ViewMode, { label: string; keywords: string[] }> = {
  tabs: { label: translate("切换到标签视图"), keywords: ["biaoqian", "tab", translate("标签")] },
  timeline: { label: translate("切换到时间线视图"), keywords: ["shijian", "time", translate("时间线")] },
  tabgroup: { label: translate("切换到标签组视图"), keywords: ["fenzu", "group", translate("分组")] },
  window: { label: translate("切换到窗口视图"), keywords: ["chuangkou", "window", translate("窗口")] },
  kanban: { label: translate("切换到看板视图"), keywords: ["kanban", "board", translate("看板")] },
  bookmarks: { label: translate("切换到书签视图"), keywords: ["shuqian", "bookmark", translate("书签")] },
  frequency: { label: translate("切换到频率视图"), keywords: ["pinlv", "freq", translate("频率")] },
  archive: { label: translate("切换到归档视图"), keywords: ["guidang", "archive", translate("归档")] },
  insights: { label: translate("切换到洞察视图"), keywords: ["dongcha", "insights", translate("洞察")] },
  history: { label: translate("切换到历史视图"), keywords: ["lishi", "history", translate("历史")] },
  trash: { label: translate("切换到回收站视图"), keywords: ["huishouzhan", "trash", translate("回收站")] },
  sessions: { label: translate("切换到会话视图"), keywords: ["huihua", "sessions", translate("会话"), translate("归档"), translate("回收站")] },
  trending: { label: translate("切换到热点视图"), keywords: ["redian", "trending", translate("热点")] },
  devtools: { label: translate("切换到开发工具"), keywords: ["kaifa", "devtools", translate("开发")] },
};

/**
 * 创建视图切换命令工厂
 * 需要 switchView 回调注入（由 CommandPalette 消费处提供）
 */
export function createViewCommands(switchView: (view: ViewMode) => void): CommandDef[] {
  return (Object.entries(VIEW_LABELS) as [ViewMode, typeof VIEW_LABELS[ViewMode]][]).map(
    ([viewId, meta]) => ({
      id: `view.switch${viewId.charAt(0).toUpperCase()}${viewId.slice(1)}`,
      label: meta.label,
      category: "navigation" as CommandCategory,
      keywords: meta.keywords,
      execute: () => switchView(viewId),
    }),
  );
}

// ── 内置命令：面板 ─────────────────────────────────────────────────────────────

const PANEL_LABELS: Record<PanelId, { label: string; keywords: string[] }> = {
  search: { label: translate("打开搜索"), keywords: ["sousuo", "search", translate("搜索")] },
  settings: { label: translate("打开设置"), keywords: ["shezhi", "settings", translate("设置")] },
  commandPalette: { label: translate("命令面板"), keywords: ["mingling", "command", translate("命令")] },
};

/**
 * 创建面板命令工厂
 */
export function createPanelCommands(openPanel: (panelId: PanelId) => void): CommandDef[] {
  return (Object.entries(PANEL_LABELS) as [PanelId, typeof PANEL_LABELS[PanelId]][]).map(
    ([panelId, meta]) => ({
      id: `panel.open${panelId.charAt(0).toUpperCase()}${panelId.slice(1)}`,
      label: meta.label,
      category: "panel" as CommandCategory,
      keywords: meta.keywords,
      execute: () => openPanel(panelId),
    }),
  );
}

// ── 内置命令：设置跳转 ────────────────────────────────────────────────────────

export const SETTINGS_TABS = [
  { id: "appearance", label: translate("打开外观设置"), keywords: ["waiguan", "appearance", translate("外观"), translate("主题")] },
  { id: "general", label: translate("打开通用设置"), keywords: ["tongyong", "general", translate("通用")] },
  { id: "view-layout", label: translate("打开视图布局设置"), keywords: ["buju", "layout", translate("布局")] },
  { id: "automation", label: translate("打开自动化设置"), keywords: ["zidonghua", "automation", translate("自动化")] },
  { id: "system", label: translate("打开系统设置"), keywords: ["xitong", "system", translate("系统")] },
] as const;

/**
 * 创建设置跳转命令工厂
 */
export function createSettingsCommands(
  openSettings: (subId?: string) => void,
): CommandDef[] {
  return SETTINGS_TABS.map((tab) => ({
    id: `settings.${tab.id}`,
    label: tab.label,
    category: "settings" as CommandCategory,
    keywords: [...tab.keywords],
    execute: () => openSettings(tab.id),
  }));
}
