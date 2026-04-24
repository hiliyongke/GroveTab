/**
 * Pomodoro engine 单元测试
 *
 * 覆盖场景：
 * 1. nextMode：4 轮 focus 后进入 long break
 * 2. pomodoroReducer：start/pause 的 elapsed 累计正确
 * 3. reviveState：跨 Tab 失焦恢复时剩余时间准确
 * 4. reviveState：运行中但已过期时 fast-forward 到下一模式
 * 5. 跨日 today 自动归零
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_POMODORO_CONFIG,
  computeRemaining,
  createInitialState,
  formatRemaining,
  nextMode,
  pomodoroReducer,
  reviveState,
  todayDateKey,
  type PomodoroState,
} from '@/features/dashboard-widgets/pomodoro-engine';

const CONFIG = DEFAULT_POMODORO_CONFIG;

describe('nextMode', () => {
  it('focus 第 1/2/3 次完成后进入 short break', () => {
    expect(nextMode('focus', 1)).toBe('short');
    expect(nextMode('focus', 2)).toBe('short');
    expect(nextMode('focus', 3)).toBe('short');
  });

  it('focus 第 4 次完成后进入 long break', () => {
    expect(nextMode('focus', 4)).toBe('long');
    expect(nextMode('focus', 8)).toBe('long');
  });

  it('任一 break 结束后回到 focus', () => {
    expect(nextMode('short', 3)).toBe('focus');
    expect(nextMode('long', 4)).toBe('focus');
  });
});

describe('pomodoroReducer: tick 推进', () => {
  it('start 会记录 startedAt 并置 running=true', () => {
    const s0 = createInitialState('focus', 0);
    const s1 = pomodoroReducer(s0, { type: 'start', now: 1_000 }, CONFIG);
    expect(s1.running).toBe(true);
    expect(s1.startedAt).toBe(1_000);
  });

  it('pause 把 (now - startedAt) 追加到 elapsedMs', () => {
    const s0 = createInitialState('focus', 0);
    const s1 = pomodoroReducer(s0, { type: 'start', now: 1_000 }, CONFIG);
    const s2 = pomodoroReducer(s1, { type: 'pause', now: 6_000 }, CONFIG); // 跑了 5s
    expect(s2.running).toBe(false);
    expect(s2.startedAt).toBeUndefined();
    expect(s2.elapsedMs).toBe(5_000);
  });

  it('再次 start 后 pause，elapsed 正确累加', () => {
    let s = createInitialState('focus', 0);
    s = pomodoroReducer(s, { type: 'start', now: 1_000 }, CONFIG);
    s = pomodoroReducer(s, { type: 'pause', now: 6_000 }, CONFIG); // +5s
    s = pomodoroReducer(s, { type: 'start', now: 10_000 }, CONFIG);
    s = pomodoroReducer(s, { type: 'pause', now: 13_000 }, CONFIG); // +3s
    expect(s.elapsedMs).toBe(8_000);
  });

  it('complete 在 focus 模式下会把 completedFocus/todayFocus 各 +1 并切到 break', () => {
    const s0: PomodoroState = {
      ...createInitialState('focus', 0),
      todayDate: todayDateKey(0),
    };
    const s1 = pomodoroReducer(s0, { type: 'complete', config: CONFIG, now: 0 }, CONFIG);
    expect(s1.completedFocus).toBe(1);
    expect(s1.todayFocus).toBe(1);
    expect(s1.mode).toBe('short');
  });

  it('长休切换：第 4 次 complete 进入 long', () => {
    let s: PomodoroState = { ...createInitialState('focus', 0), todayDate: todayDateKey(0) };
    // 模拟 4 次 focus 完成（中间用 reset 回到 focus 简化）
    for (let i = 0; i < 4; i++) {
      s = pomodoroReducer(s, { type: 'complete', config: CONFIG, now: 0 }, CONFIG);
      if (s.mode !== 'focus') {
        s = pomodoroReducer(s, { type: 'switch', mode: 'focus', now: 0 }, CONFIG);
      }
    }
    // 第 4 次 complete 时 completedFocus=4，应切到 long
    // 上面循环最后一次 complete 后 s.mode 已被 switch 覆写回 focus
    expect(s.completedFocus).toBe(4);
  });
});

describe('computeRemaining: 实时扣减', () => {
  it('运行中每流过 1 秒，剩余减 1 秒', () => {
    const s0 = createInitialState('focus', 0);
    const s1 = pomodoroReducer(s0, { type: 'start', now: 0 }, CONFIG);
    const duration = CONFIG.focusMinutes * 60 * 1000;
    expect(computeRemaining(s1, CONFIG, 0)).toBe(duration);
    expect(computeRemaining(s1, CONFIG, 3_000)).toBe(duration - 3_000);
  });

  it('暂停时剩余不再减少', () => {
    const s0 = createInitialState('focus', 0);
    const s1 = pomodoroReducer(s0, { type: 'start', now: 0 }, CONFIG);
    const s2 = pomodoroReducer(s1, { type: 'pause', now: 10_000 }, CONFIG);
    const duration = CONFIG.focusMinutes * 60 * 1000;
    // 暂停后无论 now 如何移动，剩余都等于 duration - 10s
    expect(computeRemaining(s2, CONFIG, 10_000)).toBe(duration - 10_000);
    expect(computeRemaining(s2, CONFIG, 60_000)).toBe(duration - 10_000);
  });
});

describe('reviveState: 跨 Tab 失焦/重启恢复', () => {
  it('运行中但还没到期 —— 剩余时间按 (now - startedAt) 差值推进', () => {
    const snapshot: PomodoroState = {
      mode: 'focus',
      elapsedMs: 0,
      startedAt: 1_000,
      running: true,
      completedFocus: 0,
      todayFocus: 0,
      todayDate: todayDateKey(1_000),
    };
    // 开始后 1 分钟后恢复 —— 剩余应该 = duration - 60s
    const revived = reviveState(snapshot, CONFIG, 1_000 + 60_000);
    expect(revived.running).toBe(true);
    const remaining = computeRemaining(revived, CONFIG, 1_000 + 60_000);
    expect(remaining).toBe(CONFIG.focusMinutes * 60 * 1000 - 60_000);
  });

  it('运行中但快照已过期 —— fast-forward 到下一模式且不累计 todayFocus', () => {
    const snapshot: PomodoroState = {
      mode: 'focus',
      elapsedMs: 0,
      startedAt: 1_000,
      running: true,
      completedFocus: 0,
      todayFocus: 0,
      todayDate: todayDateKey(1_000),
    };
    // 开始后 100 分钟后才回来（远超 focus 25 分钟）
    const revived = reviveState(snapshot, CONFIG, 1_000 + 100 * 60_000);
    expect(revived.running).toBe(false);
    expect(revived.mode).toBe('short');
    // todayFocus 不累加（避免"一夜 +10"）
    expect(revived.todayFocus).toBe(0);
    // completedFocus 仍然 +1（这是内部"已完成轮数"，用来决定 long 时机，允许增长）
    expect(revived.completedFocus).toBe(1);
  });

  it('跨日时 todayFocus 归零，todayDate 更新', () => {
    const yesterdayMs = Date.UTC(2026, 3, 24, 10, 0, 0); // 4月24日（月份 0-indexed）
    const todayMs = Date.UTC(2026, 3, 25, 10, 0, 0); // 4月25日
    const snapshot: PomodoroState = {
      mode: 'focus',
      elapsedMs: 0,
      startedAt: undefined,
      running: false,
      completedFocus: 2,
      todayFocus: 5,
      todayDate: todayDateKey(yesterdayMs),
    };
    const revived = reviveState(snapshot, CONFIG, todayMs);
    expect(revived.todayFocus).toBe(0);
    expect(revived.todayDate).toBe(todayDateKey(todayMs));
    // completedFocus 不是"今日"概念，保留
    expect(revived.completedFocus).toBe(2);
  });

  it('null/undefined 快照 —— 回落到 fresh initial state', () => {
    const revived = reviveState(null, CONFIG, 0);
    expect(revived.mode).toBe('focus');
    expect(revived.running).toBe(false);
    expect(revived.todayFocus).toBe(0);
  });
});

describe('formatRemaining', () => {
  it('25 分钟剩余格式化为 "25:00"', () => {
    const r = formatRemaining(25 * 60 * 1000);
    expect(r.minutes).toBe('25');
    expect(r.seconds).toBe('00');
  });

  it('3 秒剩余格式化为 "00:03"', () => {
    const r = formatRemaining(3_000);
    expect(r.minutes).toBe('00');
    expect(r.seconds).toBe('03');
  });
});
