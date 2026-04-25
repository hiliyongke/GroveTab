/**
 * DailyQuoteSettings —— 每日金句设置组件
 *
 * 包含：
 * 1. 每日金句总开关
 * 2. 金句分类多选
 * 3. 金句字体大小
 * 4. 显示出处开关
 * 5. 清空收藏夹
 */

import { Segmented, Switch, Checkbox, Button, Popconfirm } from 'antd';
import type { UserSettings } from '@/shared/types';
import { useT } from '@/shared/i18n';
import { Field } from '../components/Field';
import { feedback } from '@/shared/ui/feedback';

interface DailyQuoteSettingsProps {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void | Promise<void>;
}

/**
 * 每日金句设置组件
 */
export function DailyQuoteSettings({ settings, updateSettings }: DailyQuoteSettingsProps) {
  const { t } = useT();

  /** 防 ESLint `no-misused-promises`：`updateSettings` 异步但表单回调需要 `void`。 */
  const handleSetting = (patch: Partial<UserSettings>) => {
    void updateSettings(patch);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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
