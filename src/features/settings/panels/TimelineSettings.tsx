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
import { Field } from '@/features/settings/components/Field';

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
    <div className="settings-panel-stack settings-panel-stack--regular">
      <Field
        label={t('时间轴分组粒度')}
        hint={t('按天更简洁；按小时把今天和昨天按整点拆成小桶，一眼看清每个小时的访问节奏')}
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
            { value: 'day', label: t('按天') },
            { value: 'hour', label: t('按小时') },
          ]}
        />
      </Field>

      <Field
        label={t('显示具体时间')}
        hint={t('在时段旁和每条标签旁展示具体访问时间（HH:mm）')}
      >
        <Switch
          checked={settings.timelineShowExactTime ?? false}
          onChange={(value) => handleSetting({ timelineShowExactTime: value })}
        />
      </Field>
    </div>
  );
}
