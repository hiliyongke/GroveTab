/**
 * GeneralSettings —— 通用行为设置组件
 *
 * 包含：
 * 1. 接管新标签页开关
 * 2. 去重严格度选择
 * 3. 闲置阈值选择
 * 4. Undo 撤销窗口选择
 * 5. 自动快照频率选择
 * 6. OG description 抓取开关
 */

import { Select, Segmented, Switch } from 'antd';

import type { UserSettings } from '@/shared/types';
import { useT } from '@/shared/i18n';
import { Field } from '@/features/settings/components/Field';
import { BRAND } from '@/shared/config/brand';

interface GeneralSettingsProps {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void | Promise<void>;
}

/**
 * 通用行为设置组件
 */
export function GeneralSettings({ settings, updateSettings }: GeneralSettingsProps) {
  const { t } = useT();

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
        return t('URL 完全相同才认为重复；?page=1 与 ?page=2 不会被判为重复。');
      case 'off':
        return t('已禁用；Dashboard / TidySuggestionBar 不会提示重复标签。');
      case 'loose':
      default:
        return t('忽略 #hash 和 utm_* / fbclid / gclid 跟踪参数；article?utm_campaign=a 与 article?utm_campaign=b 会被判为重复。');
    }
  })();

  return (
    <div className="settings-panel-stack settings-panel-stack--compact">
      {/* ── 接管新标签页 ── */}
      <Field
        label={t('接管新标签页')}
        hint={t('开启后每次新建标签页都显示 {brand} 工作台；关闭后使用浏览器默认页。', { brand: BRAND.name })}
      >
        <Switch
          checked={settings.overrideNewTab !== false}
          onChange={(value) => handleSetting({ overrideNewTab: value })}
        />
      </Field>

      {/* ── 去重严格度 (F-13) ── */}
      <Field label={t('去重严格度')} hint={dedupExampleHint}>
        <Segmented
          block
          value={dedupStrictness}
          onChange={(value) => handleSetting({ dedupStrictness: value as 'strict' | 'loose' | 'off' })}
          options={[
            { value: 'strict', label: t('严格') },
            { value: 'loose', label: t('宽松（默认）') },
            { value: 'off', label: t('关闭') },
          ]}
        />
      </Field>

      {/* ── 闲置阈值 (F-13 / F-09) ── */}
      <Field label={t('闲置阈值')} hint={t('settings.idleThresholdHint')}>
        <Select
          value={settings.idleThresholdMinutes ?? 1440}
          onChange={(value) => handleSetting({ idleThresholdMinutes: value })}
          className="settings-control-full"
          options={[
            { value: 360, label: t('6 小时') },
            { value: 720, label: t('12 小时') },
            { value: 1440, label: t('24 小时（默认）') },
            { value: 4320, label: t('3 天') },
            { value: 10080, label: t('7 天') },
          ]}
        />
      </Field>

      {/* ── Undo 撤销窗口 ── */}
      <Field label={t('Undo 撤销窗口')} hint={t('关闭 / 归档后多久内可以撤销；建议 5 秒。')}>
        <Select
          value={settings.undoWindowSeconds ?? 5}
          onChange={(value) => handleSetting({ undoWindowSeconds: value })}
          className="settings-control-full"
          options={[3, 5, 7, 10].map((n) => ({ value: n, label: t('{n} 秒', { n }) }))}
        />
      </Field>

      {/* ── 自动快照 (F-23) ── */}
      <Field label={t('自动快照频率')} hint={t('当前窗口 ≥10 个标签且距上次快照 >6h 时静默创建隐藏会话；最多保留 20 个。')}>
        <Segmented
          block
          value={settings.autoSnapshotFrequency ?? '12h'}
          onChange={(value) =>
            handleSetting({ autoSnapshotFrequency: value as 'off' | '6h' | '12h' | '24h' })
          }
          options={[
            { value: 'off', label: t('关闭') },
            { value: '6h', label: '6h' },
            { value: '12h', label: '12h' },
            { value: '24h', label: '24h' },
          ]}
        />
      </Field>

      {/* ── OG description 抓取 (F-24) ── */}
      <Field label={t('允许抓取网页描述（用于搜索增强）')} hint={t('开启后需授予 <all_urls> 权限；仅读取 meta 描述，不发送任何额外网络请求。')}>
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
    </div>
  );
}
