import { nanoid } from 'nanoid';
import { useEffect, useMemo, useState } from 'react';
import { Button, Input, Select } from 'antd';
import { Droplets, Check, Copy, Globe, Plus, RotateCcw, Search } from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useSettingsStore } from '@/store';
import type { HabitEntry } from '@/shared/types';
import { feedback } from '@/shared/ui/feedback';
import { useT } from '@/shared/i18n';
import { tokenizeJson, parseJsonErrorPosition, type JsonToken } from './json-highlighter';

// ── 极速搜索盒子 ────────────────────────────────────

const ENGINES = [
  { value: 'bing', label: 'Bing', url: 'https://www.bing.com/search?q=' },
  { value: 'google', label: 'Google', url: 'https://www.google.com/search?q=' },
  { value: 'baidu', label: '百度', url: 'https://www.baidu.com/s?wd=' },
  { value: 'duckduckgo', label: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
  { value: 'github', label: 'GitHub', url: 'https://github.com/search?q=' },
];

export function SearchBoxWidget() {
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
    <div className="dashboard-search-widget">
      <div className="dashboard-search-widget__head">
        <span className="dashboard-search-widget__label">快速搜索</span>
        <Select
          size="small"
          value={engine}
          onChange={setEngine}
          options={ENGINES.map((item) => ({ value: item.value, label: item.label }))}
          className="dashboard-search-widget__select"
        />
      </div>
      <div className="dashboard-search-widget__field">
        <Search size={ICON_SIZE.LARGE} className="dashboard-search-widget__icon" />
        <Input
          variant="borderless"
          className="dashboard-search-widget__input"
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
    <div className="dashboard-water-widget">
      <div className="dashboard-water-widget__hero">
        <Droplets size={ICON_SIZE.XLARGE} className="dashboard-water-widget__icon" />
        <div className="dashboard-water-widget__value">
          {current} / {goal} 杯
        </div>
      </div>
      <div className="dashboard-water-widget__copy">
        目标 {goal} 杯 · 建议每 {intervalMinutes} 分钟打卡一次
      </div>
      <div className="dashboard-water-widget__progress">
        <div
          className="dashboard-water-widget__progress-fill"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="dashboard-water-widget__actions">
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
    <div className="dashboard-habit-widget dashboard-widget-stack--tight">
      {items.length === 0 && (
        <div className="dashboard-habit-widget__empty">
          暂无习惯，先添加一个每天想坚持的小目标。
        </div>
      )}
      {items.slice(0, 5).map((habit) => {
        const done = habit.records.includes(today);
        const streak = computeHabitStreak(habit.records);
        return (
          <div
            key={habit.id}
            className={`dashboard-habit-item${done ? ' is-done' : ''}`}
            onClick={() => void toggle(habit)}
          >
            <span className="dashboard-habit-item__emoji">{habit.emoji ?? '⭐'}</span>
            <span className="dashboard-habit-item__main">
              <span className="dashboard-habit-item__name">{habit.name}</span>
              <span className="dashboard-habit-item__meta">
                连续 {streak} 天 · 累计 {habit.records.length}
              </span>
            </span>
            {done && <Check size={ICON_SIZE.MEDIUM} className="dashboard-habit-item__check" />}
            <Button
              type="text"
              size="small"
              danger
              className="dashboard-habit-item__remove"
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
      <div className="dashboard-habit-widget__actions">
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
  const { t } = useT();
  const [now, setNow] = useState(() => new Date().getTime());
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
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
    <div className="dashboard-timestamp-widget">
      <div className="dashboard-timestamp-widget__hero">
        <div className="dashboard-timestamp-widget__value">{nowSec}</div>
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
      <div className="dashboard-timestamp-widget__result">
        {parsed || '输入后自动转换'}
      </div>
    </div>
  );
}

// ── JSON 格式化 · v1.3 语法高亮 ──────────────────────

function getJsonTokenClass(type: JsonToken['type']): string {
  return `dashboard-json-token dashboard-json-token--${type}`;
}

export function JsonFormatterWidget() {
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

  return (
    <div className="dashboard-json-widget">
      <div className="dashboard-json-widget__toolbar">
        <Select
          size="small"
          value={indent}
          className="dashboard-json-widget__indent"
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
        <pre className="dashboard-json-widget__error">解析失败：{error}</pre>
      ) : (
        <pre aria-label="格式化结果" className="dashboard-json-widget__output">
          {tokens.length === 0
            ? '结果将显示在这里'
            : tokens.map((tk, idx) => (
                <span key={idx} className={getJsonTokenClass(tk.type)}>
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
    <div className={`dashboard-network-widget${online ? ' is-online' : ' is-offline'}`}>
      <div className="dashboard-network-widget__hero">
        <Globe size={ICON_SIZE.XLARGE} />
        <div className="dashboard-network-widget__status">{online ? '在线' : '离线'}</div>
      </div>
      <div className="dashboard-network-widget__meta">连接类型：{connType}</div>
      <div className="dashboard-network-widget__ua">
        User Agent：{navigator.userAgent.slice(0, 40)}…
      </div>
    </div>
  );
}
