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
import { Field } from '../components/Field';
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
        return t('settings.dedupHintStrict');
      case 'off':
        return t('settings.dedupHintOff');
      case 'loose':
      default:
        return t('settings.dedupHintLoose');
    }
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── 接管新标签页 ── */}
      <Field
        label={t('settings.overrideNewTab')}
        hint={t('settings.overrideNewTabHint', { brand: BRAND.name })}
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
          options={[3, 5, 7, 10].map((n) => ({ value: n, label: t('settings.undoWindowSeconds', { n }) }))}
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
    </div>
  );
}
