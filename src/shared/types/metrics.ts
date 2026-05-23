/**
 * 本地指标相关类型 (§17)
 *
 * 记录插件内部行为指标（非外部遥测），
 * 用于 Dashboard 统计和性能分析。
 * 所有数据仅存本地，不上传服务器。
 */

/** 单条本地指标事件 */
export interface MetricEvent {
  /** 事件名称（如 'tab_opened'、'search_query'） */
  event: string;
  /** 事件发生时间戳（ms） */
  ts: number;
  /** 事件负载（按事件类型约定字段，可选） */
  payload?: Record<string, unknown>;
}
