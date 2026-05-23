/**
 * 状态管理统一导出
 *
 * 设计原则：
 *   - 统一导出所有 Zustand store 切片
 *   - 提供一致的状态管理 API
 *
 * 导出模块：
 *   - useTabsStore：标签页状态管理
 *   - useSettingsStore：设置状态管理
 *   - useUndoStore：撤销操作状态管理
 *   - useMetadataStore：元数据状态管理
 *   - useSelectionStore：选择状态管理
 *   - useStatsStore：统计状态管理
 *   - useKanbanStore：看板状态管理
 *   - useSpeedDialStore：速拨状态管理
 */
export { useTabsStore } from './tabs-slice';
export { useSettingsStore } from './settings-slice';
export { useUndoStore } from './undo-slice';
export { useMetadataStore } from './metadata-slice';
export { useSelectionStore } from './selection-slice';
export { useStatsStore } from './stats-slice';
export { useKanbanStore } from './kanban-slice';
export { useSpeedDialStore } from './speed-dial-slice';
