/**
 * 侧边栏入口
 *
 * 职责：
 *   - 渲染 Arc 风格侧边栏组件
 *   - 提供主题切换功能（浅色/深色）
 *   - 使用 antd ConfigProvider 配置主题和国际化
 *
 * 设计原则：
 *   - 保持入口文件简洁，仅负责挂载 React 应用
 *   - 主题状态通过 localStorage 持久化
 *   - 监听 storage 事件实现跨标签页主题同步
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import ArcSidebar from '../../features/arc-sidebar/ArcSidebar';

// 从 localStorage 读取主题
/**
 * 从 localStorage 读取持久化的主题设置
 *
 * 若未存储或值不合法，则跟随系统偏好（prefers-color-scheme）。
 *
 * @returns 主题模式（'light' | 'dark'）
 */
const getInitialTheme = (): 'light' | 'dark' => {
  const saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/**
 * App —— 侧边栏根组件
 *
 * 管理主题状态（浅色/深色），
 * 通过 ConfigProvider 配置 antd 主题算法与国际化和语言包。
 *
 * @returns 侧边栏根节点 JSX
 */
const App: React.FC = () => {
  const [currentTheme, setCurrentTheme] = React.useState<'light' | 'dark'>(getInitialTheme);

  React.useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'theme' && (e.newValue === 'light' || e.newValue === 'dark')) {
        setCurrentTheme(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const isDark = currentTheme === 'dark';

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 8,
        },
      }}
    >
      <div data-theme={currentTheme} className="arc-sidebar-wrapper">
        <ArcSidebar />
      </div>
    </ConfigProvider>
  );
};

const root = ReactDOM.createRoot(document.getElementById('arc-sidebar-root')!);
root.render(<App />);
