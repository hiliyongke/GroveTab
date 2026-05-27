/**
 * WorkspaceTemplate — 工作区模板类型定义
 *
 * 用户可将当前标签页集合保存为模板（如"晨会模板"=日历+文档+看板），
 * 一键恢复。模板存储在 chrome.storage.local，支持创建/编辑/删除/恢复。
 */

export interface TemplateTab {
  url: string;
  title: string;
  favIconUrl?: string;
}

export interface WorkspaceTemplate {
  /** 唯一标识 */
  id: string;
  /** 模板名称 */
  name: string;
  /** 标签页列表 */
  tabs: TemplateTab[];
  /** 创建时间 */
  createdAt: number;
  /** 最后修改时间 */
  updatedAt: number;
  /** 图标（emoji 或 icon name） */
  icon?: string;
}

export interface WorkspaceTemplateData {
  templates: WorkspaceTemplate[];
}
