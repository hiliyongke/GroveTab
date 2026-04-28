import { nanoid } from 'nanoid';
import { useEffect, useMemo, useState } from 'react';
import { Button, Input, Select, theme } from 'antd';
import { Droplets, Check, Copy, Globe, Plus, RotateCcw, Search } from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useSettingsStore } from '@/store';
import type { HabitEntry } from '@/shared/types';
import { feedback } from '@/shared/ui/feedback';
import { useT } from '@/shared/i18n';

// ── 极速搜索盒子 ────────────────────────────────────

const ENGINES = [
  { value: 'bing', label: 'Bing', url: 'https://www.bing.com/search?q=' },
  { value: 'google', label: 'Google', url: 'https://www.google.com/search?q=' },
  { value: 'baidu', label: '百度', url: 'https://www.baidu.com/s?wd=' },
  { value: 'duckduckgo', label: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
  { value: 'github', label: 'GitHub', url: 'https://github.com/search?q=' },
];

export function SearchBoxWidget() {
  const { token } = theme.useToken();
  const defaultEngine = useSettingsStore((s) => s.settings.searchDefaultEngine ?? 'bing');
  const [engine, setEngine] = useState(() =>
    ENGINES.some((item) => item.value === defaultEngine) ? defaultEngine : 'bing',
  );
  const [query, setQuery] = useState('');

  const submit = () => {
    const target = ENGINES.find((e) => e.value === engine);
    if (target === undefined || query.trim() === '') return;
    window.open(
      `${target.url}${encodeURIComponent(query.trim())}`,
      '_blank',
      'noopener,noreferrer',
    );
    setQuery('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
      >
        <span style={{ fontSize: 12, color: token.colorTextTertiary }}>快速搜索</span>
        <Select
          size="small"
          value={engine}
          onChange={setEngine}
          options={ENGINES.map((item) => ({ value: item.value, label: item.label }))}
          style={{ minWidth: 118 }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          borderRadius: token.borderRadiusLG,
          background: token.colorFillQuaternary,
          border: `1px solid ${token.colorBorderSecondary}`,
          marginTop: 'auto',
        }}
      >
        <Search size={ICON_SIZE.LARGE} color={token.colorTextTertiary} />
        <Input
          variant="borderless"
          style={{ flex: 1, minWidth: 0 }}
          placeholder="关键词，回车开搜"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onPressEnter={submit}
        />
        <Button type="primary" size="small" onClick={submit} disabled={query.trim() === ''}>
          搜索
        </Button>
      </div>
    </div>
  );
}

// ── 喝水提醒 ────────────────────────────────────────

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function computeHabitStreak(records: string[], anchor = new Date()): number {
  const recordSet = new Set(records);
  let streak = 0;
  const cursor = new Date(anchor);
  cursor.setHours(0, 0, 0, 0);

  while (
    recordSet.has(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`,
    )
  ) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function WaterReminderWidget() {
  const { token } = theme.useToken();
  const conf = useSettingsStore((s) => s.settings.waterReminder);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const goal = conf?.goalCups ?? 8;
  const intervalMinutes = conf?.intervalMinutes ?? 60;
  const today = todayKey();
  const current = conf?.lastDate === today ? (conf?.currentCups ?? 0) : 0;

  const add = async (delta: number) => {
    const next = Math.max(0, Math.min(goal * 2, current + delta));
    await updateSettings({
      waterReminder: { ...(conf ?? {}), lastDate: today, currentCups: next },
    });
  };

  const percent = Math.min(100, (current / goal) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Droplets size={ICON_SIZE.XLARGE} color={token.colorPrimary} />
        <div style={{ fontSize: 22, fontWeight: 800 }}>
          {current} / {goal} 杯
        </div>
      </div>
      <div style={{ fontSize: 12, color: token.colorTextTertiary }}>
        目标 {goal} 杯 · 建议每 {intervalMinutes} 分钟打卡一次
      </div>
      <div
        style={{
          height: 8,
          background: token.colorFillTertiary,
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${token.colorPrimary}, #4fc3f7)`,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
        <Button size="small" type="primary" onClick={() => void add(1)}>
          +1 杯
        </Button>
        <Button size="small" onClick={() => void add(-1)}>
          -1 杯
        </Button>
        <Button
          size="small"
          icon={<RotateCcw size={ICON_SIZE.SMALL} />}
          onClick={() =>
            void updateSettings({
              waterReminder: { ...(conf ?? {}), lastDate: today, currentCups: 0 },
            })
          }
        />
      </div>
    </div>
  );
}

// ── 习惯打卡 ────────────────────────────────────────

export function HabitTrackerWidget() {
  const { token } = theme.useToken();
  const conf = useSettingsStore((s) => s.settings.habitTracker);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const items = conf?.items ?? [];
  const today = todayKey();
  const [draft, setDraft] = useState('');

  const toggle = async (habit: HabitEntry) => {
    const has = habit.records.includes(today);
    const nextRecords = has ? habit.records.filter((d) => d !== today) : [...habit.records, today];
    const nextItems = items.map((h) => (h.id === habit.id ? { ...h, records: nextRecords } : h));
    await updateSettings({ habitTracker: { ...(conf ?? {}), items: nextItems } });
  };

  const add = async () => {
    if (!draft.trim()) return;
    const nextItems = [
      ...items,
      { id: `habit-${nanoid(8)}`, name: draft.trim(), emoji: '⭐', records: [] },
    ];
    await updateSettings({ habitTracker: { ...(conf ?? {}), items: nextItems } });
    setDraft('');
  };

  const remove = async (id: string) => {
    await updateSettings({
      habitTracker: { ...(conf ?? {}), items: items.filter((h) => h.id !== id) },
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      {items.length === 0 && (
        <div style={{ fontSize: 12, color: token.colorTextTertiary, padding: '8px 2px' }}>
          暂无习惯，先添加一个每天想坚持的小目标。
        </div>
      )}
      {items.slice(0, 5).map((habit) => {
        const done = habit.records.includes(today);
        const streak = computeHabitStreak(habit.records);
        return (
          <div
            key={habit.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              borderRadius: token.borderRadiusLG,
              background: done ? `${token.colorSuccess}1a` : token.colorFillQuaternary,
              border: `1px solid ${done ? token.colorSuccess : token.colorBorderSecondary}`,
              cursor: 'pointer',
            }}
            onClick={() => void toggle(habit)}
          >
            <span style={{ fontSize: 16 }}>{habit.emoji ?? '⭐'}</span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{habit.name}</span>
            <span style={{ fontSize: 11, color: token.colorTextTertiary }}>
              连续 {streak} 天 · 累计 {habit.records.length}
            </span>
            {done && <Check size={ICON_SIZE.MEDIUM} color={token.colorSuccess} />}
            <Button
              type="text"
              size="small"
              danger
              style={{ padding: '0 4px' }}
              onClick={(e) => {
                e.stopPropagation();
                void remove(habit.id);
              }}
            >
              ✕
            </Button>
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
        <Input
          size="small"
          placeholder="新增习惯"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onPressEnter={() => void add()}
        />
        <Button
          size="small"
          type="primary"
          icon={<Plus size={ICON_SIZE.SMALL} />}
          onClick={() => void add()}
        />
      </div>
    </div>
  );
}

// ── 时间戳工具 ──────────────────────────────────────

export function TimestampToolWidget() {
  const { token } = theme.useToken();
  const { t } = useT();
  const [now, setNow] = useState(() => new Date().getTime());
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const nowSec = Math.floor(now / 1000);

  const parsed = useMemo(() => {
    if (!draft.trim()) return '';
    const value = Number(draft.trim());
    if (Number.isFinite(value)) {
      const ms = value < 1e12 ? value * 1000 : value;
      try {
        return new Date(ms).toLocaleString('zh-CN');
      } catch {
        return '格式无效';
      }
    }
    const date = new Date(draft.trim());
    if (!Number.isNaN(date.getTime())) {
      return `${Math.floor(date.getTime() / 1000)} (秒)`;
    }
    return '格式无效';
  }, [draft]);

  const copy = (text: string | number) => {
    void navigator.clipboard?.writeText(String(text));
    feedback.success(t('dashboard.copied'));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, fontFamily: 'monospace', fontSize: 14, color: token.colorText }}>
          {nowSec}
        </div>
        <Button size="small" icon={<Copy size={ICON_SIZE.SMALL} />} onClick={() => copy(nowSec)}>
          秒
        </Button>
        <Button size="small" icon={<Copy size={ICON_SIZE.SMALL} />} onClick={() => copy(now)}>
          毫秒
        </Button>
      </div>
      <Input
        size="small"
        placeholder="粘贴时间戳或日期字符串"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div
        style={{
          padding: '8px 10px',
          borderRadius: 8,
          background: token.colorFillQuaternary,
          fontSize: 12,
          color: token.colorTextSecondary,
          minHeight: 32,
          fontFamily: 'monospace',
        }}
      >
        {parsed || '输入后自动转换'}
      </div>
    </div>
  );
}

// ── JSON 格式化 · v1.3 语法高亮 ──────────────────────
// 纯函数抽至 ./json-highlighter.ts，便于独立单测

import { tokenizeJson, parseJsonErrorPosition, type JsonToken } from './json-highlighter';

export function JsonFormatterWidget() {
  const { token } = theme.useToken();
  const { t } = useT();
  const [input, setInput] = useState('');
  const [indent, setIndent] = useState<number>(2);

  const { output, error, tokens } = useMemo(() => {
    if (!input.trim()) return { output: '', error: null, tokens: [] as JsonToken[] };
    try {
      const formatted = JSON.stringify(JSON.parse(input), null, indent);
      return { output: formatted, error: null, tokens: tokenizeJson(formatted) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const pos = parseJsonErrorPosition(input, msg);
      const enriched = pos ? `${msg}\n（位置：第 ${pos.line} 行，第 ${pos.col} 列）` : msg;
      return { output: '', error: enriched, tokens: [] as JsonToken[] };
    }
  }, [input, indent]);

  // 颜色：沿用主题变量，保证深浅皆可读
  const colorMap: Record<JsonToken['type'], string> = {
    key: token.colorInfoText,
    string: token.colorSuccessText,
    number: token.colorWarningText,
    boolean: token.colorError,
    null: token.colorTextTertiary,
    punct: token.colorText,
    ws: token.colorText,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <Select
          size="small"
          value={indent}
          style={{ width: 100 }}
          options={[
            { value: 2, label: '缩进 2' },
            { value: 4, label: '缩进 4' },
            { value: 0, label: '压缩' },
          ]}
          onChange={(value) => setIndent(value)}
        />
        <Button
          size="small"
          icon={<Copy size={ICON_SIZE.SMALL} />}
          disabled={output === ''}
          onClick={() => {
            void navigator.clipboard?.writeText(output);
            feedback.success(t('dashboard.copiedResult'));
          }}
        >
          复制结果
        </Button>
      </div>
      <Input.TextArea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="粘贴 JSON 字符串"
        autoSize={{ minRows: 3, maxRows: 5 }}
      />
      {error !== null ? (
        <pre
          style={{
            flex: 1,
            margin: 0,
            padding: 10,
            background: token.colorErrorBg,
            color: token.colorErrorText,
            borderRadius: 8,
            fontSize: 11,
            fontFamily: 'monospace',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          解析失败：{error}
        </pre>
      ) : (
        <pre
          aria-label="格式化结果"
          style={{
            flex: 1,
            margin: 0,
            padding: 10,
            background: token.colorFillQuaternary,
            borderRadius: 8,
            fontSize: 11,
            fontFamily: 'monospace',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {tokens.length === 0
            ? '结果将显示在这里'
            : tokens.map((tk, idx) => (
                <span key={idx} style={{ color: colorMap[tk.type] }}>
                  {tk.text}
                </span>
              ))}
        </pre>
      )}
    </div>
  );
}

// ── 网络信息 ────────────────────────────────────────

interface NavigatorConnection extends EventTarget {
  effectiveType?: string;
}

function getNavigatorConnection(): NavigatorConnection | undefined {
  return (navigator as Navigator & { connection?: NavigatorConnection }).connection;
}

export function NetworkInfoWidget() {
  const { token } = theme.useToken();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [connType, setConnType] = useState<string>(
    () => getNavigatorConnection()?.effectiveType ?? 'unknown',
  );

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const conn = getNavigatorConnection();
    if (conn !== undefined) {
      const onChange = () => setConnType(conn.effectiveType ?? 'unknown');
      conn.addEventListener('change', onChange);
      return () => {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
        conn.removeEventListener('change', onChange);
      };
    }
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 10,
        height: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Globe size={ICON_SIZE.XLARGE} color={online ? token.colorSuccess : token.colorError} />
        <div style={{ fontSize: 18, fontWeight: 800 }}>{online ? '在线' : '离线'}</div>
      </div>
      <div style={{ fontSize: 12, color: token.colorTextTertiary }}>连接类型：{connType}</div>
      <div style={{ fontSize: 11, color: token.colorTextTertiary }}>
        User Agent：{navigator.userAgent.slice(0, 40)}…
      </div>
    </div>
  );
}
