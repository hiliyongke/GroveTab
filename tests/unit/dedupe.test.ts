/**
 * 去重工具函数单元测试
 */
import { describe, it, expect } from 'vitest';
import { findDuplicates } from '@/shared/utils/dedupe';
import type { LiveTab } from '@/shared/types';

/** 构建测试用 LiveTab 的工厂函数 */
function makeTab(overrides: Partial<LiveTab> & { id: number; url: string; title: string }): LiveTab {
  return {
    windowId: 1,
    incognito: false,
    pinned: false,
    audible: false,
    groupId: -1,
    lastAccessed: Date.now(),
    hostname: new URL(overrides.url).hostname,
    isCurrentWindow: true,
    discarded: false,
    favIconUrl: '',
    ...overrides,
  };
}

describe('findDuplicates', () => {
  it('应在无重复时返回空数组', () => {
    const tabs = [
      makeTab({ id: 1, url: 'https://a.com/1', title: 'A1' }),
      makeTab({ id: 2, url: 'https://b.com/2', title: 'B2' }),
    ];
    expect(findDuplicates(tabs)).toHaveLength(0);
  });

  it('应检测完全相同的 URL 为重复', () => {
    const tabs = [
      makeTab({ id: 1, url: 'https://example.com/page', title: 'P1' }),
      makeTab({ id: 2, url: 'https://example.com/page', title: 'P2' }),
    ];
    const dupes = findDuplicates(tabs);
    expect(dupes).toHaveLength(1);
    expect(dupes[0].tabs).toHaveLength(2);
  });

  it('应忽略 hash 差异视为同一 URL', () => {
    const tabs = [
      makeTab({ id: 1, url: 'https://example.com/page#section1', title: 'S1' }),
      makeTab({ id: 2, url: 'https://example.com/page#section2', title: 'S2' }),
    ];
    const dupes = findDuplicates(tabs);
    expect(dupes).toHaveLength(1);
  });

  it('应剥离跟踪参数（utm_*, fbclid 等）后判断重复', () => {
    const tabs = [
      makeTab({ id: 1, url: 'https://example.com/page?utm_source=google', title: 'U1' }),
      makeTab({ id: 2, url: 'https://example.com/page?fbclid=abc', title: 'U2' }),
    ];
    const dupes = findDuplicates(tabs);
    expect(dupes).toHaveLength(1);
  });

  it('应保留非跟踪参数的区分', () => {
    const tabs = [
      makeTab({ id: 1, url: 'https://example.com/page?id=1', title: 'I1' }),
      makeTab({ id: 2, url: 'https://example.com/page?id=2', title: 'I2' }),
    ];
    expect(findDuplicates(tabs)).toHaveLength(0);
  });

  it('应合并多组重复', () => {
    const tabs = [
      makeTab({ id: 1, url: 'https://a.com/x', title: 'A' }),
      makeTab({ id: 2, url: 'https://a.com/x', title: 'A2' }),
      makeTab({ id: 3, url: 'https://b.com/y', title: 'B' }),
      makeTab({ id: 4, url: 'https://b.com/y', title: 'B2' }),
      makeTab({ id: 5, url: 'https://c.com/z', title: 'C' }),
    ];
    const dupes = findDuplicates(tabs);
    expect(dupes).toHaveLength(2);
  });

  // v1.0 封板：strictness 三档
  it("strict 模式下 ?page=1 和 ?page=2 不算重复（原本 loose 也不算，这里确保 strict 的 utm 被保留）", () => {
    const tabs = [
      makeTab({ id: 1, url: 'https://example.com/?utm_source=a', title: 'A' }),
      makeTab({ id: 2, url: 'https://example.com/?utm_source=b', title: 'B' }),
    ];
    expect(findDuplicates(tabs, 'strict')).toHaveLength(0);
    expect(findDuplicates(tabs, 'loose')).toHaveLength(1);
  });

  it("off 模式返回空数组", () => {
    const tabs = [
      makeTab({ id: 1, url: 'https://example.com/', title: 'A' }),
      makeTab({ id: 2, url: 'https://example.com/', title: 'B' }),
    ];
    expect(findDuplicates(tabs, 'off')).toHaveLength(0);
  });
});
