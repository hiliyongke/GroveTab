/**
 * TimelineSettings —— 时间轴设置组件
 *
 * 包含：
 * 1. 时间轴粒度选择（天/小时）
 * 2. 时间轴显示精确时间开关
 */

import { Segmented, Switch } from 'antd';
import type { UserSettings } from '@/shared/types';
import { useT } from '@/shared/i18n';
import { Field } from '../components/Field';

interface TimelineSettingsProps {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void | Promise<void>;
}

/**
 * 时间轴设置组件
 */
export function TimelineSettings({ settings, updateSettings }: TimelineSettingsProps) {
  const { t } = useT();

  /** 防 ESLint `no-misused-promises`：`updateSettings` 异步但表单回调需要 `void`。 */
  const handleSetting = (patch: Partial<UserSettings>) => {
    void updateSettings(patch);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Field
        label={t('settings.timelineGranularity')}
        hint={t('settings.timelineGranularityHint')}
      >
        <Segmented
          block
          value={(settings.timelineGranularity ?? 'day') === 'fine' ? 'hour' : settings.timelineGranularity ?? 'day'}
          onChange={(value) =>
            handleSetting({
              timelineGranularity: value as 'day' | 'hour',
            })
          }
          options={[
            { value: 'day', label: t('settings.granularityDay') },
            { value: 'hour', label: t('settings.granularityHour') },
          ]}
        />
      </Field>

      <Field
        label={t('settings.timelineShowExactTime')}
        hint={t('settings.timelineShowExactTimeHint')}
      >
        <Switch
          checked={settings.timelineShowExactTime ?? false}
          onChange={(value) => handleSetting({ timelineShowExactTime: value })}
        />
      </Field>
    </div>
  );
}
