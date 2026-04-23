/**
 * SettingsPanel — 右侧抽屉式设置面板（antd 版）
 *
 * 拆分为独立面板后，此处仅负责：
 *   - Drawer 外壳（placement="right"）
 *   - Tabs 导航组装
 *   - 向各子面板传递 settings / updateSettings
 */

import { Drawer, Tabs } from 'antd';
import {
  BgColorsOutlined,
  ControlOutlined,
  DatabaseOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { useSettingsStore } from '@/store';
import { useT } from '@/shared/i18n';
import { AppearancePanel } from './panels/AppearancePanel';
import { BehaviorPanel } from './panels/BehaviorPanel';
import { DataPanel } from './panels/DataPanel';
import { ShortcutsPanel } from './panels/ShortcutsPanel';

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsPanel({ open, onOpenChange }: SettingsPanelProps) {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const { t } = useT();

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
        defaultActiveKey="appearance"
        items={[
          {
            key: 'appearance',
            label: (
              <span>
                <BgColorsOutlined /> {t('settings.appearance')}
              </span>
            ),
            children: <AppearancePanel settings={settings} updateSettings={updateSettings} />,
          },
          {
            key: 'behavior',
            label: (
              <span>
                <ControlOutlined /> {t('settings.behavior')}
              </span>
            ),
            children: <BehaviorPanel settings={settings} updateSettings={updateSettings} />,
          },
          {
            key: 'data',
            label: (
              <span>
                <DatabaseOutlined /> {t('settings.data')}
              </span>
            ),
            children: <DataPanel />,
          },
          {
            key: 'shortcuts',
            label: (
              <span>
                <KeyOutlined /> {t('settings.shortcuts')}
              </span>
            ),
            children: <ShortcutsPanel />,
          },
        ]}
      />
    </Drawer>
  );
}
