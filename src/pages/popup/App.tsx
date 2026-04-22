/**
 * Canopy — Popup 弹窗页
 *
 * 点击浏览器工具栏图标时弹出，提供快速操作入口：
 *   - 打开新标签页（跳转 Canopy 主界面）
 *   - 归档当前窗口所有标签
 *   - 显示当前标签数量统计
 */

import { useState, useEffect } from 'react';
import { Button, Space, Typography, Divider } from 'antd';
import {
  AppstoreOutlined,
  SaveOutlined,
} from '@ant-design/icons';

const { Title } = Typography;

function App() {
  const [tabCount, setTabCount] = useState(0);
  const [currentTabs, setCurrentTabs] = useState(0);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({}).then((tabs) => setTabCount(tabs.length));
      chrome.tabs.query({ currentWindow: true }).then((tabs) => setCurrentTabs(tabs.length));
    }
  }, []);

  /** 打开 Canopy 新标签页 */
  const openNewTab = () => {
    chrome.tabs?.create({ url: chrome.runtime.getURL('src/pages/newtab/index.html') });
    window.close();
  };

  /** 归档当前窗口标签 */
  const archiveAll = async () => {
    if (!chrome.tabs) return;
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const toClose = tabs.filter((t) => {
      const url = t.url || t.pendingUrl || '';
      return url && !url.startsWith('chrome://') && !url.startsWith('chrome-extension://') && !t.pinned;
    });
    if (toClose.length > 0) {
      await chrome.tabs.remove(toClose.map((t) => t.id!));
    }
  };

  return (
    <div style={{ width: 280, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #1677ff, #69b1ff)',
            color: '#fff',
            fontWeight: 800,
            fontSize: 15,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          C
        </div>
        <Title level={5} style={{ margin: 0 }}>
          Canopy
        </Title>
      </div>

      <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 12 }}>
        当前窗口 {currentTabs} 个标签 · 共 {tabCount} 个
      </div>

      <Divider style={{ margin: '8px 0' }} />

      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <Button type="primary" icon={<AppstoreOutlined />} block onClick={openNewTab}>
          打开标签管理
        </Button>
        <Button icon={<SaveOutlined />} block onClick={archiveAll} disabled={currentTabs === 0}>
          归档当前窗口
        </Button>
      </Space>
    </div>
  );
}

export default App;
