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

// ── 内置命令：空间导航 ─────────────────────────────────────────────────────────

export interface SpaceDef {
  id: string;
  label: string;
  keywords: string[];
}

const SPACE_DEFS: SpaceDef[] = [
  { id: "workspace", label: "返回工作台", keywords: ["gongzuo", "workspace", "工作台", "主页"] },
  { id: "trending", label: "打开热榜", keywords: ["rebang", "trending", "热榜", "发现"] },
  { id: "devtools", label: "打开开发工具", keywords: ["kaifa", "devtools", "开发", "工具"] },
];

/**
 * 创建空间导航命令工厂
 */
export function createSpaceCommands(switchSpace: (spaceId: string) => void): CommandDef[] {
  return SPACE_DEFS.map((space) => ({
    id: `space.switch${space.id.charAt(0).toUpperCase()}${space.id.slice(1)}`,
    label: space.label,
    category: "navigation" as CommandCategory,
    keywords: space.keywords,
    execute: () => switchSpace(space.id),
  }));
}

// ── 内置命令：导航 ─────────────────────────────────────────────────────────────

const VIEW_LABELS: Record<ViewMode, { label: string; keywords: string[] }> = {
  tabs: { label: "切换到标签视图", keywords: ["biaoqian", "tab", "标签"] },
  timeline: { label: "切换到时间线视图", keywords: ["shijian", "time", "时间线"] },
  tabgroup: { label: "切换到标签组视图", keywords: ["fenzu", "group", "分组"] },
  window: { label: "切换到窗口视图", keywords: ["chuangkou", "window", "窗口"] },
  kanban: { label: "切换到看板视图", keywords: ["kanban", "board", "看板"] },
  frequency: { label: "切换到频率视图", keywords: ["pinlv", "freq", "频率"] },
  archive: { label: "切换到归档视图", keywords: ["guidang", "archive", "归档"] },
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
  search: { label: "打开搜索", keywords: ["sousuo", "search", "搜索"] },
  settings: { label: "打开设置", keywords: ["shezhi", "settings", "设置"] },
  insights: { label: "打开洞察面板", keywords: ["dongcha", "insights", "洞察"] },
  history: { label: "打开浏览历史", keywords: ["lishi", "history", "历史"] },
  trash: { label: "打开回收站", keywords: ["huishouzhan", "trash", "回收站"] },
  archive: { label: "打开归档", keywords: ["guidang", "archive", "归档"] },
  commandPalette: { label: "命令面板", keywords: ["mingling", "command", "命令"] },
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
  { id: "appearance", label: "打开外观设置", keywords: ["waiguan", "appearance", "外观", "主题"] },
  { id: "behavior", label: "打开行为设置", keywords: ["xingwei", "behavior", "行为"] },
  { id: "system", label: "打开系统设置", keywords: ["xitong", "system", "系统"] },
  { id: "about", label: "打开关于页面", keywords: ["guanyu", "about", "关于"] },
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
