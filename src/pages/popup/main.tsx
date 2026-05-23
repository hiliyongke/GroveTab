/**
 * 弹出窗口入口
 *
 * 职责：
 *   - 使用 StrictMode 渲染 popup 应用组件
 *   - 导入 popup 专用样式
 *
 * 设计原则：
 *   - 保持入口文件简洁，仅负责挂载 React 应用
 *   - 使用 StrictMode 进行开发环境检查
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '../newtab/index.less';
import './styles/index.less';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
