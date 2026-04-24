import { describe, it, expect } from 'vitest';
import { detectIdleTabs, formatIdleTime } from '@/shared/utils/idle-detect';
import type { LiveTab } from '@/shared/types';

function mkTab(overrides: Partial<LiveTab>): LiveTab {
  const now = Date.now();
  return {
    id: 1,
    windowId: 1,
    title: 'demo',
    url: 'https://example.com/',
    favIconUrl: '',
    hostname: 'example.com',
    active: false,
    pinned: false,
    audible: false,
    mutedInfo: { muted: false },
    discarded: false,
    incognito: false,
    status: 'complete',
    index: 0,
    lastAccessed: now,
    ...overrides,
  };
}

describe('detectIdleTabs with custom threshold', () => {
  it('honors default 24h threshold', () => {
    const tabs = [
      mkTab({ id: 1, lastAccessed: Date.now() - 25 * 3600 * 1000 }),
      mkTab({ id: 2, lastAccessed: Date.now() - 1 * 3600 * 1000 }),
    ];
    const idle = detectIdleTabs(tabs);
    expect(idle).toHaveLength(1);
    expect(idle[0].tab.id).toBe(1);
    expect(idle[0].level).toBe('idle');
  });

  it('honors 6h override', () => {
    const tabs = [
      mkTab({ id: 1, lastAccessed: Date.now() - 7 * 3600 * 1000 }),
      mkTab({ id: 2, lastAccessed: Date.now() - 1 * 3600 * 1000 }),
    ];
    const idle = detectIdleTabs(tabs, 360); // 6h
    expect(idle).toHaveLength(1);
    expect(idle[0].tab.id).toBe(1);
  });

  it('skips pinned tabs', () => {
    const tabs = [
      mkTab({ id: 1, pinned: true, lastAccessed: Date.now() - 48 * 3600 * 1000 }),
    ];
    expect(detectIdleTabs(tabs)).toHaveLength(0);
  });

  it('skips discarded tabs', () => {
    const tabs = [
      mkTab({ id: 1, discarded: true, lastAccessed: Date.now() - 48 * 3600 * 1000 }),
    ];
    expect(detectIdleTabs(tabs)).toHaveLength(0);
  });

  it('marks stale after 7 days', () => {
    const tabs = [
      mkTab({ id: 1, lastAccessed: Date.now() - 10 * 24 * 3600 * 1000 }),
    ];
    const idle = detectIdleTabs(tabs);
    expect(idle[0].level).toBe('stale');
  });

  it('sorts stale before idle', () => {
    const tabs = [
      mkTab({ id: 1, lastAccessed: Date.now() - 30 * 3600 * 1000 }),
      mkTab({ id: 2, lastAccessed: Date.now() - 30 * 24 * 3600 * 1000 }),
    ];
    const idle = detectIdleTabs(tabs);
    expect(idle[0].level).toBe('stale');
    expect(idle[0].tab.id).toBe(2);
  });
});

describe('formatIdleTime', () => {
  it('hours', () => expect(formatIdleTime(24)).toMatch(/24/));
  it('days', () => expect(formatIdleTime(72)).toMatch(/天/));
  it('weeks', () => expect(formatIdleTime(24 * 21)).toMatch(/周/));
});
