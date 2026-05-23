/**
 * 新标签页入口
 *
 * 职责：
 *   - 创建 React 根节点
 *   - 渲染主应用组件（App）
 *   - 导入全局样式和主题样式
 *
 * 设计原则：
 *   - 保持入口文件简洁，仅负责挂载 React 应用
 *   - 样式导入集中管理，确保全局样式优先加载
 */

import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/app-shell.less";
import "@/styles/global.less";

createRoot(document.getElementById("root")!).render(<App />);
