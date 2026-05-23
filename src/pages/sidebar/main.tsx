/**
 * 侧边栏入口
 *
 * 职责：
 *   - 渲染 Arc 风格侧边栏组件
 *   - 使用统一的 AntdThemeProvider 配置主题和国际化
 *
 * 设计原则：
 *   - 保持入口文件简洁，仅负责挂载 React 应用
 *   - 主题状态由 AntdThemeProvider 统一管理（通过 settings store）
 *   - 移除独立的 localStorage 主题管理，与 newtab/popup 保持一致
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { AntdThemeProvider } from '@/shared/ui/AntdThemeProvider';
import ArcSidebar from '../../features/arc-sidebar/ArcSidebar';

/**
 * App —— 侧边栏根组件
 *
 * 使用 AntdThemeProvider 统一管理主题，
 * 自动同步 newtab/popup 的主题设置。
 *
 * @returns 侧边栏根节点 JSX
 */
const App: React.FC = () => {
  return (
    <AntdThemeProvider>
      <div className="arc-sidebar-wrapper">
        <ArcSidebar />
      </div>
    </AntdThemeProvider>
  );
};

const root = ReactDOM.createRoot(document.getElementById('arc-sidebar-root')!);
root.render(<App />);
