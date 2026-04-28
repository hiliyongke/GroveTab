/**
 * SearchSettings —— 搜索相关设置组件
 *
 * 包含：
 * 1. 搜索范围设置
 * 2. 拼音搜索开关
 * 3. 搜索结果排序
 * 4. 默认搜索引擎
 * 5. 启用的搜索引擎
 * 6. 自动回退到网页搜索
 * 7. 使用历史建议
 * 8. 使用热词建议
 * 9. 热词来源选择
 * 10. 清空最近搜索
 */

import { Select, Segmented, Switch, Checkbox, Button, Popconfirm } from 'antd';
import type { SearchEngineId, SearchScopeField, UserSettings } from '@/shared/types';
import { useT } from '@/shared/i18n';
import { SEARCH_ENGINE_OPTIONS } from '@/shared/config/search-engines';
import { Field } from '../components/Field';
import { setData } from '@/repositories/storage-repo';
import { feedback } from '@/shared/ui/feedback';

interface SearchSettingsProps {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void | Promise<void>;
}

/**
 * 搜索设置组件
 */
export function SearchSettings({ settings, updateSettings }: SearchSettingsProps) {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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

      {/*
        热词来源：off / local / preset / trending
        仅在总开关 searchUseHotSuggestions 打开时生效；无值时默认 local。
      */}
      <Field
        label={t('settings.hotSuggestionSource')}
        hint={t('settings.hotSuggestionSourceHint')}
      >
        <Select<UserSettings['hotSuggestionSource']>
          value={settings.hotSuggestionSource ?? 'local'}
          disabled={settings.searchUseHotSuggestions === false}
          onChange={(v) => handleSetting({ hotSuggestionSource: v })}
          style={{ width: '100%' }}
          options={[
            { value: 'local', label: t('settings.hotSourceLocal') },
            { value: 'preset', label: t('settings.hotSourcePreset') },
            { value: 'trending', label: t('settings.hotSourceTrending'), disabled: true },
            { value: 'off', label: t('settings.hotSourceOff') },
          ]}
        />
      </Field>

      {/* 清空最近搜索 —— 将 'canopy_search_history' 键直接置为空数组 */}
      <Field
        label={t('settings.clearRecentSearches')}
        hint={t('settings.clearRecentSearchesHint')}
      >
        <Popconfirm
          title={t('settings.clearRecentSearchesConfirm')}
          onConfirm={async () => {
            try {
              await setData('canopy_search_history', []);
              feedback.success(t('settings.clearRecentSearchesDone'));
            } catch (err) {
              console.error('[SearchSettings] clearSearchHistory failed:', err);
            }
          }}
        >
          <Button size="small" danger>
            {t('settings.clearRecentSearches')}
          </Button>
        </Popconfirm>
      </Field>
    </div>
  );
}
