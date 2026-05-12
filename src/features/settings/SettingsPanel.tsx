/**
 * SettingsPanel — 右侧抽屉式设置面板（antd 版）
 *
 * 拆分为独立面板后，此处仅负责：
 *   - Drawer 外壳（placement="right"）
 *   - Tabs 导航组装
 *   - 向各子面板传递 settings / updateSettings
 *   - 支持受控激活 Tab（defaultActiveTab），便于从外部 hash（#about）直接切到指定 Tab
 */

import { Drawer, Tabs } from 'antd';
import { useState, useEffect } from 'react';
import {
  Palette,
  SlidersHorizontal,
  Database,
  KeyRound,
  Info,
  Quote,
} from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useSettingsStore } from '@/store';
import { useT } from '@/shared/i18n';
import { AppearancePanel } from './panels/AppearancePanel';
import { BehaviorPanel } from './panels/BehaviorPanel';
import { DataPanel } from './panels/DataPanel';
import { ShortcutsPanel } from './panels/ShortcutsPanel';
import { AboutPanel } from './panels/AboutPanel';
import { QuotesPanel } from './panels/QuotesPanel';

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 初始激活的 Tab（可选），支持 'appearance' | 'behavior' | 'data' | 'shortcuts' | 'about'。 */
  defaultActiveTab?: string;
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

  return (
    <Drawer
      open={open}
      onClose={() => onOpenChange(false)}
      title={t('settings.title')}
      placement="right"
      width={420}
      destroyOnHidden
    >
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key)}
        items={[
          {
            key: 'appearance',
            label: (
              <span>
<Palette size={ICON_SIZE.MEDIUM} /> {t('settings.appearance')}
              </span>
            ),
            children: <AppearancePanel settings={settings} updateSettings={updateSettings} />,
          },
          {
            key: 'behavior',
            label: (
              <span>
<SlidersHorizontal size={ICON_SIZE.MEDIUM} /> {t('settings.behavior')}
              </span>
            ),
            children: <BehaviorPanel settings={settings} updateSettings={updateSettings} />,
          },
          {
            key: 'quotes',
            label: (
              <span>
<Quote size={ICON_SIZE.MEDIUM} /> {t('settings.quotes')}
              </span>
            ),
            children: <QuotesPanel />,
          },
          {
            key: 'data',
            label: (
              <span>
<Database size={ICON_SIZE.MEDIUM} /> {t('settings.data')}
              </span>
            ),
            children: <DataPanel />,
          },
          {
            key: 'shortcuts',
            label: (
              <span>
<KeyRound size={ICON_SIZE.MEDIUM} /> {t('settings.shortcuts')}
              </span>
            ),
            children: <ShortcutsPanel />,
          },
          {
            key: 'about',
            label: (
              <span>
<Info size={ICON_SIZE.MEDIUM} /> {t('settings.about')}
              </span>
            ),
            children: <AboutPanel />,
          },
        ]}
      />
    </Drawer>
  );
}
