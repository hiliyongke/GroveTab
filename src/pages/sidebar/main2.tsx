/**
 * Arc 风格侧边栏入口
 *
 * 职责：
 *   - 配置 Ant Design 暗色主题并渲染 ArcSidebar 组件
 *   - 使用 StrictMode 进行开发环境检查
 *
 * 特殊配置：
 *   - Ant Design 暗色主题（darkAlgorithm）
 *   - 主色调：#FF6B35
 *   - 边框圆角：8px
 *   - 字体大小：13px
 *   - 挂载节点：arc-sidebar-root
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import ArcSidebar from '../../features/arc-sidebar/ArcSidebar';
import '../../features/arc-sidebar/ArcSidebar.less';

/**
 * App —— Arc 风格侧边栏根组件
 *
 * 配置 Ant Design 暗色主题并渲染 ArcSidebar 组件。
 * 使用 StrictMode 进行开发环境检查。
 *
 * @returns Arc 风格侧边栏根节点 JSX
 */
const App: React.FC = () => {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#FF6B35',
          borderRadius: 8,
          fontSize: 13,
        },
      }}
    >
      <ArcSidebar />
    </ConfigProvider>
  );
};

const root = ReactDOM.createRoot(
  document.getElementById('arc-sidebar-root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
