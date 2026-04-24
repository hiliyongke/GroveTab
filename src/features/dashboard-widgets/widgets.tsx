import type { InputRef } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Empty, Input, Popconfirm, Segmented, Tabs, theme, Tooltip } from 'antd';
import { Plus, TimerReset, CheckCircle2, Circle, StickyNote, Play, Pause, GripVertical, Trash2 } from 'lucide-react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ClockWidget } from '@/features/hero-widgets/ClockWidget';
import { WeatherWidget } from '@/features/hero-widgets/WeatherWidget';
import { CalendarWidget } from '@/features/hero-widgets/CalendarWidget';
import { DailyQuote } from '@/features/quotes/DailyQuote';
import { useSettingsStore } from '@/store';
import type {
  DashboardWidgetLayoutItem,
  DashboardWidgetType,
  SpeedDialLink,
  StickyNoteEntry,
  TodoEntry,
} from '@/shared/types';
import { feedback } from '@/shared/ui/feedback';
import { getData, setData } from '@/repositories/storage-repo';
import {
  DEFAULT_POMODORO_CONFIG,
  computeRemaining,
  createInitialState,
  formatRemaining,
  pomodoroReducer,
  reviveState,
  type PomodoroAction,
  type PomodoroConfig,
  type PomodoroMode,
  type PomodoroState,
} from './pomodoro-engine';
import { buildFaviconUrl, formatDaysLeft, formatTimeLeftTo, getHostnameLabel, getInitials } from './utils';
import {
  SearchBoxWidget,
  WaterReminderWidget,
  HabitTrackerWidget,
  TimestampToolWidget,
  JsonFormatterWidget,
  NetworkInfoWidget,
} from './extra-widgets';

function MiniEmpty({ text }: { text: string }) {
  return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={text} style={{ margin: 0, padding: '12px 0' }} />;
}

/** SpeedDial Tile —— Sortable 版：支持点击打开 URL + 拖拽重排序（v1.3） */
function SortableSpeedDialTile({
  link,
  showLabels,
  openInNewTab,
  onRemove,
}: {
  link: SpeedDialLink;
  showLabels: boolean;
  openInNewTab: boolean;
  onRemove: () => void;
}) {
  const { token } = theme.useToken();
  const [imageFailed, setImageFailed] = useState(false);
  const [hover, setHover] = useState(false);
  const iconUrl = buildFaviconUrl(link.url);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: link.id,
  });

  const handleClick = (e: React.MouseEvent) => {
    // 拖拽激活时 @dnd-kit 会阻止 click；这里仅作保险
    if (isDragging) {
      e.preventDefault();
      return;
    }
    if (!openInNewTab) {
      window.location.href = link.url;
      return;
    }
    window.open(link.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        position: 'relative',
        opacity: isDragging ? 0.4 : 1,
        transform: CSS.Translate.toString(transform),
        transition,
        touchAction: 'none',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={0}
        aria-label={`${link.title}（拖拽重排或按 Enter 打开）`}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick(e as unknown as React.MouseEvent);
          }
        }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          padding: 10,
          borderRadius: token.borderRadiusLG,
          background: token.colorFillQuaternary,
          border: `1px solid ${token.colorBorderSecondary}`,
          color: token.colorText,
          cursor: isDragging ? 'grabbing' : 'pointer',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            background: link.color ?? token.colorPrimaryBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            color: '#fff',
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          {link.emoji ? (
            <span>{link.emoji}</span>
          ) : iconUrl && !imageFailed ? (
            <img src={iconUrl} alt="" width={22} height={22} onError={() => setImageFailed(true)} />
          ) : (
            <span>{getInitials(link.title)}</span>
          )}
        </div>
        {showLabels && (
          <div style={{ textAlign: 'center', minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 92,
              }}
            >
              {link.title}
            </div>
            <div
              style={{
                fontSize: 11,
                color: token.colorTextTertiary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 92,
              }}
            >
              {getHostnameLabel(link.url)}
            </div>
          </div>
        )}
      </div>

      {/* hover 时右上角暴露拖拽把手 + 删除按钮 */}
      {hover && !isDragging && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            display: 'flex',
            gap: 2,
            background: 'rgba(255,255,255,0.95)',
            borderRadius: 8,
            padding: 2,
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          }}
        >
          <Tooltip title="按住拖拽排序">
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 4px',
                color: token.colorTextTertiary,
                cursor: 'grab',
              }}
              aria-hidden="true"
            >
              <GripVertical size={11} />
            </span>
          </Tooltip>
          <Button
            type="text"
            size="small"
            danger
            aria-label={`删除 ${link.title}`}
            style={{ padding: '0 4px', height: 20, fontSize: 10 }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }}
          >
            ✕
          </Button>
        </div>
      )}
    </div>
  );
}

export function SpeedDialWidget() {
  const settings = useSettingsStore((s) => s.settings.speedDial);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const groups = settings?.groups ?? [];
  const activeGroupId = settings?.activeGroupId ?? groups[0]?.id;
  const activeGroup = groups.find((item) => item.id === activeGroupId) ?? groups[0];
  const [draftTitle, setDraftTitle] = useState('');
  const [draftUrl, setDraftUrl] = useState('');

  // 激活距离 6px，避免点击误触发拖拽（与 Kanban 一致）
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const addLink = async () => {
    if (!activeGroup || !draftUrl.trim()) return;
    let finalUrl = draftUrl.trim();
    if (!/^https?:\/\//i.test(finalUrl)) finalUrl = `https://${finalUrl}`;
    const title = draftTitle.trim() || getHostnameLabel(finalUrl);
    const nextGroups = groups.map((group) =>
      group.id === activeGroup.id
        ? {
            ...group,
            links: [...group.links, { id: `link-${Date.now()}`, title, url: finalUrl }],
          }
        : group,
    );
    await updateSettings({ speedDial: { ...(settings ?? {}), groups: nextGroups } });
    setDraftTitle('');
    setDraftUrl('');
    feedback.success('已添加');
  };

  const removeLink = async (id: string) => {
    if (!activeGroup) return;
    const nextGroups = groups.map((group) =>
      group.id === activeGroup.id ? { ...group, links: group.links.filter((l) => l.id !== id) } : group,
    );
    await updateSettings({ speedDial: { ...(settings ?? {}), groups: nextGroups } });
  };

  const onDragEnd = async (event: DragEndEvent) => {
    if (!activeGroup) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = activeGroup.links.findIndex((l) => l.id === active.id);
    const toIndex = activeGroup.links.findIndex((l) => l.id === over.id);
    if (fromIndex < 0 || toIndex < 0) return;
    const nextLinks = arrayMove(activeGroup.links, fromIndex, toIndex);
    const nextGroups = groups.map((group) =>
      group.id === activeGroup.id ? { ...group, links: nextLinks } : group,
    );
    await updateSettings({ speedDial: { ...(settings ?? {}), groups: nextGroups } });
  };

  if (!activeGroup) return <MiniEmpty text="暂无快捷网站分组" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <Tabs
        size="small"
        activeKey={activeGroup.id}
        onChange={(value) => void updateSettings({ speedDial: { ...(settings ?? {}), activeGroupId: value } })}
        items={groups.map((group) => ({ key: group.id, label: group.name }))}
      />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void onDragEnd(e)}>
        <SortableContext items={activeGroup.links.map((l) => l.id)} strategy={rectSortingStrategy}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: 10 }}>
            {activeGroup.links.map((link) => (
              <SortableSpeedDialTile
                key={link.id}
                link={link}
                showLabels={settings?.showLabels !== false}
                openInNewTab={settings?.openInNewTab !== false}
                onRemove={() => void removeLink(link.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr auto', gap: 8, marginTop: 'auto' }}>
        <Input size="small" placeholder="名称（可选）" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} />
        <Input
          size="small"
          placeholder="粘贴网址即可"
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          onPressEnter={() => void addLink()}
        />
        <Button size="small" type="primary" icon={<Plus size={14} />} onClick={() => void addLink()} aria-label="添加快捷网站" />
      </div>
    </div>
  );
}

export function CountdownWidget() {
  const countdowns = useSettingsStore((s) => s.settings.countdowns);
  const items = countdowns?.items ?? [];
  const { token } = theme.useToken();

  if (items.length === 0) return <MiniEmpty text="暂无倒计时" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.slice(0, 4).map((item) => {
        const info = formatDaysLeft(item.targetDate);
        return (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderRadius: token.borderRadiusLG,
              background: token.colorFillQuaternary,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{item.emoji ? `${item.emoji} ${item.title}` : item.title}</div>
              <div style={{ fontSize: 11, color: token.colorTextTertiary }}>{item.targetDate}</div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: info.overdue ? token.colorError : token.colorPrimary }}>
              {info.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function WorkCountdownWidget() {
  const conf = useSettingsStore((s) => s.settings.workCountdown);
  const { token } = theme.useToken();
  const info = formatTimeLeftTo(conf?.workdayEnd ?? '18:30');
  const finishedLabel = conf?.offLabel?.trim() || '今天收工啦';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', gap: 10 }}>
      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', color: info.finished ? token.colorSuccess : token.colorPrimary }}>
        {info.finished ? finishedLabel : info.label}
      </div>
      <div style={{ fontSize: 12, color: token.colorTextTertiary }}>目标下班时间：{conf?.workdayEnd ?? '18:30'}</div>
    </div>
  );
}

// ── Pomodoro 持久化 ──────────────────────────────────
const POMODORO_STORAGE_KEY = 'canopy_pomodoro_state' as const;

/** 把存储里的原始对象做最小字段校验（宽松迁移，坏数据直接丢弃回落默认） */
function sanitizeStoredPomodoroState(raw: unknown): PomodoroState | null {
  if (raw === null || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const mode = r.mode === 'focus' || r.mode === 'short' || r.mode === 'long' ? r.mode : 'focus';
  return {
    mode,
    elapsedMs: typeof r.elapsedMs === 'number' && r.elapsedMs >= 0 ? r.elapsedMs : 0,
    startedAt: typeof r.startedAt === 'number' ? r.startedAt : undefined,
    running: r.running === true,
    completedFocus: typeof r.completedFocus === 'number' ? r.completedFocus : 0,
    todayFocus: typeof r.todayFocus === 'number' ? r.todayFocus : 0,
    todayDate: typeof r.todayDate === 'string' ? r.todayDate : '',
  };
}

/** 请求浏览器通知权限 —— 仅在用户主动触发（点击开始时）调用一次 */
async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/** 用 WebAudio 发一个轻柔的提示音（不引入新资源） */
function playBeep() {
  try {
    const Ctor = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Ctor) return;
    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.55);
    osc.onended = () => { void ctx.close(); };
  } catch {
    /* 用户未曾交互时 AudioContext 可能抛错，静默忽略 */
  }
}

const MODE_LABEL: Record<PomodoroMode, string> = {
  focus: '专注冲刺',
  short: '短暂休息',
  long: '长休恢复',
};

export function PomodoroWidget() {
  const conf = useSettingsStore((s) => s.settings.pomodoro);
  const { token } = theme.useToken();

  // 配置从 settings 计算，变动立刻生效
  const config = useMemo<PomodoroConfig>(() => ({
    focusMinutes: conf?.focusMinutes ?? DEFAULT_POMODORO_CONFIG.focusMinutes,
    shortBreakMinutes: conf?.shortBreakMinutes ?? DEFAULT_POMODORO_CONFIG.shortBreakMinutes,
    longBreakMinutes: conf?.longBreakMinutes ?? DEFAULT_POMODORO_CONFIG.longBreakMinutes,
  }), [conf?.focusMinutes, conf?.shortBreakMinutes, conf?.longBreakMinutes]);

  const configRef = useRef(config);
  configRef.current = config;

  // 直接用 useState 托管完整 PomodoroState —— 首屏给默认值，
  // useEffect 里异步从 storage 读取后再 setState 覆盖
  const [state, setState] = useState<PomodoroState>(() => createInitialState('focus'));

  /** 将 action 应用到当前 state 并落盘 */
  const dispatch = (action: PomodoroAction) => {
    setState((prev) => pomodoroReducer(prev, action, configRef.current));
  };

  // 首屏从存储恢复（仅一次）
  const revivedRef = useRef(false);
  useEffect(() => {
    if (revivedRef.current) return;
    revivedRef.current = true;
    void getData<PomodoroState>(POMODORO_STORAGE_KEY).then((raw) => {
      const snap = sanitizeStoredPomodoroState(raw);
      if (!snap) return;
      setState(reviveState(snap, configRef.current));
    });
  }, []);

  // 每秒刷新 UI（仅运行中）
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!state.running) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [state.running]);

  // 到期自动切换 —— 检查 computeRemaining 是否 ≤ 0
  const completedOnceRef = useRef(false);
  useEffect(() => {
    if (!state.running) {
      completedOnceRef.current = false;
      return;
    }
    const remaining = computeRemaining(state, config);
    if (remaining <= 0 && !completedOnceRef.current) {
      completedOnceRef.current = true;
      const finishedMode = state.mode;
      const msg =
        finishedMode === 'focus' ? '专注结束，稍作休息 🌿' : '休息结束，回到专注吧 ⚡';
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try { new Notification('GroveTab · 番茄钟', { body: msg }); } catch { /* ignore */ }
      } else {
        feedback.info(msg);
      }
      playBeep();
      dispatch({ type: 'complete', config });
    }
  }, [state, config]);

  // 持久化 —— state 变动就回写（首次恢复前不写，避免抖掉默认值）
  const firstWriteRef = useRef(true);
  useEffect(() => {
    if (firstWriteRef.current) {
      firstWriteRef.current = false;
      return;
    }
    void setData(POMODORO_STORAGE_KEY, state).catch(() => { /* 失败忽略 */ });
  }, [state]);

  // 跨日检查：每分钟一次
  useEffect(() => {
    const id = window.setInterval(() => dispatch({ type: 'roll-date' }), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const handleToggle = async () => {
    if (state.running) {
      dispatch({ type: 'pause' });
    } else {
      await ensureNotificationPermission();
      dispatch({ type: 'start' });
    }
  };

  const handleReset = () => dispatch({ type: 'reset', mode: state.mode });
  const handleSwitch = (m: PomodoroMode) => dispatch({ type: 'switch', mode: m });

  const remaining = computeRemaining(state, config);
  const { minutes, seconds } = formatRemaining(remaining);
  const totalMinutes =
    state.mode === 'focus'
      ? config.focusMinutes
      : state.mode === 'short'
        ? config.shortBreakMinutes
        : config.longBreakMinutes;
  const totalDuration = Math.max(1, totalMinutes) * 60 * 1000;
  const progress = totalDuration > 0 ? 1 - remaining / totalDuration : 0;

  const accentColor =
    state.mode === 'focus'
      ? token.colorPrimary
      : state.mode === 'short'
        ? token.colorSuccess
        : token.colorWarning;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <Segmented
        block
        size="small"
        value={state.mode}
        onChange={(value) => handleSwitch(value as PomodoroMode)}
        options={[
          { value: 'focus', label: '专注' },
          { value: 'short', label: '短休' },
          { value: 'long', label: '长休' },
        ]}
      />
      <div
        role="timer"
        aria-live="polite"
        aria-label={`${MODE_LABEL[state.mode]} 剩余 ${minutes} 分 ${seconds} 秒`}
        style={{
          fontSize: 42,
          fontWeight: 800,
          letterSpacing: '-0.04em',
          color: token.colorText,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {minutes}:{seconds}
      </div>
      <div style={{ height: 4, background: token.colorFillQuaternary, borderRadius: 999, overflow: 'hidden' }}>
        <div
          style={{
            width: `${Math.round(progress * 100)}%`,
            height: '100%',
            background: accentColor,
            transition: 'width 0.5s linear',
          }}
        />
      </div>
      <div style={{ fontSize: 12, color: token.colorTextTertiary, display: 'flex', justifyContent: 'space-between' }}>
        <span>当前：{MODE_LABEL[state.mode]}</span>
        <span>今日 🍅 {state.todayFocus}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <Button
          type="primary"
          icon={state.running ? <Pause size={14} /> : <Play size={14} />}
          onClick={() => void handleToggle()}
        >
          {state.running ? '暂停' : state.elapsedMs > 0 ? '继续' : '开始'}
        </Button>
        <Tooltip title="重置本轮">
          <Button icon={<TimerReset size={14} />} onClick={handleReset} aria-label="重置番茄钟" />
        </Tooltip>
      </div>
    </div>
  );
}

// ── TodoWidget · v1.3 ───────────────────────────────────
// 新增：排序拖拽 / 删除 / 完成率 / 已完成超 24h 折叠 / Esc 清空输入

const TODO_COLLAPSE_MS = 24 * 60 * 60 * 1000; // 24h 自动折叠

function SortableTodoRow({
  item,
  onToggle,
  onRemove,
}: {
  item: TodoEntry;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const { token } = theme.useToken();
  const [hover, setHover] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        borderRadius: token.borderRadiusLG,
        background: token.colorFillQuaternary,
        border: `1px solid ${token.colorBorderSecondary}`,
        opacity: isDragging ? 0.4 : 1,
        transform: CSS.Translate.toString(transform),
        transition,
        touchAction: 'none',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span
        {...attributes}
        {...listeners}
        style={{
          display: 'inline-flex',
          cursor: 'grab',
          color: token.colorTextTertiary,
          opacity: hover ? 1 : 0.3,
        }}
        aria-label="拖拽排序"
      >
        <GripVertical size={12} />
      </span>
      <button
        type="button"
        onClick={onToggle}
        aria-label={item.done ? '标记为未完成' : '标记为完成'}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          flex: 1,
        }}
      >
        {item.done ? (
          <CheckCircle2 size={16} color={token.colorSuccess} />
        ) : (
          <Circle size={16} color={token.colorTextTertiary} />
        )}
        <span
          style={{
            fontSize: 13,
            textDecoration: item.done ? 'line-through' : 'none',
            color: item.done ? token.colorTextTertiary : token.colorText,
          }}
        >
          {item.text}
        </span>
      </button>
      {hover && (
        <Button
          type="text"
          size="small"
          danger
          aria-label="删除这条待办"
          icon={<Trash2 size={12} />}
          onClick={onRemove}
        />
      )}
    </div>
  );
}

export function TodoWidget() {
  const settings = useSettingsStore((s) => s.settings.todoWidget);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const { token } = theme.useToken();
  const items = settings?.items ?? [];
  const [draft, setDraft] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const inputRef = useRef<InputRef | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // 分组：活跃（未完成 + 刚完成 24h 内） vs 已折叠（完成超 24h）
  const { active: activeItems, collapsed } = useMemo(() => {
    const now = Date.now();
    const active: TodoEntry[] = [];
    const collapsed: TodoEntry[] = [];
    for (const item of items) {
      if (item.done && typeof item.completedAt === 'number' && now - item.completedAt >= TODO_COLLAPSE_MS) {
        collapsed.push(item);
      } else {
        active.push(item);
      }
    }
    return { active, collapsed };
  }, [items]);

  const totalCount = items.length;
  const doneCount = items.filter((item) => item.done).length;

  const toggleItem = async (item: TodoEntry) => {
    const nowTs = Date.now();
    const nextItems = items.map((entry) =>
      entry.id === item.id
        ? { ...entry, done: !entry.done, completedAt: entry.done ? undefined : nowTs }
        : entry,
    );
    await updateSettings({ todoWidget: { ...(settings ?? {}), items: nextItems } });
  };

  const removeItem = async (id: string) => {
    const nextItems = items.filter((e) => e.id !== id);
    await updateSettings({ todoWidget: { ...(settings ?? {}), items: nextItems } });
  };

  const addItem = async () => {
    if (!draft.trim()) return;
    await updateSettings({
      todoWidget: {
        ...(settings ?? {}),
        items: [...items, { id: `todo-${Date.now()}`, text: draft.trim(), done: false }],
      },
    });
    setDraft('');
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = items.findIndex((i) => i.id === active.id);
    const toIndex = items.findIndex((i) => i.id === over.id);
    if (fromIndex < 0 || toIndex < 0) return;
    const nextItems = arrayMove(items, fromIndex, toIndex);
    await updateSettings({ todoWidget: { ...(settings ?? {}), items: nextItems } });
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Escape') {
      // Esc 清空输入并保留焦点
      e.preventDefault();
      setDraft('');
      inputRef.current?.focus();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      {/* 完成率胶囊 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 10px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
            background: token.colorPrimaryBg,
            color: token.colorPrimary,
          }}
          aria-label={`今日完成率 ${doneCount} 分之 ${totalCount}`}
        >
          {doneCount}/{totalCount} 完成
        </span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void onDragEnd(e)}>
        <SortableContext items={activeItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {activeItems.map((item) => (
              <SortableTodoRow
                key={item.id}
                item={item}
                onToggle={() => void toggleItem(item)}
                onRemove={() => void removeItem(item.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {collapsed.length > 0 && (
        <div>
          <Button
            type="text"
            size="small"
            onClick={() => setShowCompleted((v) => !v)}
            style={{ fontSize: 11, color: token.colorTextTertiary, padding: '0 4px' }}
          >
            {showCompleted ? '收起' : '展开'}已完成（{collapsed.length}）
          </Button>
          {showCompleted && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
              {collapsed.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 10px',
                    fontSize: 12,
                    color: token.colorTextTertiary,
                    textDecoration: 'line-through',
                  }}
                >
                  <CheckCircle2 size={12} color={token.colorSuccess} />
                  <span style={{ flex: 1 }}>{item.text}</span>
                  <Button type="text" size="small" icon={<Trash2 size={10} />} onClick={() => void removeItem(item.id)} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <Input
          ref={inputRef}
          size="small"
          placeholder="新增待办（Esc 清空）"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onPressEnter={() => void addItem()}
          onKeyDown={handleKeyDown}
        />
        <Button size="small" type="primary" icon={<Plus size={14} />} onClick={() => void addItem()} aria-label="新增待办" />
      </div>
    </div>
  );
}

// ── StickyWidget · v1.3 ─────────────────────────────────
// 从单条升级为最多 10 条、5 色可选、行内编辑、拖拽排序

const STICKY_MAX = 10;

/** 5 色板 —— 键名为语义代号；UI 仅读 STICKY_PALETTE[key] 取色 */
const STICKY_PALETTE = {
  yellow: { bg: '#FFF7CC', border: '#F5E48A', text: '#6B5A12' },
  pink: { bg: '#FFE1EC', border: '#F4B8CC', text: '#7A2B4C' },
  green: { bg: '#DFF5DC', border: '#A8D9A0', text: '#2A5A2A' },
  blue: { bg: '#DBEBFF', border: '#A6C9F4', text: '#1B3D6E' },
  purple: { bg: '#EADBFF', border: '#C7A8F2', text: '#432770' },
} as const;
type StickyColorKey = keyof typeof STICKY_PALETTE;
const STICKY_COLOR_KEYS: StickyColorKey[] = ['yellow', 'pink', 'green', 'blue', 'purple'];

/** 把历史数据里的 #hex 色值 / 缺失值统一归一到 StickyColorKey */
function resolveStickyColor(raw?: string): StickyColorKey {
  if (raw && (STICKY_COLOR_KEYS as string[]).includes(raw)) return raw as StickyColorKey;
  // 老数据（如 #fff7e6）→ yellow 默认
  return 'yellow';
}

function SortableStickyCard({
  note,
  onChange,
  onRemove,
  onColorChange,
}: {
  note: StickyNoteEntry;
  onChange: (content: string) => void;
  onRemove: () => void;
  onColorChange: (key: StickyColorKey) => void;
}) {
  const colorKey = resolveStickyColor(note.color);
  const palette = STICKY_PALETTE[colorKey];
  const [draft, setDraft] = useState(note.content);
  const [hover, setHover] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: note.id });

  // 外部 note.content 变更时同步
  useEffect(() => {
    setDraft(note.content);
  }, [note.content]);

  return (
    <div
      ref={setNodeRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        padding: 8,
        borderRadius: 10,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.text,
        opacity: isDragging ? 0.4 : 1,
        transform: CSS.Translate.toString(transform),
        transition,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <span
          {...attributes}
          {...listeners}
          aria-label="拖拽排序便签"
          style={{
            marginTop: 4,
            cursor: 'grab',
            color: palette.text,
            opacity: hover ? 0.8 : 0.3,
            touchAction: 'none',
          }}
        >
          <GripVertical size={12} />
        </span>
        <Input.TextArea
          variant="borderless"
          autoSize={{ minRows: 2, maxRows: 6 }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const next = draft.trim();
            // 空内容自动删除（此处沿用：失焦时若内容为空则回写空，外层统一处理）
            onChange(next === '' ? '' : draft);
          }}
          placeholder="写一条随手便签…"
          style={{ background: 'transparent', color: palette.text, padding: 0, fontSize: 12.5, resize: 'none' }}
          aria-label="便签内容"
        />
      </div>

      {/* 右上角：色板切换 + 删除确认 */}
      {hover && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'rgba(255,255,255,0.9)',
            borderRadius: 8,
            padding: 2,
          }}
        >
          {STICKY_COLOR_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onColorChange(key)}
              aria-label={`切换为 ${key} 色`}
              style={{
                width: 12,
                height: 12,
                padding: 0,
                border: key === colorKey ? '2px solid #333' : `1px solid ${STICKY_PALETTE[key].border}`,
                background: STICKY_PALETTE[key].bg,
                borderRadius: 4,
                cursor: 'pointer',
              }}
            />
          ))}
          <Popconfirm title="删除这条便签？" onConfirm={onRemove}>
            <Button type="text" size="small" danger aria-label="删除便签" icon={<Trash2 size={10} />} />
          </Popconfirm>
        </div>
      )}
    </div>
  );
}

export function StickyWidget() {
  const settings = useSettingsStore((s) => s.settings.stickyNotes);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  // 兼容：老用户可能只有 1 条；直接全量读取即可（迁移逻辑在 storage-repo 层做）
  const notes = settings?.items ?? [];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const saveNotes = async (next: StickyNoteEntry[]) => {
    await updateSettings({ stickyNotes: { ...(settings ?? {}), items: next } });
  };

  const addNote = async () => {
    if (notes.length >= STICKY_MAX) {
      feedback.info(`最多 ${STICKY_MAX} 条便签`);
      return;
    }
    const colors = STICKY_COLOR_KEYS;
    const nextColor = colors[notes.length % colors.length];
    await saveNotes([
      ...notes,
      { id: `sticky-${Date.now()}`, title: '便签', content: '', color: nextColor },
    ]);
  };

  const updateNote = async (id: string, content: string) => {
    // 空内容在失焦后会触发：若内容空且不是正在新建，直接移除
    const trimmed = content.trim();
    if (trimmed === '') {
      await saveNotes(notes.filter((n) => n.id !== id));
      return;
    }
    await saveNotes(notes.map((n) => (n.id === id ? { ...n, content } : n)));
  };

  const removeNote = async (id: string) => {
    await saveNotes(notes.filter((n) => n.id !== id));
  };

  const changeColor = async (id: string, color: StickyColorKey) => {
    await saveNotes(notes.map((n) => (n.id === id ? { ...n, color } : n)));
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = notes.findIndex((n) => n.id === active.id);
    const toIndex = notes.findIndex((n) => n.id === over.id);
    if (fromIndex < 0 || toIndex < 0) return;
    await saveNotes(arrayMove(notes, fromIndex, toIndex));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void onDragEnd(e)}>
        <SortableContext items={notes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
            {notes.map((note) => (
              <SortableStickyCard
                key={note.id}
                note={note}
                onChange={(content) => void updateNote(note.id, content)}
                onRemove={() => void removeNote(note.id)}
                onColorChange={(key) => void changeColor(note.id, key)}
              />
            ))}
            {notes.length === 0 && (
              <div style={{ fontSize: 11, color: '#8c6a00', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <StickyNote size={12} /> 还没有便签，点下方 "+ 新便签" 开始
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>

      <Button
        size="small"
        type="dashed"
        icon={<Plus size={12} />}
        onClick={() => void addNote()}
        disabled={notes.length >= STICKY_MAX}
        style={{ marginTop: 'auto' }}
        aria-label="新建便签"
      >
        新便签（{notes.length}/{STICKY_MAX}）
      </Button>
    </div>
  );
}

export function renderWidgetBody(item: DashboardWidgetLayoutItem): React.ReactNode {
  switch (item.type) {
    case 'clock':
      return <ClockWidget />;
    case 'weather':
      return <WeatherWidget />;
    case 'calendar':
      return <CalendarWidget />;
    case 'dailyQuote':
      return <DailyQuote />;
    case 'speedDial':
      return <SpeedDialWidget />;
    case 'pomodoro':
      return <PomodoroWidget />;
    case 'todo':
      return <TodoWidget />;
    case 'sticky':
      return <StickyWidget />;
    case 'countdown':
      return <CountdownWidget />;
    case 'workCountdown':
      return <WorkCountdownWidget />;
    case 'searchBox':
      return <SearchBoxWidget />;
    case 'waterReminder':
      return <WaterReminderWidget />;
    case 'habitTracker':
      return <HabitTrackerWidget />;
    case 'timestampTool':
      return <TimestampToolWidget />;
    case 'jsonFormatter':
      return <JsonFormatterWidget />;
    case 'networkInfo':
      return <NetworkInfoWidget />;
    default:
      return <MiniEmpty text="组件暂未实现" />;
  }
}

export function getWidgetTitle(type: DashboardWidgetType): string {
  const titles: Record<DashboardWidgetType, string> = {
    clock: '时钟',
    weather: '天气',
    calendar: '日历',
    dailyQuote: '金句',
    speedDial: '常用网站',
    pomodoro: '番茄钟',
    todo: '待办',
    sticky: '便签',
    countdown: '纪念日',
    workCountdown: '距离下班',
    searchBox: '极速搜索',
    waterReminder: '喝水提醒',
    habitTracker: '习惯打卡',
    timestampTool: '时间戳',
    jsonFormatter: 'JSON 格式化',
    networkInfo: '网络信息',
  };
  return titles[type];
}
