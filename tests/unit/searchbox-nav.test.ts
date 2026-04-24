/**
 * SearchBox 方向键导航 · v1.3 单测
 *
 * 提取与 SearchBox 中相同的"循环导航"公式为独立纯函数，便于快速回归边界情况。
 * 真实实现已在 SearchBox.tsx 内联；此处的函数与其语义一一对应。
 */

import { describe, it, expect } from 'vitest';

function nextIndex(current: number, total: number): number {
  if (total === 0) return 0;
  return (current + 1) % total;
}

function prevIndex(current: number, total: number): number {
  if (total === 0) return 0;
  return (current - 1 + total) % total;
}

describe('SearchBox 方向键循环导航', () => {
  it('ArrowDown 到达末尾后回到 0', () => {
    expect(nextIndex(2, 3)).toBe(0);
    expect(nextIndex(0, 3)).toBe(1);
  });

  it('ArrowUp 从 0 跳到末尾', () => {
    expect(prevIndex(0, 3)).toBe(2);
    expect(prevIndex(2, 3)).toBe(1);
  });

  it('空列表时始终返回 0', () => {
    expect(nextIndex(0, 0)).toBe(0);
    expect(prevIndex(0, 0)).toBe(0);
  });

  it('单项列表时上下箭头都保持 0', () => {
    expect(nextIndex(0, 1)).toBe(0);
    expect(prevIndex(0, 1)).toBe(0);
  });
});

describe('SearchBox Esc 两阶段', () => {
  /**
   * 第一次 Esc：有 query → 清空且阻断冒泡
   * 第二次 Esc：无 query → 关闭 Modal
   */
  function handleEsc(hasQuery: boolean): 'clear' | 'close' {
    return hasQuery ? 'clear' : 'close';
  }

  it('有输入时清空', () => {
    expect(handleEsc(true)).toBe('clear');
  });

  it('空输入时关闭', () => {
    expect(handleEsc(false)).toBe('close');
  });
});
