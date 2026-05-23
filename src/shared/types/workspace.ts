/**
 * Workspace Type Definitions
 * 工作区相关类型 (F-29)
 */

export interface Workspace {
  /** 工作区唯一 ID */
  id: string;
  /** 工作区名称 */
  name: string;
  /** 过滤条件：按标签 ID 或域名过滤 */
  filter: {
    tagIds?: string[];
    domains?: string[];
  };
  /** 创建时间戳（ms） */
  createdAt: number;
}
