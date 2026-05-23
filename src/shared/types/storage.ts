/**
 * 存储相关类型定义
 */

/** 分区存储键；实际前缀由品牌命名空间配置生成。 */
export type StorageKey = `${string}_${string}`;

/** Storage metadata */
export interface StorageMeta {
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
}
