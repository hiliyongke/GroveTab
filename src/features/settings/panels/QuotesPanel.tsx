import { useMemo, useState } from 'react';
import { Button, Checkbox, Input, Switch } from 'antd';
import { Upload, Trash2 } from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useSettingsStore } from '@/store';
import { useT } from '@/shared/i18n';
import { Field } from '../components/Field';
import type { CustomQuoteEntry, DashboardQuoteCategory } from '@/shared/types';
import { feedback } from '@/shared/ui/feedback';
import { BRAND } from '@/shared/config/brand';

function parseTextQuotes(raw: string, t: (key: string) => string): CustomQuoteEntry[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [text, source = t('quotes.customSource')] = line.split('——').map((item) => item.trim());
      return { id: `custom-${Date.now()}-${index}`, text, source, category: 'custom' as const };
    })
    .filter((item) => item.text.length > 0);
}

function parseJsonQuotes(raw: string, t: (key: string) => string): CustomQuoteEntry[] {
  const parsed = JSON.parse(raw) as Array<{ text?: string; source?: string }>;
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item, index) => ({
      id: `custom-json-${Date.now()}-${index}`,
      text: item.text?.trim() ?? '',
      source: item.source?.trim() || t('quotes.customSource'),
      category: 'custom' as const,
    }))
    .filter((item) => item.text.length > 0);
}

export function QuotesPanel() {
  const { t } = useT();
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const conf = settings.dailyQuote;
  const [textDraft, setTextDraft] = useState('');
  const [jsonDraft, setJsonDraft] = useState('');

  const customQuotes = conf?.customQuotes ?? [];
  const categories = conf?.categories ?? ['aphorism', 'renmin', 'poetry', 'essay', 'custom'];

  const sortedPreview = useMemo(() => customQuotes.slice(-5).reverse(), [customQuotes]);

  const CATEGORY_OPTIONS: Array<{ value: DashboardQuoteCategory; label: string }> = [
    { value: 'aphorism', label: t('quotes.catAphorism') },
    { value: 'renmin', label: t('quotes.catRenmin') },
    { value: 'poetry', label: t('quotes.catPoetry') },
    { value: 'essay', label: t('quotes.catEssay') },
    { value: 'custom', label: t('quotes.catCustom') },
  ];

  const appendCustomQuotes = async (items: CustomQuoteEntry[]) => {
    if (items.length === 0) {
      feedback.warning(t('quotes.noQuotesToImport'));
      return;
    }
    await updateSettings({
      dailyQuote: {
        ...(conf ?? {}),
        enabled: true,
        categories: Array.from(new Set([...(categories ?? []), 'custom'])) as DashboardQuoteCategory[],
        customQuotes: [...customQuotes, ...items],
      },
    });
    feedback.success(t('quotes.importedCount', { n: items.length }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Field label={t('quotes.dailyQuote')} hint={t('quotes.dailyQuoteHint')}>
        <Switch
          checked={conf?.enabled !== false}
          onChange={(value) => void updateSettings({ dailyQuote: { ...(conf ?? {}), enabled: value } })}
        />
      </Field>

      <Field label={t('quotes.categories')} hint={t('quotes.categoriesHint')}>
        <Checkbox.Group
          value={categories}
          options={CATEGORY_OPTIONS}
          onChange={(values) => {
            if (values.length === 0) return;
            void updateSettings({
              dailyQuote: {
                ...(conf ?? {}),
                categories: values as DashboardQuoteCategory[],
              },
            });
          }}
        />
      </Field>

      <Field label={t('quotes.textImport')} hint={t('quotes.textImportHint')}>
        <Input.TextArea
          autoSize={{ minRows: 5, maxRows: 8 }}
          value={textDraft}
          onChange={(e) => setTextDraft(e.target.value)}
          placeholder={`所有的努力都算数 —— ${BRAND.name}\n再坚持一下，好运会来的`}
        />
        <Button icon={<Upload size={ICON_SIZE.MEDIUM} />} style={{ marginTop: 8 }} onClick={() => void appendCustomQuotes(parseTextQuotes(textDraft, t))}>
          {t('quotes.textImportBtn')}
        </Button>
      </Field>

      <Field
        label={t('quotes.jsonImport')}
        hint={t('quotes.jsonImportHint')}
      >
        <Input.TextArea
          autoSize={{ minRows: 5, maxRows: 8 }}
          value={jsonDraft}
          onChange={(e) => setJsonDraft(e.target.value)}
          placeholder={`[{"text":"所有的努力都算数","source":"${BRAND.name}"}]`}
        />
        <Button
          icon={<Upload size={ICON_SIZE.MEDIUM} />}
          style={{ marginTop: 8 }}
          onClick={() => {
            try {
              void appendCustomQuotes(parseJsonQuotes(jsonDraft, t));
            } catch {
              feedback.error(t('quotes.jsonParseError'));
            }
          }}
        >
          {t('quotes.jsonImportBtn')}
        </Button>
      </Field>

      <Field label={t('quotes.preview')} hint={t('quotes.previewHint')}>
        {sortedPreview.length === 0 ? (
          <div style={{ fontSize: 12, color: '#999' }}>{t('quotes.noCustomQuotes')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sortedPreview.map((quote) => (
              <div
                key={quote.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: '#fafafa',
                  border: '1px solid #f0f0f0',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>{quote.text}</div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>—— {quote.source}</div>
              </div>
            ))}
          </div>
        )}
      </Field>

      <Field label={t('quotes.clearCustom')} hint={t('quotes.clearCustomHint')}>
        <Button
          danger
          icon={<Trash2 size={ICON_SIZE.MEDIUM} />}
          onClick={() => {
            void updateSettings({
              dailyQuote: {
                ...(conf ?? {}),
                customQuotes: [],
              },
            });
            feedback.success(t('quotes.clearCustomDone'));
          }}
        >
          {t('quotes.clearCustom')}
        </Button>
      </Field>
    </div>
  );
}
