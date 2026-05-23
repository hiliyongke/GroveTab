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
import styles from '../settings.module.less';

interface TimelineSettingsProps {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void | Promise<void>;
}

/**
 * 时间轴设置组件
 *
 * 包含：
 * 1. 时间轴粒度选择（天/小时）
 * 2. 时间轴显示精确时间开关
 *
 * @param props - 组件属性
 * @param props.settings - 当前用户设置
 * @param props.updateSettings - 更新设置回调
 * @returns 时间轴设置组件 JSX 元素
 */
export function TimelineSettings({ settings, updateSettings }: TimelineSettingsProps) {
  const { t } = useT();

  /**
   * 防 ESLint `no-misused-promises`：`updateSettings` 异步但表单回调需要 `void`。
   *
   * @param patch - 部分用户设置对象
   * @returns void
   */
  const handleSetting = (patch: Partial<UserSettings>) => {
    void updateSettings(patch);
  };

  return (
    <div className={`${styles['settings-panel-stack']} ${styles['settings-panel-stack--regular']}`}>
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
