/**
 * 命令注册器
 *
 * 所有 CommandPalette 可用的命令集中在此定义和注册。
 * 每个 feature 模块可自行 export 命令数组，由消费处汇总传入 registerCommands。
 *
 * 命令 ID 命名空间：{feature}.{action}
 * 例：view.switchTimeline, tab.closeAll, panel.openSettings
 */

import type { SessionsSubView, TabsSubView, ViewMode } from "@/shared/config/views";
import type { PanelId } from "@/shared/routing";
import { translate } from "@/shared/i18n/core";
import { useSettingsStore } from "@/store";

// ── 类型定义 ──────────────────────────────────────────────────────────────────

/** 命令分类 */
export type CommandCategory =
  | "navigation" // 导航：视图切换、空间切换
  | "panel" // 面板：打开/关闭面板
  | "tab" // 标签操作：关闭、整理、归档
  | "settings" // 设置项跳转
  | "workspace" // 工作区：模板、保存
  | "other"; // 其他

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
  return Array.from(commandMap.values()).filter((cmd) => !cmd.enabled || cmd.enabled());
}

/**
 * 按 ID 获取命令
 */
export function getCommand(id: string): CommandDef | undefined {
  return commandMap.get(id);
}

// ── 内置命令：视图导航 ─────────────────────────────────────────────────────────

const PRIMARY_VIEW_LABELS: Record<
  "tabs" | "bookmarks" | "sessions" | "trending" | "devtools",
  { label: string; keywords: string[] }
> = {
  tabs: { label: translate("切换到标签页"), keywords: ["biaoqian", "tab", translate("标签")] },
  bookmarks: {
    label: translate("切换到书签"),
    keywords: ["shuqian", "bookmark", translate("书签")],
  },
  sessions: {
    label: translate("切换到会话"),
    keywords: [
      "huihua",
      "sessions",
      translate("会话"),
      translate("归档"),
      translate("回收站"),
      translate("历史"),
    ],
  },
  trending: {
    label: translate("切换到热榜"),
    keywords: ["redian", "trending", translate("热点"), translate("热榜")],
  },
  devtools: {
    label: translate("切换到开发工具"),
    keywords: ["kaifa", "devtools", translate("开发"), translate("工具")],
  },
};

const TAB_SUB_VIEW_COMMANDS: Array<{
  id: string;
  label: string;
  subView: TabsSubView;
  keywords: string[];
}> = [
  {
    id: "tabgroup",
    label: translate("在标签页中打开分组"),
    subView: "tabgroup",
    keywords: ["fenzu", "group", translate("分组"), translate("标签组")],
  },
  {
    id: "window",
    label: translate("在标签页中按窗口查看"),
    subView: "window",
    keywords: ["chuangkou", "window", translate("窗口")],
  },
  {
    id: "timeline",
    label: translate("在标签页中打开时间线"),
    subView: "timeline",
    keywords: ["shijian", "time", translate("时间线"), translate("时间轴")],
  },
  {
    id: "kanban",
    label: translate("在标签页中打开看板"),
    subView: "kanban",
    keywords: ["kanban", "board", translate("看板")],
  },
  {
    id: "frequency",
    label: translate("在标签页中查看使用频率"),
    subView: "frequency",
    keywords: ["pinlv", "freq", translate("频率"), translate("使用频率")],
  },
];

const SESSION_SUB_VIEW_COMMANDS: Array<{
  id: string;
  label: string;
  subView: SessionsSubView;
  keywords: string[];
}> = [
  {
    id: "archive",
    label: translate("在会话中打开归档"),
    subView: "archive",
    keywords: ["guidang", "archive", translate("归档")],
  },
  {
    id: "trash",
    label: translate("在会话中打开回收站"),
    subView: "trash",
    keywords: ["huishouzhan", "trash", translate("回收站")],
  },
  {
    id: "history",
    label: translate("在会话中打开历史"),
    subView: "history",
    keywords: ["lishi", "history", translate("历史"), translate("历史记录")],
  },
];

/**
 * 创建视图切换命令工厂。
 * 只暴露产品主入口；内部能力通过设置子视图后回到所属主入口，避免命令面板制造 14 个一级页面。
 */
export function createViewCommands(switchView: (view: ViewMode) => void): CommandDef[] {
  const primaryCommands = (
    Object.entries(PRIMARY_VIEW_LABELS) as Array<
      [ViewMode, (typeof PRIMARY_VIEW_LABELS)[keyof typeof PRIMARY_VIEW_LABELS]]
    >
  ).map(([viewId, meta]) => ({
    id: `view.switch${viewId.charAt(0).toUpperCase()}${viewId.slice(1)}`,
    label: meta.label,
    category: "navigation" as CommandCategory,
    keywords: meta.keywords,
    execute: () => switchView(viewId),
  }));

  const tabSubViewCommands = TAB_SUB_VIEW_COMMANDS.map((meta) => ({
    id: `tabs.open${meta.id.charAt(0).toUpperCase()}${meta.id.slice(1)}`,
    label: meta.label,
    category: "navigation" as CommandCategory,
    keywords: meta.keywords,
    execute: () => {
      void useSettingsStore
        .getState()
        .updateSettings({ defaultView: "tabs", tabsSubView: meta.subView });
      switchView("tabs");
    },
  }));

  const sessionSubViewCommands = SESSION_SUB_VIEW_COMMANDS.map((meta) => ({
    id: `sessions.open${meta.id.charAt(0).toUpperCase()}${meta.id.slice(1)}`,
    label: meta.label,
    category: "navigation" as CommandCategory,
    keywords: meta.keywords,
    execute: () => {
      void useSettingsStore
        .getState()
        .updateSettings({ defaultView: "sessions", sessionsSubView: meta.subView });
      switchView("sessions");
    },
  }));

  return [...primaryCommands, ...tabSubViewCommands, ...sessionSubViewCommands];
}

// ── 内置命令：面板 ─────────────────────────────────────────────────────────────

const PANEL_LABELS: Record<PanelId, { label: string; keywords: string[] }> = {
  search: { label: translate("打开搜索"), keywords: ["sousuo", "search", translate("搜索")] },
  settings: { label: translate("打开设置"), keywords: ["shezhi", "settings", translate("设置")] },
  commandPalette: {
    label: translate("命令面板"),
    keywords: ["mingling", "command", translate("命令")],
  },
};

/**
 * 创建面板命令工厂
 */
export function createPanelCommands(openPanel: (panelId: PanelId) => void): CommandDef[] {
  return (Object.entries(PANEL_LABELS) as Array<[PanelId, (typeof PANEL_LABELS)[PanelId]]>).map(
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
  {
    id: "appearance",
    label: translate("打开外观设置"),
    keywords: ["waiguan", "appearance", translate("外观"), translate("主题")],
  },
  {
    id: "general",
    label: translate("打开通用设置"),
    keywords: ["tongyong", "general", translate("通用")],
  },
  {
    id: "view-layout",
    label: translate("打开视图布局设置"),
    keywords: ["buju", "layout", translate("布局")],
  },
  {
    id: "automation",
    label: translate("打开自动化设置"),
    keywords: ["zidonghua", "automation", translate("自动化")],
  },
  {
    id: "system",
    label: translate("打开系统设置"),
    keywords: ["xitong", "system", translate("系统")],
  },
] as const;

/**
 * 创建设置跳转命令工厂
 */
export function createSettingsCommands(openSettings: (subId?: string) => void): CommandDef[] {
  return SETTINGS_TABS.map((tab) => ({
    id: `settings.${tab.id}`,
    label: tab.label,
    category: "settings" as CommandCategory,
    keywords: [...tab.keywords],
    execute: () => openSettings(tab.id),
  }));
}
