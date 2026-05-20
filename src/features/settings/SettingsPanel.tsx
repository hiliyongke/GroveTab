/**
 * SettingsPanel — 设置抽屉（Drawer 版）
 *
 * 布局：
 *   - 右侧抽屉（带毛玻璃遮罩）
 *   - 左侧图标导航栏 + 右侧内容区（可滚动）
 *
 * 支持受控激活 Tab（defaultActiveTab），便于从外部 hash（#about）直接切到指定 Tab。
 */

import { Drawer } from 'antd';
import { useState, useEffect, useCallback } from 'react';
import {
  Palette,
  SlidersHorizontal,
  Database,
  KeyRound,
  Info,
} from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useSettingsStore } from '@/store';
import { useT } from '@/shared/i18n';
import './settings.css';
import { AppearancePanel } from './panels/AppearancePanel';
import { BehaviorPanel } from './panels/BehaviorPanel';
import { DataPanel } from './panels/DataPanel';
import { ShortcutsPanel } from './panels/ShortcutsPanel';
import { AboutPanel } from './panels/AboutPanel';

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 初始激活的 Tab（可选），支持 'appearance' | 'behavior' | 'data' | 'shortcuts' | 'about'。 */
  defaultActiveTab?: string;
}

/** Tab 配置项 */
interface TabConfig {
  key: string;
  icon: React.ReactNode;
  labelKey: string;
  component: React.ReactNode;
}

export function SettingsPanel({ open, onOpenChange, defaultActiveTab = 'appearance' }: SettingsPanelProps) {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const { t } = useT();
  /** 受控的 Tabs activeKey */
  const [activeTab, setActiveTab] = useState(defaultActiveTab);
  /** 当 defaultActiveTab 变化时，更新 activeTab（支持外部控制初始 Tab） */
  useEffect(() => {
    setActiveTab(defaultActiveTab);
  }, [defaultActiveTab]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  /** Tab 配置 */
  const tabs: TabConfig[] = [
    {
      key: 'appearance',
      icon: <Palette size={ICON_SIZE.MEDIUM} />,
      labelKey: 'settings.appearance',
      component: <AppearancePanel settings={settings} updateSettings={updateSettings} />,
    },
    {
      key: 'behavior',
      icon: <SlidersHorizontal size={ICON_SIZE.MEDIUM} />,
      labelKey: 'settings.behavior',
      component: <BehaviorPanel settings={settings} updateSettings={updateSettings} />,
    },
    {
      key: 'data',
      icon: <Database size={ICON_SIZE.MEDIUM} />,
      labelKey: 'settings.data',
      component: <DataPanel />,
    },
    {
      key: 'shortcuts',
      icon: <KeyRound size={ICON_SIZE.MEDIUM} />,
      labelKey: 'settings.shortcuts',
      component: <ShortcutsPanel />,
    },
    {
      key: 'about',
      icon: <Info size={ICON_SIZE.MEDIUM} />,
      labelKey: 'settings.about',
      component: <AboutPanel />,
    },
  ];

  /** 当前激活的 Tab 内容 */
  const activeItem = tabs.find((tab) => tab.key === activeTab);

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      destroyOnClose
      width={640}
      rootClassName="settings-drawer"
      styles={{
        mask: { backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.32)' },
        body: { padding: 0, overflow: 'hidden' },
        header: { display: 'none' },
      }}
    >
      <div className="settings-shell">
        {/* 左侧图标导航 */}
        <nav className="settings-nav">
          <div className="settings-nav__list">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`settings-nav__item${activeTab === tab.key ? ' is-active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
                title={t(tab.labelKey)}
              >
                <span className="settings-nav__icon">{tab.icon}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* 右侧内容区 */}
        <main className="settings-content">
          <div className="settings-content__header">
            <h2 className="settings-content__title">
              {activeItem && t(activeItem.labelKey)}
            </h2>
          </div>
          <div className="settings-content__body">
            {activeItem?.component}
          </div>
        </main>
      </div>
    </Drawer>
  );
}
