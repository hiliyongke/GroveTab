/**
 * 窗口视图 —— React 组件重新导出
 *
 * 设计原则：
 *   - 仅作为重新导出入口，实际实现在 ./WindowView/index.tsx
 *   - 遵循项目的模块导出约定，保持导入路径统一
 *
 * 依赖关系：
 *   - 依赖 ./WindowView/index.tsx：获取 WindowView 组件实现
 *   - 被 src/features/workspace/view-catalog.ts 依赖：用于视图注册
 */
export { default } from './WindowView/index';
