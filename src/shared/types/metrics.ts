/**
 * Metrics Type Definitions
 * 本地指标相关类型 (§17)
 */

export interface MetricEvent {
  event: string;
  ts: number;
  payload?: Record<string, unknown>;
}
