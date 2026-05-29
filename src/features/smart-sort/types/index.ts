/** 排序维度权重配置 */
export interface SortWeights {
  /** 最近访问（默认 0.35） */
  recency: number;
  /** 访问频率（默认 0.25） */
  frequency: number;
  /** 停留时长（默认 0.20） */
  time: number;
  /** 域名相关性（默认 0.15） */
  domain: number;
  /** 手动调整（默认 0.05） */
  manual: number;
}

/** 标签评分详情 */
export interface TabScore {
  tabId: number;
  /** 总分（0-100） */
  score: number;
  /** 各维度得分明细 */
  breakdown: {
    recency: number;
    frequency: number;
    time: number;
    domain: number;
    manual: number;
  };
}

/** 智能排序配置 */
export interface SmartSortConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 权重配置 */
  weights: SortWeights;
  /** 衰减系数（默认 0.1，约7天衰减50%） */
  decayRate: number;
}

/** 排序模式 - 明确的排序规则 */
export type SortMode = "default" | "recency" | "frequency" | "time" | "manual" | "domain" | "title";

/** 智能排序状态 */
export interface SmartSortState extends SmartSortConfig {
  /** 置顶标签 ID 集合 */
  pinnedTabIds: Set<number>;
  /** 用户手动调整记录 */
  manualOverrides: Map<number, number>;
  /** 运行时评分缓存（不持久化） */
  scores: Map<number, TabScore>;
  /** 最后计算时间 */
  lastCalculated: number;
}

/** 默认权重配置（总和 100%） */
export const DEFAULT_WEIGHTS: SortWeights = {
  recency: 0.30, // 最近访问 30%
  frequency: 0.25, // 使用频率 25%
  time: 0.20, // 停留时长 20%
  domain: 0.15, // 域名相关 15%
  manual: 0.10, // 手动调整 10%
};

/** 默认配置 */
export const DEFAULT_SMART_SORT_CONFIG: SmartSortConfig = {
  enabled: false,
  weights: DEFAULT_WEIGHTS,
  decayRate: 0.1,
};
