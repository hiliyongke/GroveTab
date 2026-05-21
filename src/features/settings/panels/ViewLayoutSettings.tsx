/**
 * ViewLayoutSettings —— 视图与布局设置组件
 *
 * 包含：
 * 1. 默认视图选择
 * 2. 域名分组列数
 * 3. 域名分组显示 favicon 开关
 * 4. 域名分组强调条位置
 * 5. 域名分组卡片圆角
 * 6. 域名分组排序方式
 */

import { Select, Segmented, Switch } from 'antd';
import type { NewtabPageMode, UserSettings, ViewTabPosition } from '@/shared/types';
import { useT } from '@/shared/i18n';
import { VIEW_CONFIGS } from '@/shared/config/views';
import { Field } from '../components/Field';

interface ViewLayoutSettingsProps {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void | Promise<void>;
}

/**
 * 视图与布局设置组件
 */
export function ViewLayoutSettings({ settings, updateSettings }: ViewLayoutSettingsProps) {
  const { t } = useT();

  /** 防 ESLint `no-misused-promises`：`updateSettings` 异步但表单回调需要 `void`。 */
  const handleSetting = (patch: Partial<UserSettings>) => {
    void updateSettings(patch);
  };

  return (
    <div className="settings-panel-stack settings-panel-stack--regular">
      <Field label={t('settings.defaultPageMode')} hint={t('settings.defaultPageModeHint')}>
        <Segmented
          block
          value={settings.newtabPageMode ?? 'workspace'}
          onChange={(value) => handleSetting({ newtabPageMode: value as NewtabPageMode })}
          options={[
            { value: 'workspace', label: t('pageMode.workspace') },
            { value: 'trending', label: t('pageMode.trending') },
            { value: 'devtools', label: t('pageMode.devtools') },
          ]}
        />
      </Field>

      <Field label={t('settings.defaultView')}>
        <Select
          value={settings.defaultView}
          onChange={(value) => handleSetting({ defaultView: value })}
          className="settings-control-full"
          options={VIEW_CONFIGS.map((view) => ({
            value: view.id,
            label: t(view.labelKey),
          }))}
        />
      </Field>

      <Field
        label={t('settings.viewTabPosition')}
        hint={t('settings.viewTabPositionHint')}
      >
        <Segmented
          block
          value={settings.viewTabPosition ?? 'top'}
          onChange={(value) => handleSetting({ viewTabPosition: value as ViewTabPosition })}
          options={[
            { value: 'top', label: t('settings.viewTabPositionTop') },
            { value: 'left', label: t('settings.viewTabPositionLeft') },
            { value: 'right', label: t('settings.viewTabPositionRight') },
          ]}
        />
      </Field>

      <Field
        label={t('settings.domainGroupColumns')}
        hint={t('settings.domainGroupColumnsHint')}
      >
        <Segmented
          block
          value={String(settings.domainGroupColumns ?? 'auto')}
          onChange={(value) =>
            handleSetting({
              domainGroupColumns: value === 'auto' ? 'auto' : (Number(value) as 1 | 2 | 3 | 4 | 5 | 6),
            })
          }
          options={[
            { value: 'auto', label: t('settings.columnsAuto') },
            { value: '1', label: '1' },
            { value: '2', label: '2' },
            { value: '3', label: '3' },
            { value: '4', label: '4' },
            { value: '5', label: '5' },
            { value: '6', label: '6' },
          ]}
        />
      </Field>

      <Field
        label={t('settings.domainGroupShowItemFavicon')}
        hint={t('settings.domainGroupShowItemFaviconHint')}
      >
        <Switch
          checked={settings.domainGroupShowItemFavicon ?? true}
          onChange={(value) => handleSetting({ domainGroupShowItemFavicon: value })}
        />
      </Field>

      <Field
        label={t('settings.domainGroupAccentBarPosition')}
        hint={t('settings.domainGroupAccentBarPositionHint')}
      >
        <Segmented
          block
          value={settings.domainGroupAccentBarPosition ?? 'left'}
          onChange={(value) =>
            handleSetting({
              domainGroupAccentBarPosition: value as 'left' | 'top' | 'none',
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
          onChange={(value) =>
            handleSetting({
              domainGroupCardRadius: value as 'none' | 'small' | 'default' | 'large',
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
        label={t('settings.domainGroupSortBy')}
        hint={t('settings.domainGroupSortByHint')}
      >
        <Segmented
          block
          value={settings.domainGroupSortBy ?? 'tabCount'}
          onChange={(value) =>
            handleSetting({
              domainGroupSortBy: value as 'tabCount' | 'alphabetical' | 'recentAccess',
            })
          }
          options={[
            { value: 'tabCount', label: t('settings.sortByTabCount') },
            { value: 'alphabetical', label: t('settings.sortByAlphabetical') },
            { value: 'recentAccess', label: t('settings.sortByRecentAccess') },
          ]}
        />
      </Field>
    </div>
  );
}
