/**
 * TabsView — 标签页统一入口
 *
 * v1.4 核心整合：将 TabGroupView/WindowView/TimelineView 合并到 TabsView
 * 作为子维度切换，不再独立注册为顶层视图。
 * FeatureFlag `unified_tabs_view` 控制是否启用统一视图。
 */

export { UnifiedTabsView as TabsView } from './TabsSubView';
