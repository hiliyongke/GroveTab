/**
 * Pomodoro Engine · v1.3
 *
 * 番茄钟状态机的纯函数层——与 React/Timer/DOM 解耦，便于单测。
 *
 * 设计要点：
 * - 计时基于 `Date.now()` 差值（而非 setInterval 每秒递减），保证 Tab 失焦或
 *   标签页被浏览器节流时，回到前台仍能正确显示剩余秒数。
 * - 模式切换规则：focus → short → focus → short → focus → short → focus → short → focus → long → ...
 *   即每 4 轮 focus 后自动进入 long break（番茄工作法标准）。
 */

export type PomodoroMode = 'focus' | 'short' | 'long';

export interface PomodoroConfig {
  /** 默认 25 */
  focusMinutes: number;
  /** 默认 5 */
  shortBreakMinutes: number;
  /** 默认 15 */
  longBreakMinutes: number;
}

export interface PomodoroState {
  /** 当前所处阶段 */
  mode: PomodoroMode;
  /** 当前阶段「已运行累计毫秒」—— 暂停时也保留，继续从它开始 */
  elapsedMs: number;
  /** 本阶段开始/恢复计时的时间戳；undefined 表示未运行 */
  startedAt?: number;
  /** 是否处于运行中 */
  running: boolean;
  /** 本会话内已完成的 focus 轮次数（决定何时进入 long break） */
  completedFocus: number;
  /** 本地当日（YYYY-MM-DD）已完成番茄数，跨天自动归零 */
  todayFocus: number;
  /** todayFocus 统计对应的日期字符串 */
  todayDate: string;
}

/** 默认配置 —— 模块级常量，避免各处硬编码 */
export const DEFAULT_POMODORO_CONFIG: PomodoroConfig = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
};

export function todayDateKey(now: number = Date.now()): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getDurationMs(mode: PomodoroMode, config: PomodoroConfig): number {
  const minutes =
    mode === 'focus'
      ? config.focusMinutes
      : mode === 'short'
        ? config.shortBreakMinutes
        : config.longBreakMinutes;
  return Math.max(1, minutes) * 60 * 1000;
}

/**
 * 计算当前阶段剩余毫秒数。
 * - 未运行：返回 `duration - elapsedMs`
 * - 运行中：返回 `duration - elapsedMs - (now - startedAt)`
 * - 不会返回负数（最小 0）
 */
export function computeRemaining(
  state: PomodoroState,
  config: PomodoroConfig,
  now: number = Date.now(),
): number {
  const duration = getDurationMs(state.mode, config);
  const running = state.running && state.startedAt !== undefined ? now - state.startedAt : 0;
  return Math.max(0, duration - state.elapsedMs - running);
}

/**
 * 计算下一个模式 —— 每 4 轮 focus 后 long break，其余 focus 后 short break，
 * 任一 break 后回到 focus。
 */
export function nextMode(current: PomodoroMode, completedFocus: number): PomodoroMode {
  if (current === 'focus') {
    // completedFocus 已经包含「刚完成的这一轮」之后的计数
    return completedFocus > 0 && completedFocus % 4 === 0 ? 'long' : 'short';
  }
  return 'focus';
}

export function createInitialState(mode: PomodoroMode = 'focus', now: number = Date.now()): PomodoroState {
  return {
    mode,
    elapsedMs: 0,
    startedAt: undefined,
    running: false,
    completedFocus: 0,
    todayFocus: 0,
    todayDate: todayDateKey(now),
  };
}

/**
 * 统一 reducer —— 所有状态流转都经过这里，便于测试。
 */
export type PomodoroAction =
  | { type: 'start'; now?: number }
  | { type: 'pause'; now?: number }
  | { type: 'reset'; mode?: PomodoroMode; now?: number }
  | { type: 'switch'; mode: PomodoroMode; now?: number }
  /** 由定时器驱动：检测到剩余 = 0 时派发 */
  | { type: 'complete'; config: PomodoroConfig; now?: number }
  /** 跨日归零今日番茄数 */
  | { type: 'roll-date'; now?: number };

export function pomodoroReducer(
  state: PomodoroState,
  action: PomodoroAction,
  _config: PomodoroConfig,
): PomodoroState {
  const now = 'now' in action && action.now !== undefined ? action.now : Date.now();

  switch (action.type) {
    case 'start': {
      if (state.running) return state;
      return { ...state, running: true, startedAt: now };
    }

    case 'pause': {
      if (!state.running || state.startedAt === undefined) return state;
      const delta = now - state.startedAt;
      return { ...state, running: false, startedAt: undefined, elapsedMs: state.elapsedMs + delta };
    }

    case 'reset': {
      const nextModeValue = action.mode ?? state.mode;
      return {
        ...state,
        mode: nextModeValue,
        elapsedMs: 0,
        startedAt: undefined,
        running: false,
      };
    }

    case 'switch': {
      return {
        ...state,
        mode: action.mode,
        elapsedMs: 0,
        startedAt: undefined,
        running: false,
      };
    }

    case 'complete': {
      // 判定是否是跨日——若是则今日计数归零再累加
      const dayKey = todayDateKey(now);
      const sameDay = dayKey === state.todayDate;

      if (state.mode === 'focus') {
        const completedFocus = state.completedFocus + 1;
        const todayFocus = (sameDay ? state.todayFocus : 0) + 1;
        const nm = nextMode('focus', completedFocus);
        return {
          ...state,
          mode: nm,
          elapsedMs: 0,
          startedAt: undefined,
          running: false,
          completedFocus,
          todayFocus,
          todayDate: dayKey,
        };
      }

      // break 完成 → 回到 focus
      return {
        ...state,
        mode: 'focus',
        elapsedMs: 0,
        startedAt: undefined,
        running: false,
        todayDate: dayKey,
        todayFocus: sameDay ? state.todayFocus : 0,
      };
    }

    case 'roll-date': {
      const dayKey = todayDateKey(now);
      if (dayKey === state.todayDate) return state;
      return { ...state, todayDate: dayKey, todayFocus: 0 };
    }

    default:
      return state;
  }
}

/**
 * 从持久化快照恢复状态 —— 若其实已经运行结束，直接 fast-forward 到下一模式（把过期的部分视为用户"忘关"，不累计）。
 */
export function reviveState(
  snapshot: PomodoroState | null | undefined,
  config: PomodoroConfig,
  now: number = Date.now(),
): PomodoroState {
  if (!snapshot) return createInitialState('focus', now);

  // 跨日 → 今日归零
  const todayDate = todayDateKey(now);
  const base: PomodoroState =
    snapshot.todayDate === todayDate
      ? snapshot
      : { ...snapshot, todayDate, todayFocus: 0 };

  // 未运行：原样返回
  if (!base.running || base.startedAt === undefined) return base;

  const remaining = computeRemaining(base, config, now);
  // 运行中但已到期 → 自动切换到下一模式，但不累加 todayFocus（避免"关机一夜自动+10"）
  if (remaining <= 0) {
    if (base.mode === 'focus') {
      const completedFocus = base.completedFocus + 1;
      return {
        ...base,
        mode: nextMode('focus', completedFocus),
        elapsedMs: 0,
        startedAt: undefined,
        running: false,
        completedFocus,
      };
    }
    return {
      ...base,
      mode: 'focus',
      elapsedMs: 0,
      startedAt: undefined,
      running: false,
    };
  }

  return base;
}

export function formatRemaining(remainingMs: number): { minutes: string; seconds: string } {
  const total = Math.ceil(remainingMs / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return { minutes: String(m).padStart(2, '0'), seconds: String(s).padStart(2, '0') };
}
