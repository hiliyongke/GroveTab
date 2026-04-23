/**
 * 域名分组工具函数单元测试
 */
import { describe, it, expect } from 'vitest';
import { groupTabsByDomain, getGroupFavicon } from '@/shared/utils/domain';
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
    hostname: (() => { try { return new URL(overrides.url).hostname; } catch { return ''; } })(),
    isCurrentWindow: true,
    discarded: false,
    favIconUrl: '',
    ...overrides,
  };
}

describe('groupTabsByDomain', () => {
  it('应在空列表时返回空数组', () => {
    expect(groupTabsByDomain([])).toEqual([]);
  });

  it('应按 hostname 聚合相同域名的标签', () => {
    const tabs = [
      makeTab({ id: 1, url: 'https://docs.google.com/doc1', title: 'D1' }),
      makeTab({ id: 2, url: 'https://docs.google.com/doc2', title: 'D2' }),
      makeTab({ id: 3, url: 'https://mail.google.com/inbox', title: 'M1' }),
    ];
    const groups = groupTabsByDomain(tabs);
    expect(groups).toHaveLength(2);
    const docsGroup = groups.find((g) => g.domain === 'docs.google.com');
    expect(docsGroup?.tabs).toHaveLength(2);
  });

  it('应将同注册域的子域设为相同 colorKey', () => {
    const tabs = [
      makeTab({ id: 1, url: 'https://docs.google.com/a', title: 'A' }),
      makeTab({ id: 2, url: 'https://mail.google.com/b', title: 'B' }),
    ];
    const groups = groupTabsByDomain(tabs);
    const docsGroup = groups.find((g) => g.domain === 'docs.google.com');
    const mailGroup = groups.find((g) => g.domain === 'mail.google.com');
    expect(docsGroup?.colorKey).toBe(mailGroup?.colorKey);
  });

  it('应按 tab 数量降序排列分组', () => {
    const tabs = [
      makeTab({ id: 1, url: 'https://a.com/1', title: 'A1' }),
      makeTab({ id: 2, url: 'https://b.com/1', title: 'B1' }),
      makeTab({ id: 3, url: 'https://b.com/2', title: 'B2' }),
      makeTab({ id: 4, url: 'https://b.com/3', title: 'B3' }),
    ];
    const groups = groupTabsByDomain(tabs);
    expect(groups[0].domain).toBe('b.com');
    expect(groups[0].tabs).toHaveLength(3);
  });
});

describe('getGroupFavicon', () => {
  it('应返回第一个 tab 的 favicon', () => {
    const tabs = [
      makeTab({ id: 1, url: 'https://x.com/1', title: 'X', favIconUrl: 'https://x.com/icon.png' }),
      makeTab({ id: 2, url: 'https://x.com/2', title: 'Y', favIconUrl: 'https://x.com/other.png' }),
    ];
    expect(getGroupFavicon(tabs)).toBe('https://x.com/icon.png');
  });

  it('应在空数组时返回空字符串', () => {
    expect(getGroupFavicon([])).toBe('');
  });
});
