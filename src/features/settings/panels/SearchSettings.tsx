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

import { useState } from 'react';
import { Select, Segmented, Switch, Checkbox, Button, Popconfirm, Input, Space, Tag } from 'antd';

import type { SearchEngineId, SearchScopeField, UserSettings } from '@/shared/types';
import { useT } from '@/shared/i18n';
import {
  getAllSearchEngineOptions,
  normalizeEnabledSearchEngines,
} from '@/shared/config/search-engines';
import { Field } from '@/features/settings/components/Field';
import { setData } from '@/repositories/storage-repo';
import { feedback } from '@/shared/ui/feedback';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';

interface SearchSettingsProps {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void | Promise<void>;
}

interface SearchSettingsSnapshot {
  searchCustomEngines?: LocalCustomSearchEngine[];
}

interface LocalCustomSearchEngine {
  id: `custom:${string}`;
  label: string;
  searchUrl: string;
  iconUrl?: string;
  color?: string;
}

function createCustomEngineId(label: string, existing: LocalCustomSearchEngine[]): `custom:${string}` {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const base = slug === '' ? 'engine' : slug;
  let index = existing.length + 1;
  let id: `custom:${string}` = `custom:${base}-${index}`;
  const existingIds = new Set(existing.map((item) => item.id));
  while (existingIds.has(id)) {
    index += 1;
    id = `custom:${base}-${index}`;
  }
  return id;
}

/**
 * 搜索设置组件
 */
export function SearchSettings({ settings, updateSettings }: SearchSettingsProps) {
  const { t } = useT();
  const [customEngineName, setCustomEngineName] = useState('');
  const [customEngineUrl, setCustomEngineUrl] = useState('');
  const [customEngineIcon, setCustomEngineIcon] = useState('');
  const settingsSnapshot = settings as SearchSettingsSnapshot;
  const customEngines: LocalCustomSearchEngine[] = settingsSnapshot.searchCustomEngines ?? [];
  const allEngines = getAllSearchEngineOptions(customEngines);
  const enabledEngines = normalizeEnabledSearchEngines(settings.searchEnabledEngines, customEngines);
  const defaultSearchEngine: SearchEngineId =
    enabledEngines.includes(settings.searchDefaultEngine ?? 'google')
      ? (settings.searchDefaultEngine ?? 'google')
      : (enabledEngines[0] ?? 'google');
  const canAddCustomEngine = customEngineName.trim() !== '' && customEngineUrl.trim() !== '';

  /** 防 ESLint `no-misused-promises`：`updateSettings` 异步但表单回调需要 `void`。 */
  const handleSetting = (patch: Partial<UserSettings>) => {
    void updateSettings(patch);
  };

  const handleAddCustomEngine = () => {
    if (!canAddCustomEngine) return;
    const rawUrl = customEngineUrl.trim();
    const withProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    const searchUrl = withProtocol.includes('{query}')
      ? withProtocol
      : `${withProtocol}${withProtocol.includes('?') ? '&' : '?'}q={query}`;
    const iconUrl = customEngineIcon.trim();
    const engine: LocalCustomSearchEngine = {
      id: createCustomEngineId(customEngineName, customEngines),
      label: customEngineName.trim(),
      searchUrl,
      iconUrl: iconUrl === '' ? undefined : iconUrl,
      color: '#64748b',
    };
    const nextCustomEngines: LocalCustomSearchEngine[] = [...customEngines, engine];
    const nextEnabledEngines: SearchEngineId[] = [...enabledEngines, engine.id];
    handleSetting({
      searchCustomEngines: nextCustomEngines,
      searchEnabledEngines: nextEnabledEngines,
      searchDefaultEngine: defaultSearchEngine,
    });
    setCustomEngineName('');
    setCustomEngineUrl('');
    setCustomEngineIcon('');
    feedback.success(t('已添加自定义搜索引擎'));
  };

  return (
    <div className="settings-panel-stack settings-panel-stack--regular">
      <Field
        label={t('搜索范围')}
        hint={t('选择搜索时匹配哪些字段；缩小范围可提升搜索速度')}
      >
        <Checkbox.Group
          className="settings-checkbox-group"
          value={settings.searchScope ?? ['title', 'hostname', 'url']}
          onChange={(values) => {
            if (values.length === 0) return;
            handleSetting({ searchScope: values as SearchScopeField[] });
          }}
          options={[
            { label: t('标题'), value: 'title' },
            { label: t('域名'), value: 'hostname' },
            { label: t('URL'), value: 'url' },
          ]}
        />
      </Field>

      <Field
        label={t('拼音搜索')}
        hint={t('开启后支持用拼音首字母或全拼搜索中文标题；对非中文用户可关闭以节省性能')}
      >
        <Switch
          checked={settings.searchEnablePinyin ?? true}
          onChange={(value) => handleSetting({ searchEnablePinyin: value })}
        />
      </Field>

      <Field
        label={t('搜索结果排序')}
        hint={t('相关度：按匹配程度排序；最近访问：按标签最后活跃时间排序')}
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
            { value: 'relevance', label: t('相关度') },
            { value: 'recentAccess', label: t('最近访问') },
          ]}
        />
      </Field>

      <Field
        label={t('默认搜索引擎')}
        hint={t('在搜索框中回车时使用的搜索引擎')}
      >
        <Select<SearchEngineId>
          value={defaultSearchEngine}
          onChange={(value) => handleSetting({ searchDefaultEngine: value })}
          className="settings-control-full"
          options={enabledEngines.map((engineId) => {
            const option = allEngines.find((item) => item.id === engineId);
            return {
              value: engineId,
              label: option?.label ?? engineId,
            };
          })}
        />
      </Field>

      <Field
        label={t('启用的搜索引擎')}
        hint={t('选择搜索框下方快捷切换的搜索引擎')}
      >
        <Checkbox.Group
          className="settings-checkbox-group"
          value={enabledEngines}
          onChange={(values) => {
            if (values.length === 0) return;
            const nextEngines = values;
            handleSetting({
              searchEnabledEngines: nextEngines,
              searchDefaultEngine: nextEngines.includes(defaultSearchEngine)
                ? defaultSearchEngine
                : nextEngines[0]!,
            });
          }}
          options={allEngines.map((item) => ({
            label: item.builtIn ? item.label : <span>{item.label} <Tag>{t('自定义')}</Tag></span>,
            value: item.id,
          }))}
        />
      </Field>

      <Field
        label={t('自定义搜索引擎')}
        hint={t('添加任意搜索引擎；URL 可使用 {query} 作为关键词占位，不填会自动追加 q={query}')}
      >
        <Space.Compact className="settings-control-full">
          <Input
            value={customEngineName}
            onChange={(e) => setCustomEngineName(e.target.value)}
            placeholder={t('名称')}
          />
          <Input
            value={customEngineUrl}
            onChange={(e) => setCustomEngineUrl(e.target.value)}
            placeholder={t('搜索 URL')}
          />
          <Input
            value={customEngineIcon}
            onChange={(e) => setCustomEngineIcon(e.target.value)}
            placeholder={t('Logo URL（可选）')}
          />
          <Button type="primary" disabled={!canAddCustomEngine} onClick={handleAddCustomEngine}>
            {t('添加')}
          </Button>
        </Space.Compact>
      </Field>

      <Field
        label={t('本地无结果时优先网页搜索')}
        hint={t('开启后，若没有匹配的已打开标签，搜索框会高亮网页搜索动作')}
      >
        <Switch
          checked={settings.searchAutoFallbackToWeb ?? true}
          onChange={(value) => handleSetting({ searchAutoFallbackToWeb: value })}
        />
      </Field>

      <Field
        label={t('使用浏览历史建议')}
        hint={t('从浏览器历史中提取页面作为建议；首次使用会申请 history 权限')}
      >
        <Switch
          checked={settings.searchUseHistorySuggestions ?? true}
          onChange={(value) => handleSetting({ searchUseHistorySuggestions: value })}
        />
      </Field>

      <Field
        label={t('显示热门关键词建议')}
        hint={t('在输入为空或本地结果不足时附加热词，可选择来源')}
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
        label={t('热词来源')}
        hint={t('选择热词从哪里来；本地来源完全离线，不产生任何网络请求')}
      >
        <Select<UserSettings['hotSuggestionSource']>
          value={settings.hotSuggestionSource ?? 'local'}
          disabled={settings.searchUseHotSuggestions === false}
          onChange={(v) => handleSetting({ hotSuggestionSource: v })}
          className="settings-control-full"
          options={[
            { value: 'local', label: t('本地（基于你的搜索历史）') },
            { value: 'preset', label: t('预设词表（静态）') },
            { value: 'trending', label: t('公共热榜（来自互联网）') },
            { value: 'off', label: t('关闭') },
          ]}
        />
      </Field>

      {/* 清空最近搜索 —— 将应用命名空间下的搜索历史键直接置为空数组 */}
      <Field
        label={t('清空最近搜索')}
        hint={t('settings.clearRecentSearchesHint')}
      >
        <Popconfirm
          title={t('确认清空全部最近搜索？')}
          onConfirm={() => {
            void (async () => {
              try {
                await setData(STORAGE_KEYS.searchHistory, []);
                feedback.success(t('最近搜索已清空'));
              } catch (err) {
                console.error('[SearchSettings] clearSearchHistory failed:', err);
              }
            })();
          }}
        >
          <Button size="small" danger>
            {t('清空最近搜索')}
          </Button>
        </Popconfirm>
      </Field>
    </div>
  );
}
