/**
 * BehaviorPanel —— 行为设置 Tab。
 *
 * 包含：
 * 1. 默认视图与布局偏好
 * 2. 时间轴与域名分组行为
 * 3. 搜索范围、拼音、排序与多搜索引擎设置
 */

import { Select, Segmented, Switch, Checkbox, Button, Popconfirm } from 'antd';
import type { SearchEngineId, SearchScopeField, UserSettings } from '@/shared/types';
import { useT } from '@/shared/i18n';
import { VIEW_CONFIGS } from '@/shared/config/views';
import { SEARCH_ENGINE_OPTIONS } from '@/shared/config/search-engines';
import { Field } from '../components/Field';
import { setData } from '@/repositories/storage-repo';
import { feedback } from '@/shared/ui/feedback';

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

  /**
   * 三档去重示例文案 —— 帮用户理解当前档会把什么认为重复
   */
  const dedupStrictness = settings.dedupStrictness ?? 'loose';
  const dedupExampleHint = (() => {
    switch (dedupStrictness) {
      case 'strict':
        return t('settings.dedupHintStrict');
      case 'off':
        return t('settings.dedupHintOff');
      case 'loose':
      default:
        return t('settings.dedupHintLoose');
    }
  })();

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── 接管新标签页 ── */}
      <Field
        label={t('settings.overrideNewTab')}
        hint={t('settings.overrideNewTabHint')}
      >
        <Switch
          checked={settings.overrideNewTab !== false}
          onChange={(value) => handleSetting({ overrideNewTab: value })}
        />
      </Field>

      {/* ── 去重严格度 (F-13) ── */}
      <Field label={t('settings.dedupStrictness')} hint={dedupExampleHint}>
        <Segmented
          block
          value={dedupStrictness}
          onChange={(value) => handleSetting({ dedupStrictness: value as 'strict' | 'loose' | 'off' })}
          options={[
            { value: 'strict', label: t('settings.dedupStrict') },
            { value: 'loose', label: t('settings.dedupLoose') },
            { value: 'off', label: t('settings.dedupOff') },
          ]}
        />
      </Field>

      {/* ── 闲置阈值 (F-13 / F-09) ── */}
      <Field label={t('settings.idleThreshold')} hint={t('settings.idleThresholdHint')}>
        <Select
          value={settings.idleThresholdMinutes ?? 1440}
          onChange={(value) => handleSetting({ idleThresholdMinutes: value })}
          style={{ width: '100%' }}
          options={[
            { value: 360, label: t('settings.idle6h') },
            { value: 720, label: t('settings.idle12h') },
            { value: 1440, label: t('settings.idle24h') },
            { value: 4320, label: t('settings.idle3d') },
            { value: 10080, label: t('settings.idle7d') },
          ]}
        />
      </Field>

      {/* ── Undo 撤销窗口 ── */}
      <Field label={t('settings.undoWindow')} hint={t('settings.undoWindowHint')}>
        <Select
          value={settings.undoWindowSeconds ?? 5}
          onChange={(value) => handleSetting({ undoWindowSeconds: value })}
          style={{ width: '100%' }}
          options={[3, 5, 7, 10].map((n) => ({ value: n, label: `${n} 秒` }))}
        />
      </Field>

      {/* ── 自动快照 (F-23) ── */}
      <Field label={t('settings.autoSnapshot')} hint={t('settings.autoSnapshotHint')}>
        <Segmented
          block
          value={settings.autoSnapshotFrequency ?? '12h'}
          onChange={(value) =>
            handleSetting({ autoSnapshotFrequency: value as 'off' | '6h' | '12h' | '24h' })
          }
          options={[
            { value: 'off', label: t('settings.autoSnapshotOff') },
            { value: '6h', label: '6h' },
            { value: '12h', label: '12h' },
            { value: '24h', label: '24h' },
          ]}
        />
      </Field>

      {/* ── OG description 抓取 (F-24) ── */}
      <Field label={t('settings.enableOgFetch')} hint={t('settings.enableOgFetchHint')}>
        <Switch
          checked={settings.enableOgFetch === true}
          onChange={(value) => {
            if (value) {
              // 申请 <all_urls> 权限；用户拒绝则不打开
              if (typeof chrome !== 'undefined' && chrome.permissions !== undefined) {
                void chrome.permissions.request({ origins: ['<all_urls>'] }).then((granted) => {
                  handleSetting({ enableOgFetch: granted });
                });
              } else {
                handleSetting({ enableOgFetch: true });
              }
            } else {
              if (typeof chrome !== 'undefined' && chrome.permissions !== undefined) {
                void chrome.permissions.remove({ origins: ['<all_urls>'] });
              }
              handleSetting({ enableOgFetch: false });
            }
          }}
        />
      </Field>
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
            await setData('canopy_search_history', []);
            feedback.success(t('settings.clearRecentSearchesDone'));
          }}
        >
          <Button size="small" danger>
            {t('settings.clearRecentSearches')}
          </Button>
        </Popconfirm>
      </Field>

      {/* ── 每日金句（v1.2） ────────────────────────────────
          开关 + 分类多选 + 字号 + 是否显示出处 + 收藏夹清理。
          字段全部可选，未配置时走 DailyQuote 组件的默认值。 */}
      <Field label={t('settings.dailyQuote')} hint={t('settings.dailyQuoteHint')}>
        <Switch
          checked={settings.dailyQuote?.enabled !== false}
          onChange={(v) =>
            handleSetting({
              dailyQuote: { ...(settings.dailyQuote ?? {}), enabled: v },
            })
          }
        />
      </Field>

      {settings.dailyQuote?.enabled !== false && (
        <>
          <Field
            label={t('settings.dailyQuoteCategories')}
            hint={t('settings.dailyQuoteCategoriesHint')}
          >
            <Checkbox.Group
              value={settings.dailyQuote?.categories ?? ['aphorism', 'renmin', 'poetry', 'essay']}
              onChange={(values) => {
                if (values.length === 0) return;
                handleSetting({
                  dailyQuote: {
                    ...(settings.dailyQuote ?? {}),
                    categories: values as Array<'aphorism' | 'renmin' | 'poetry' | 'essay'>,
                  },
                });
              }}
              options={[
                { value: 'aphorism', label: t('settings.quoteCatAphorism') },
                { value: 'renmin', label: t('settings.quoteCatRenmin') },
                { value: 'poetry', label: t('settings.quoteCatPoetry') },
                { value: 'essay', label: t('settings.quoteCatEssay') },
              ]}
            />
          </Field>

          <Field
            label={t('settings.dailyQuoteFontSize')}
            hint={t('settings.dailyQuoteFontSizeHint')}
          >
            <Segmented
              block
              value={String(settings.dailyQuote?.fontSize ?? 15)}
              onChange={(value) =>
                handleSetting({
                  dailyQuote: {
                    ...(settings.dailyQuote ?? {}),
                    fontSize: Number(value),
                  },
                })
              }
              options={[
                { value: '13', label: 'S' },
                { value: '15', label: 'M' },
                { value: '17', label: 'L' },
                { value: '19', label: 'XL' },
              ]}
            />
          </Field>

          <Field label={t('settings.dailyQuoteShowSource')}>
            <Switch
              checked={settings.dailyQuote?.showSource !== false}
              onChange={(v) =>
                handleSetting({
                  dailyQuote: { ...(settings.dailyQuote ?? {}), showSource: v },
                })
              }
            />
          </Field>

          <Field
            label={t('settings.dailyQuoteClearFavs')}
            hint={t('settings.dailyQuoteClearFavsHint')}
          >
            <Popconfirm
              title={t('settings.dailyQuoteClearFavsConfirm')}
              onConfirm={async () => {
                // 动态 import，避免 BehaviorPanel 静态依赖 quotes chunk
                const { clearFavorites } = await import('@/features/quotes');
                await clearFavorites();
                feedback.success(t('settings.dailyQuoteClearFavsDone'));
              }}
            >
              <Button size="small" danger>
                {t('settings.dailyQuoteClearFavs')}
              </Button>
            </Popconfirm>
          </Field>
        </>
      )}
    </div>
  );
}
