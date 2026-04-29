import { nanoid } from 'nanoid';
import type { InputRef } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Empty, Input, Popconfirm, Segmented, Tabs, Tooltip } from 'antd';
import {
  Plus,
  TimerReset,
  CheckCircle2,
  Circle,
  StickyNote,
  Play,
  Pause,
  GripVertical,
  Trash2,
} from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
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
import { useT } from '@/shared/i18n';
import { getData, setData } from '@/repositories/storage-repo';
import { isSafeExternalUrl, normalizeExternalUrl } from '@/shared/utils/url-safety';
import { BRAND } from '@/shared/config/brand';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';
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
import {
  buildFaviconUrl,
  formatDaysLeft,
  formatTimeLeftTo,
  getHostnameLabel,
  getInitials,
} from './utils';
import {
  SearchBoxWidget,
  WaterReminderWidget,
  HabitTrackerWidget,
  TimestampToolWidget,
  JsonFormatterWidget,
  NetworkInfoWidget,
} from './extra-widgets';

function MiniEmpty({ text }: { text: string }) {
  return (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={text}
      className="dashboard-widget-empty"
    />
  );
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
  const [imageFailed, setImageFailed] = useState(false);
  const iconUrl = buildFaviconUrl(link.url);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: link.id,
  });

  const itemStyle = {
    transform: CSS.Translate.toString(transform),
    transition,
  } as React.CSSProperties;
  const iconStyle = link.color
    ? ({ '--dashboard-speed-dial-color': link.color } as React.CSSProperties)
    : undefined;

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      return;
    }
    if (!isSafeExternalUrl(link.url)) {
      feedback.error('链接格式无效');
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
      className="dashboard-speed-dial__item app-hover-reveal-host"
      data-dragging={isDragging || undefined}
      style={itemStyle}
    >
      <div
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={0}
        aria-label={link.title + '（拖拽重排或按 Enter 打开）'}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick(e as unknown as React.MouseEvent);
          }
        }}
        className="dashboard-speed-dial__tile"
      >
        <div className="dashboard-speed-dial__icon" style={iconStyle}>
          {link.emoji ? (
            <span>{link.emoji}</span>
          ) : iconUrl && !imageFailed ? (
            <img
              src={iconUrl}
              alt=""
              width={22}
              height={22}
              className="dashboard-speed-dial__icon-image"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span>{getInitials(link.title)}</span>
          )}
        </div>
        {showLabels && (
          <div className="dashboard-speed-dial__copy">
            <div className="dashboard-speed-dial__title">{link.title}</div>
            <div className="dashboard-speed-dial__host">{getHostnameLabel(link.url)}</div>
          </div>
        )}
      </div>

      {!isDragging && (
        <div className="dashboard-speed-dial__overlay app-hover-reveal">
          <Tooltip title="按住拖拽排序">
            <span className="dashboard-speed-dial__drag" aria-hidden="true">
              <GripVertical size={ICON_SIZE.TINY} />
            </span>
          </Tooltip>
          <Button
            type="text"
            size="small"
            danger
            aria-label={'删除 ' + link.title}
            className="dashboard-speed-dial__remove app-dashboard__no-drag"
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
  const { t } = useT();
  const groups = settings?.groups ?? [];
  const activeGroupId = settings?.activeGroupId ?? groups[0]?.id;
  const activeGroup = groups.find((item) => item.id === activeGroupId) ?? groups[0];
  const [draftTitle, setDraftTitle] = useState('');
  const [draftUrl, setDraftUrl] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const addLink = async () => {
    if (!activeGroup || !draftUrl.trim()) return;
    const finalUrl = normalizeExternalUrl(draftUrl, { assumeHttpsWhenMissingProtocol: true });
    if (finalUrl === null) {
      feedback.error('链接格式无效');
      return;
    }
    const title = draftTitle.trim() || getHostnameLabel(finalUrl);
    const nextGroups = groups.map((group) =>
      group.id === activeGroup.id
        ? {
            ...group,
            links: [...group.links, { id: 'link-' + nanoid(8), title, url: finalUrl }],
          }
        : group,
    );
    await updateSettings({ speedDial: { ...(settings ?? {}), groups: nextGroups } });
    setDraftTitle('');
    setDraftUrl('');
    feedback.success(t('dashboard.added'));
  };

  const removeLink = async (id: string) => {
    if (!activeGroup) return;
    const nextGroups = groups.map((group) =>
      group.id === activeGroup.id
        ? { ...group, links: group.links.filter((l) => l.id !== id) }
        : group,
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
    <div className="dashboard-speed-dial">
      <Tabs
        size="small"
        activeKey={activeGroup.id}
        onChange={(value) =>
          void updateSettings({ speedDial: { ...(settings ?? {}), activeGroupId: value } })
        }
        items={groups.map((group) => ({ key: group.id, label: group.name }))}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(e) => void onDragEnd(e)}
      >
        <SortableContext items={activeGroup.links.map((l) => l.id)} strategy={rectSortingStrategy}>
          <div className="dashboard-speed-dial__grid">
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

      <div className="dashboard-speed-dial__add-row">
        <Input
          size="small"
          placeholder="名称（可选）"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
        />
        <Input
          size="small"
          placeholder="粘贴网址即可"
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          onPressEnter={() => void addLink()}
        />
        <Button
          size="small"
          type="primary"
          icon={<Plus size={ICON_SIZE.MEDIUM} />}
          onClick={() => void addLink()}
          aria-label="添加快捷网站"
        />
      </div>
    </div>
  );
}


export function CountdownWidget() {
  const countdowns = useSettingsStore((s) => s.settings.countdowns);
  const items = countdowns?.items ?? [];
  const showPastEvents = countdowns?.showPastEvents === true;
  const visibleItems = items
    .filter((item) => showPastEvents || !formatDaysLeft(item.targetDate).overdue)
    .slice(0, 4);

  if (visibleItems.length === 0) {
    return <MiniEmpty text={items.length === 0 ? '暂无倒计时' : '过期事项已隐藏'} />;
  }

  return (
    <div className="dashboard-countdown">
      {visibleItems.map((item) => {
        const info = formatDaysLeft(item.targetDate);
        return (
          <div
            key={item.id}
            className={'dashboard-countdown__item' + (info.overdue ? ' is-overdue' : '')}
          >
            <div className="dashboard-countdown__item-main">
              <div className="dashboard-countdown__title">
                {item.emoji ? item.emoji + ' ' + item.title : item.title}
              </div>
              <div className="dashboard-countdown__date">{item.targetDate}</div>
            </div>
            <div className="dashboard-countdown__badge">{info.label}</div>
          </div>
        );
      })}
    </div>
  );
}


export function WorkCountdownWidget() {
  const conf = useSettingsStore((s) => s.settings.workCountdown);
  const info = formatTimeLeftTo(conf?.workdayEnd ?? '18:30');
  const finishedLabel = conf?.offLabel?.trim() || '今天收工啦';

  return (
    <div className={'dashboard-work-countdown' + (info.finished ? ' is-finished' : '')}>
      <div className="dashboard-work-countdown__value">
        {info.finished ? finishedLabel : info.label}
      </div>
      <div className="dashboard-work-countdown__meta">
        目标下班时间：{conf?.workdayEnd ?? '18:30'}
      </div>
    </div>
  );
}


// ── Pomodoro 持久化 ──────────────────────────────────
const POMODORO_STORAGE_KEY = STORAGE_KEYS.pomodoroState;

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
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
    osc.onended = () => {
      void ctx.close();
    };
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

  const config = useMemo<PomodoroConfig>(
    () => ({
      focusMinutes: conf?.focusMinutes ?? DEFAULT_POMODORO_CONFIG.focusMinutes,
      shortBreakMinutes: conf?.shortBreakMinutes ?? DEFAULT_POMODORO_CONFIG.shortBreakMinutes,
      longBreakMinutes: conf?.longBreakMinutes ?? DEFAULT_POMODORO_CONFIG.longBreakMinutes,
    }),
    [conf?.focusMinutes, conf?.shortBreakMinutes, conf?.longBreakMinutes],
  );

  const [state, setState] = useState<PomodoroState>(() => createInitialState('focus'));

  const dispatch = (action: PomodoroAction) => {
    setState((prev) => pomodoroReducer(prev, action, config));
  };

  const revivedRef = useRef(false);
  useEffect(() => {
    if (revivedRef.current) return;
    revivedRef.current = true;
    void getData<PomodoroState>(POMODORO_STORAGE_KEY).then((raw) => {
      const snap = sanitizeStoredPomodoroState(raw);
      if (!snap) return;
      setState(reviveState(snap, config));
    });
  }, [config]);

  const [, setTick] = useState(0);
  useEffect(() => {
    if (!state.running) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [state.running]);

  const completedOnceRef = useRef(false);
  useEffect(() => {
    if (!state.running) {
      completedOnceRef.current = false;
      return;
    }
    const remainingMs = computeRemaining(state, config);
    if (remainingMs <= 0 && !completedOnceRef.current) {
      completedOnceRef.current = true;
      const finishedMode = state.mode;
      const msg = finishedMode === 'focus' ? '专注结束，稍作休息 🌿' : '休息结束，回到专注吧 ⚡';
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification(BRAND.name + ' · 番茄钟', { body: msg });
        } catch {
          /* ignore */
        }
      } else {
        feedback.info(msg);
      }
      playBeep();
      dispatch({ type: 'complete', config });
    }
  }, [state, config]);

  const firstWriteRef = useRef(true);
  useEffect(() => {
    if (firstWriteRef.current) {
      firstWriteRef.current = false;
      return;
    }
    void setData(POMODORO_STORAGE_KEY, state).catch(() => {
      /* 失败忽略 */
    });
  }, [state]);

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
  const handleSwitch = (mode: PomodoroMode) => dispatch({ type: 'switch', mode });

  const remaining = computeRemaining(state, config);
  const formatted = formatRemaining(remaining);
  const totalMinutes =
    state.mode === 'focus'
      ? config.focusMinutes
      : state.mode === 'short'
        ? config.shortBreakMinutes
        : config.longBreakMinutes;
  const totalDuration = Math.max(1, totalMinutes) * 60 * 1000;
  const progress = totalDuration > 0 ? 1 - remaining / totalDuration : 0;
  const pomodoroStyle = {
    '--dashboard-pomodoro-progress': Math.round(progress * 100) + '%',
  } as React.CSSProperties;

  return (
    <div
      className={'dashboard-pomodoro dashboard-pomodoro--' + state.mode}
      style={pomodoroStyle}
    >
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
        aria-label={MODE_LABEL[state.mode] + ' 剩余 ' + formatted.minutes + ' 分 ' + formatted.seconds + ' 秒'}
        className="dashboard-pomodoro__timer"
      >
        {formatted.minutes}:{formatted.seconds}
      </div>
      <div className="dashboard-pomodoro__progress">
        <div className="dashboard-pomodoro__progress-fill" />
      </div>
      <div className="dashboard-pomodoro__meta">
        <span>当前：{MODE_LABEL[state.mode]}</span>
        <span>今日 🍅 {state.todayFocus}</span>
      </div>
      <div className="dashboard-pomodoro__actions">
        <Button
          type="primary"
          icon={state.running ? <Pause size={ICON_SIZE.MEDIUM} /> : <Play size={ICON_SIZE.MEDIUM} />}
          onClick={() => void handleToggle()}
        >
          {state.running ? '暂停' : state.elapsedMs > 0 ? '继续' : '开始'}
        </Button>
        <Tooltip title="重置本轮">
          <Button
            icon={<TimerReset size={ICON_SIZE.MEDIUM} />}
            onClick={handleReset}
            aria-label="重置番茄钟"
          />
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const rowStyle = {
    transform: CSS.Translate.toString(transform),
    transition,
  } as React.CSSProperties;

  return (
    <div
      ref={setNodeRef}
      className={'dashboard-todo-row app-hover-reveal-host' + (item.done ? ' is-done' : '')}
      data-dragging={isDragging || undefined}
      style={rowStyle}
    >
      <span {...attributes} {...listeners} className="dashboard-todo-row__drag" aria-label="拖拽排序">
        <GripVertical size={ICON_SIZE.SMALL} />
      </span>
      <button
        type="button"
        onClick={onToggle}
        aria-label={item.done ? '标记为未完成' : '标记为完成'}
        className="dashboard-todo-row__toggle"
      >
        {item.done ? (
          <CheckCircle2 size={ICON_SIZE.LARGE} className="dashboard-todo-row__status--done" />
        ) : (
          <Circle size={ICON_SIZE.LARGE} className="dashboard-todo-row__status--pending" />
        )}
        <span className="dashboard-todo-row__text">{item.text}</span>
      </button>
      <Button
        type="text"
        size="small"
        danger
        aria-label="删除这条待办"
        icon={<Trash2 size={ICON_SIZE.SMALL} />}
        onClick={onRemove}
        className="dashboard-todo-row__remove app-hover-reveal app-dashboard__no-drag"
      />
    </div>
  );
}


export function TodoWidget() {
  const settings = useSettingsStore((s) => s.settings.todoWidget);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const items = settings?.items ?? [];
  const [draft, setDraft] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const inputRef = useRef<InputRef | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const { active: activeItems, collapsed } = useMemo(() => {
    const now = new Date().getTime();
    const active: TodoEntry[] = [];
    const collapsed: TodoEntry[] = [];
    for (const item of items) {
      if (
        item.done &&
        typeof item.completedAt === 'number' &&
        now - item.completedAt >= TODO_COLLAPSE_MS
      ) {
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
    const nowTs = new Date().getTime();
    const nextItems = items.map((entry) =>
      entry.id === item.id
        ? { ...entry, done: !entry.done, completedAt: entry.done ? undefined : nowTs }
        : entry,
    );
    await updateSettings({ todoWidget: { ...(settings ?? {}), items: nextItems } });
  };

  const removeItem = async (id: string) => {
    const nextItems = items.filter((entry) => entry.id !== id);
    await updateSettings({ todoWidget: { ...(settings ?? {}), items: nextItems } });
  };

  const addItem = async () => {
    if (!draft.trim()) return;
    await updateSettings({
      todoWidget: {
        ...(settings ?? {}),
        items: [...items, { id: 'todo-' + nanoid(8), text: draft.trim(), done: false }],
      },
    });
    setDraft('');
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = items.findIndex((item) => item.id === active.id);
    const toIndex = items.findIndex((item) => item.id === over.id);
    if (fromIndex < 0 || toIndex < 0) return;
    const nextItems = arrayMove(items, fromIndex, toIndex);
    await updateSettings({ todoWidget: { ...(settings ?? {}), items: nextItems } });
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setDraft('');
      inputRef.current?.focus();
    }
  };

  return (
    <div className="dashboard-todo">
      <div className="dashboard-todo__summary">
        <span
          className="dashboard-todo__badge"
          aria-label={'今日完成率 ' + doneCount + ' 分之 ' + totalCount}
        >
          {doneCount}/{totalCount} 完成
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(event) => void onDragEnd(event)}
      >
        <SortableContext items={activeItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          <div className="dashboard-todo__list">
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
            onClick={() => setShowCompleted((value) => !value)}
            className="dashboard-todo__toggle-completed"
          >
            {showCompleted ? '收起' : '展开'}已完成（{collapsed.length}）
          </Button>
          {showCompleted && (
            <div className="dashboard-todo-collapsed">
              {collapsed.map((item) => (
                <div key={item.id} className="dashboard-todo-collapsed__row">
                  <CheckCircle2 size={ICON_SIZE.SMALL} className="dashboard-todo-row__status--done" />
                  <span className="dashboard-todo-collapsed__text">{item.text}</span>
                  <Button
                    type="text"
                    size="small"
                    icon={<Trash2 size={ICON_SIZE.MICRO} />}
                    onClick={() => void removeItem(item.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="dashboard-todo__add-row">
        <Input
          ref={inputRef}
          size="small"
          placeholder="新增待办（Esc 清空）"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onPressEnter={() => void addItem()}
          onKeyDown={handleKeyDown}
          className="dashboard-todo__input"
        />
        <Button
          size="small"
          type="primary"
          icon={<Plus size={ICON_SIZE.MEDIUM} />}
          onClick={() => void addItem()}
          aria-label="新增待办"
        />
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
  const { t } = useT();
  const colorKey = resolveStickyColor(note.color);
  const palette = STICKY_PALETTE[colorKey];
  const [draftState, setDraftState] = useState(() => ({ id: note.id, content: note.content }));
  const draft = draftState.id === note.id ? draftState.content : note.content;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
  });
  const stickyStyle = {
    '--dashboard-sticky-bg': palette.bg,
    '--dashboard-sticky-border': palette.border,
    '--dashboard-sticky-text': palette.text,
    transform: CSS.Translate.toString(transform),
    transition,
  } as React.CSSProperties;

  return (
    <div
      ref={setNodeRef}
      className="dashboard-sticky-card app-hover-reveal-host"
      data-dragging={isDragging || undefined}
      style={stickyStyle}
    >
      <div className="dashboard-sticky-card__body">
        <span {...attributes} {...listeners} aria-label="拖拽排序便签" className="dashboard-sticky-card__drag">
          <GripVertical size={ICON_SIZE.SMALL} />
        </span>
        <Input.TextArea
          variant="borderless"
          autoSize={{ minRows: 2, maxRows: 6 }}
          value={draft}
          onChange={(e) => setDraftState({ id: note.id, content: e.target.value })}
          onBlur={() => {
            const next = draft.trim();
            onChange(next === '' ? '' : draft);
          }}
          placeholder="写一条随手便签…"
          className="dashboard-sticky-editor"
          aria-label="便签内容"
        />
      </div>

      <div className="dashboard-sticky-card__tools app-hover-reveal">
        <div className="dashboard-sticky-card__swatches">
          {STICKY_COLOR_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onColorChange(key)}
              aria-label={'切换为 ' + key + ' 色'}
              className={
                'dashboard-sticky-swatch dashboard-sticky-swatch--' + key + (key === colorKey ? ' is-active' : '')
              }
            />
          ))}
        </div>
        <Popconfirm title={t('dashboard.deleteSticky')} onConfirm={onRemove}>
          <Button
            type="text"
            size="small"
            danger
            aria-label="删除便签"
            icon={<Trash2 size={ICON_SIZE.MICRO} />}
          />
        </Popconfirm>
      </div>
    </div>
  );
}


export function StickyWidget() {
  const settings = useSettingsStore((s) => s.settings.stickyNotes);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
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
      feedback.info('最多 ' + STICKY_MAX + ' 条便签');
      return;
    }
    const nextColor = STICKY_COLOR_KEYS[notes.length % STICKY_COLOR_KEYS.length];
    await saveNotes([
      ...notes,
      { id: 'sticky-' + nanoid(8), title: '便签', content: '', color: nextColor },
    ]);
  };

  const updateNote = async (id: string, content: string) => {
    if (content.trim() === '') {
      await saveNotes(notes.filter((note) => note.id !== id));
      return;
    }
    await saveNotes(notes.map((note) => (note.id === id ? { ...note, content } : note)));
  };

  const removeNote = async (id: string) => {
    await saveNotes(notes.filter((note) => note.id !== id));
  };

  const changeColor = async (id: string, color: StickyColorKey) => {
    await saveNotes(notes.map((note) => (note.id === id ? { ...note, color } : note)));
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = notes.findIndex((note) => note.id === active.id);
    const toIndex = notes.findIndex((note) => note.id === over.id);
    if (fromIndex < 0 || toIndex < 0) return;
    await saveNotes(arrayMove(notes, fromIndex, toIndex));
  };

  return (
    <div className="dashboard-sticky">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(event) => void onDragEnd(event)}
      >
        <SortableContext items={notes.map((note) => note.id)} strategy={verticalListSortingStrategy}>
          <div className="dashboard-sticky__list">
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
              <div className="dashboard-sticky__empty">
                <StickyNote size={ICON_SIZE.SMALL} /> 还没有便签，点下方 "+ 新便签" 开始
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>

      <Button
        size="small"
        type="dashed"
        icon={<Plus size={ICON_SIZE.SMALL} />}
        onClick={() => void addNote()}
        disabled={notes.length >= STICKY_MAX}
        className="dashboard-sticky__add"
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
    waterReminder: '喝水打卡',
    habitTracker: '习惯打卡',
    timestampTool: '时间戳',
    jsonFormatter: 'JSON 格式化',
    networkInfo: '网络状态',
  };
  return titles[type];
}
