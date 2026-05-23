/**
 * 数据仓库层统一导出
 *
 * 设计原则：
 *   - 统一导出所有数据仓库模块，提供一致的导入路径
 *   - 集中管理数据仓库层的公共 API
 *
 * 导出模块：
 *   - storage-repo：Chrome 存储操作仓库
 *   - history-repo：历史记录操作仓库
 */

export * from './storage-repo';
export * from './history-repo';
