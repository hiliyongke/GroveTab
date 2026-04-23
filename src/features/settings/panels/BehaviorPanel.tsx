/**
 * BehaviorPanel — 行为设置 Tab
 *
 * 包含：
 *   - 默认视图选择
 *   - 域名分组列数
 *   - 子项 favicon 显示
 *   - 身份色条位置
 *   - 卡片圆角
 *   - 时间轴粒度
 *   - 时间轴精确时间显示
 */

import { Select, Segmented, Switch, Space } from 'antd';
import type { UserSettings } from '@/shared/types';
import { useT } from '@/shared/i18n';
import { VIEW_CONFIGS, type ViewMode } from '@/shared/config/views';
import { Field } from '../components/Field';

interface BehaviorPanelProps {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void;
}

export function BehaviorPanel({ settings, updateSettings }: BehaviorPanelProps) {
  const { t } = useT();

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Field label={t('settings.defaultView')}>
        <Select
          value={settings.defaultView}
          onChange={(v) =>
            updateSettings({
              defaultView: v as ViewMode,
            })
          }
          style={{ width: '100%' }}
          options={VIEW_CONFIGS.map((v) => ({
            value: v.id,
            label: t(v.labelKey as Parameters<typeof t>[0]),
          }))}
        />
      </Field>

      <Field
        label={t('settings.domainGroupColumns')}
        hint={t('settings.domainGroupColumnsHint')}
      >
        <Segmented
          block
          value={String(settings.domainGroupColumns ?? 'auto')}
          onChange={(v) =>
            updateSettings({
              domainGroupColumns:
                v === 'auto' ? 'auto' : (Number(v) as 1 | 2 | 3 | 4 | 5 | 6),
            })
          }
          options={[
            { value: 'auto', label: t('settings.columnsAuto') },
            { value: '2', label: '2' },
            { value: '3', label: '3' },
            { value: '4', label: '4' },
            { value: '5', label: '5' },
          ]}
        />
      </Field>

      <Field
        label={t('settings.domainGroupShowItemFavicon')}
        hint={t('settings.domainGroupShowItemFaviconHint')}
      >
        <Switch
          checked={settings.domainGroupShowItemFavicon ?? true}
          onChange={(v) => updateSettings({ domainGroupShowItemFavicon: v })}
        />
      </Field>

      <Field
        label={t('settings.domainGroupAccentBarPosition')}
        hint={t('settings.domainGroupAccentBarPositionHint')}
      >
        <Segmented
          block
          value={settings.domainGroupAccentBarPosition ?? 'left'}
          onChange={(v) =>
            updateSettings({
              domainGroupAccentBarPosition: v as 'left' | 'top' | 'none',
            })
          }
          options={[
            { value: 'left', label: t('settings.accentBarLeft') },
            { value: 'top', label: t('settings.accentBarTop') },
            { value: 'none', label: t('settings.accentBarNone') },
          ]}
        />
      </Field>

      <Field
        label={t('settings.domainGroupCardRadius')}
        hint={t('settings.domainGroupCardRadiusHint')}
      >
        <Segmented
          block
          value={settings.domainGroupCardRadius ?? 'default'}
          onChange={(v) =>
            updateSettings({
              domainGroupCardRadius: v as 'none' | 'small' | 'default' | 'large',
            })
          }
          options={[
            { value: 'none', label: t('settings.cardRadiusNone') },
            { value: 'small', label: t('settings.cardRadiusSmall') },
            { value: 'default', label: t('settings.cardRadiusDefault') },
            { value: 'large', label: t('settings.cardRadiusLarge') },
          ]}
        />
      </Field>

      <Field
        label={t('settings.timelineGranularity')}
        hint={t('settings.timelineGranularityHint')}
      >
        <Segmented
          block
          value={
            (settings.timelineGranularity ?? 'day') === 'fine'
              ? 'hour'
              : settings.timelineGranularity ?? 'day'
          }
          onChange={(v) =>
            updateSettings({
              timelineGranularity: v as 'day' | 'hour',
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
          onChange={(v) => updateSettings({ timelineShowExactTime: v })}
        />
      </Field>
    </Space>
  );
}
