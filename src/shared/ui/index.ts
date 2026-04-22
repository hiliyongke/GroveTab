/**
 * shared/ui —— 通用 UI 组件统一出口（antd v6 版）
 *
 * 迁移后仅保留两个桥接/业务组件：
 *   - AntdThemeProvider：antd ConfigProvider + App + 主题 token/algorithm 同步
 *   - UndoToast：自定义撤销提示浮条（用到 antd Button + token）
 *
 * 其它 shadcn/ui 风格原子组件与 Tailwind 渐变背景已全部移除。
 */

export { AntdThemeProvider } from './AntdThemeProvider';
export { UndoToast } from './UndoToast';
export { feedback, bindFeedback, unbindFeedback } from './feedback';
