/**
 * Workspace Type Definitions
 * 工作区相关类型 (F-29)
 */

export interface Workspace {
  id: string;
  name: string;
  filter: {
    tagIds?: string[];
    domains?: string[];
  };
  createdAt: number;
}
