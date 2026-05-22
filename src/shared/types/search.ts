/**
 * Search History Type Definitions
 * 搜索历史相关类型 (F-05b / F-12)
 */

export interface SearchHistoryEntry {
  query: string;
  ts: number;
  /** 累计搜索次数（用于"热门关键词"排序） */
  count: number;
}
