import { useMemo, useState } from 'react';
import { Button, Checkbox, Input, Switch } from 'antd';
import { Upload, Trash2 } from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useSettingsStore } from '@/store';
import { Field } from '../components/Field';
import type { CustomQuoteEntry, DashboardQuoteCategory } from '@/shared/types';
import { feedback } from '@/shared/ui/feedback';

const CATEGORY_OPTIONS: Array<{ value: DashboardQuoteCategory; label: string }> = [
  { value: 'aphorism', label: '名言警句' },
  { value: 'renmin', label: '人民日报夜读' },
  { value: 'poetry', label: '古诗词' },
  { value: 'essay', label: '散文 / 语录' },
  { value: 'custom', label: '自定义' },
];

function parseTextQuotes(raw: string): CustomQuoteEntry[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [text, source = '自定义导入'] = line.split('——').map((item) => item.trim());
      return { id: `custom-${Date.now()}-${index}`, text, source, category: 'custom' as const };
    })
    .filter((item) => item.text.length > 0);
}

function parseJsonQuotes(raw: string): CustomQuoteEntry[] {
  const parsed = JSON.parse(raw) as Array<{ text?: string; source?: string }>;
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item, index) => ({
      id: `custom-json-${Date.now()}-${index}`,
      text: item.text?.trim() ?? '',
      source: item.source?.trim() || '自定义导入',
      category: 'custom' as const,
    }))
    .filter((item) => item.text.length > 0);
}

export function QuotesPanel() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const conf = settings.dailyQuote;
  const [textDraft, setTextDraft] = useState('');
  const [jsonDraft, setJsonDraft] = useState('');

  const customQuotes = conf?.customQuotes ?? [];
  const categories = conf?.categories ?? ['aphorism', 'renmin', 'poetry', 'essay', 'custom'];

  const sortedPreview = useMemo(() => customQuotes.slice(-5).reverse(), [customQuotes]);

  const appendCustomQuotes = async (items: CustomQuoteEntry[]) => {
    if (items.length === 0) {
      feedback.warning('没有解析到可导入的金句');
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
    feedback.success(`已导入 ${items.length} 条自定义金句`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Field label="每日金句" hint="金句现在也是顶部工作台中的一个小组件，可独立开关与配置。">
        <Switch
          checked={conf?.enabled !== false}
          onChange={(value) => void updateSettings({ dailyQuote: { ...(conf ?? {}), enabled: value } })}
        />
      </Field>

      <Field label="参与抽取分类" hint="你可以只保留自己喜欢的类别，自定义金句会归入 custom 分类。">
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

      <Field label="一行一句导入" hint="支持“内容 —— 作者”格式；未填写作者时会自动标记为自定义导入。">
        <Input.TextArea
          autoSize={{ minRows: 5, maxRows: 8 }}
          value={textDraft}
          onChange={(e) => setTextDraft(e.target.value)}
          placeholder={'所有的努力都算数 —— GroveTab\n再坚持一下，好运会来的'}
        />
        <Button icon={<Upload size={ICON_SIZE.MEDIUM} />} style={{ marginTop: 8 }} onClick={() => void appendCustomQuotes(parseTextQuotes(textDraft))}>
          从文本导入
        </Button>
      </Field>

      <Field
        label="JSON 导入"
        hint='格式示例：[{"text":"所有的努力都算数","source":"GroveTab"}]'
      >
        <Input.TextArea
          autoSize={{ minRows: 5, maxRows: 8 }}
          value={jsonDraft}
          onChange={(e) => setJsonDraft(e.target.value)}
          placeholder='[{"text":"所有的努力都算数","source":"GroveTab"}]'
        />
        <Button
          icon={<Upload size={ICON_SIZE.MEDIUM} />}
          style={{ marginTop: 8 }}
          onClick={() => {
            try {
              void appendCustomQuotes(parseJsonQuotes(jsonDraft));
            } catch {
              feedback.error('JSON 格式不正确');
            }
          }}
        >
          从 JSON 导入
        </Button>
      </Field>

      <Field label="自定义金句预览" hint="仅展示最近导入的 5 条；完整数据会随设置一起保存和导出。">
        {sortedPreview.length === 0 ? (
          <div style={{ fontSize: 12, color: '#999' }}>还没有自定义金句</div>
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

      <Field label="清空自定义金句" hint="只删除你手工导入的 custom 分类，不影响内置 200+ 条金句。">
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
            feedback.success('自定义金句已清空');
          }}
        >
          清空自定义金句
        </Button>
      </Field>
    </div>
  );
}