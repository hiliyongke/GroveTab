/**
 * BehaviorPanel —— 行为设置 Tab。
 *
 * 包含：
 * 1. 默认视图与布局偏好
 * 2. 时间轴与域名分组行为
 * 3. 搜索范围、拼音、排序与多搜索引擎设置
 */

import { Select, Segmented, Switch, Checkbox } from 'antd';
import type { SearchEngineId, SearchScopeField, UserSettings } from '@/shared/types';
import { useT } from '@/shared/i18n';
import { VIEW_CONFIGS } from '@/shared/config/views';
import { SEARCH_ENGINE_OPTIONS } from '@/shared/config/search-engines';
import { Field } from '../components/Field';

interface BehaviorPanelProps {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void | Promise<void>;
}

export function BehaviorPanel({ settings, updateSettings }: BehaviorPanelProps) {
  const { t } = useT();
  const enabledEngines = settings.searchEnabledEngines ?? SEARCH_ENGINE_OPTIONS.map((item) => item.id);
  const defaultSearchEngine = enabledEngines.includes(settings.searchDefaultEngine ?? 'google')
    ? (settings.searchDefaultEngine ?? 'google')
    : enabledEngines[0];

  /** 防 ESLint `no-misused-promises`：`updateSettings` 异步但表单回调需要 `void`。 */
  const handleSetting = (patch: Partial<UserSettings>) => {
    void updateSettings(patch);
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Field label={t('settings.defaultView')}>
        <Select
          value={settings.defaultView}
          onChange={(value) => handleSetting({ defaultView: value })}
          style={{ width: '100%' }}
          options={VIEW_CONFIGS.map((view) => ({
            value: view.id,
            label: t(view.labelKey),
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
          onChange={(value) =>
            handleSetting({
              domainGroupColumns: value === 'auto' ? 'auto' : (Number(value) as 1 | 2 | 3 | 4 | 5 | 6),
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

      <Field
        label={t('settings.searchScope')}
        hint={t('settings.searchScopeHint')}
      >
        <Checkbox.Group
          value={settings.searchScope ?? ['title', 'hostname', 'url']}
          onChange={(values) => {
            if (values.length === 0) return;
            handleSetting({ searchScope: values as SearchScopeField[] });
          }}
          options={[
            { label: t('settings.searchScopeTitle'), value: 'title' },
            { label: t('settings.searchScopeHostname'), value: 'hostname' },
            { label: t('settings.searchScopeUrl'), value: 'url' },
          ]}
        />
      </Field>

      <Field
        label={t('settings.searchEnablePinyin')}
        hint={t('settings.searchEnablePinyinHint')}
      >
        <Switch
          checked={settings.searchEnablePinyin ?? true}
          onChange={(value) => handleSetting({ searchEnablePinyin: value })}
        />
      </Field>

      <Field
        label={t('settings.searchSortBy')}
        hint={t('settings.searchSortByHint')}
      >
        <Segmented
          block
          value={settings.searchSortBy ?? 'relevance'}
          onChange={(value) =>
            handleSetting({
              searchSortBy: value as 'relevance' | 'recentAccess',
            })
          }
          options={[
            { value: 'relevance', label: t('settings.searchSortByRelevance') },
            { value: 'recentAccess', label: t('settings.searchSortByRecentAccess') },
          ]}
        />
      </Field>

      <Field
        label={t('settings.searchDefaultEngine')}
        hint={t('settings.searchDefaultEngineHint')}
      >
        <Select<SearchEngineId>
          value={defaultSearchEngine}
          onChange={(value) => handleSetting({ searchDefaultEngine: value })}
          style={{ width: '100%' }}
          options={enabledEngines.map((engineId) => {
            const option = SEARCH_ENGINE_OPTIONS.find((item) => item.id === engineId);
            return {
              value: engineId,
              label: option?.label ?? engineId,
            };
          })}
        />
      </Field>

      <Field
        label={t('settings.searchEnabledEngines')}
        hint={t('settings.searchEnabledEnginesHint')}
      >
        <Checkbox.Group
          value={enabledEngines}
          onChange={(values) => {
            if (values.length === 0) return;
            const nextEngines = values;
            handleSetting({
              searchEnabledEngines: nextEngines,
              searchDefaultEngine: nextEngines.includes(defaultSearchEngine)
                ? defaultSearchEngine
                : nextEngines[0],
            });
          }}
          options={SEARCH_ENGINE_OPTIONS.map((item) => ({
            label: item.label,
            value: item.id,
          }))}
        />
      </Field>

      <Field
        label={t('settings.searchAutoFallbackToWeb')}
        hint={t('settings.searchAutoFallbackToWebHint')}
      >
        <Switch
          checked={settings.searchAutoFallbackToWeb ?? true}
          onChange={(value) => handleSetting({ searchAutoFallbackToWeb: value })}
        />
      </Field>

      <Field
        label={t('settings.searchUseHistorySuggestions')}
        hint={t('settings.searchUseHistorySuggestionsHint')}
      >
        <Switch
          checked={settings.searchUseHistorySuggestions ?? true}
          onChange={(value) => handleSetting({ searchUseHistorySuggestions: value })}
        />
      </Field>

      <Field
        label={t('settings.searchUseHotSuggestions')}
        hint={t('settings.searchUseHotSuggestionsHint')}
      >
        <Switch
          checked={settings.searchUseHotSuggestions ?? true}
          onChange={(value) => handleSetting({ searchUseHotSuggestions: value })}
        />
      </Field>
    </div>
  );
}
