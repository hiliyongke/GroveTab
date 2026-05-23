/**
 * DEFAULT_SETTINGS 一致性校验单元测试
 *
 * 确保 storage-repo 的默认设置与 settings-slice store 的初始值一致，
 * 并且所有必填的 UserSettings 字段均有默认值覆盖。
 */
import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '@/repositories/storage-repo';
import type { UserSettings } from '@/shared/types';

// 阻止 repositories 真正读写 chrome.storage
vi.mock('@/chrome', () => ({
  storageGet: vi.fn().mockResolvedValue(undefined),
  storageSet: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/chrome/tabs', () => ({
  storageRemove: vi.fn().mockResolvedValue(undefined),
  storageGetAllKeys: vi.fn().mockResolvedValue([]),
}));

import { useSettingsStore } from '@/store/settings-slice';

describe('DEFAULT_SETTINGS 与 settings-slice 一致性', () => {
  it('store 初始 settings 应与 DEFAULT_SETTINGS 一致', () => {
    const storeSettings = useSettingsStore.getState().settings;
    expect(storeSettings).toEqual(DEFAULT_SETTINGS);
  });

  it('DEFAULT_SETTINGS 应覆盖所有 UserSettings 必填字段', () => {
    const requiredKeys: (keyof UserSettings)[] = [
      'overrideNewTab',
      'defaultView',
      'theme',
      'gradientPreset',
      'showIncognito',
      'language',
    ];

    for (const key of requiredKeys) {
      expect(DEFAULT_SETTINGS[key]).toBeDefined();
    }
  });

  it('DEFAULT_SETTINGS 的 uiVisibility 应包含所有子字段默认值', () => {
    const { uiVisibility } = DEFAULT_SETTINGS;
    expect(uiVisibility).toBeDefined();
    expect(uiVisibility.header).toBe(true);
    expect(uiVisibility.heroLogo).toBe(true);
    expect(uiVisibility.heroTitle).toBe(true);
    expect(uiVisibility.heroSlogan).toBe(true);
    expect(uiVisibility.heroSearch).toBe(true);
    expect(uiVisibility.viewSwitcher).toBe(true);
    expect(uiVisibility.tidySuggestion).toBe(true);
    expect(uiVisibility.quickStart).toBe(true);
  });

  it('DEFAULT_SETTINGS 的搜索相关字段应有合理默认值', () => {
    expect(DEFAULT_SETTINGS.searchScope).toEqual(['title', 'hostname', 'url']);
    expect(DEFAULT_SETTINGS.searchEnablePinyin).toBe(true);
    expect(DEFAULT_SETTINGS.searchSortBy).toBe('relevance');
    expect(DEFAULT_SETTINGS.searchDefaultEngine).toBe('bing');
    expect(DEFAULT_SETTINGS.searchAutoFallbackToWeb).toBe(true);
  });

  it('DEFAULT_SETTINGS 的历史记录字段应有合理默认值', () => {
    expect(DEFAULT_SETTINGS.historyEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.historyRecordEvents).toBe(true);
    expect(DEFAULT_SETTINGS.historyMaxClosedTabs).toBe(50);
    expect(DEFAULT_SETTINGS.historyMaxEvents).toBe(500);
    expect(DEFAULT_SETTINGS.historyClosedTabsTtlHours).toBe(168);
    expect(DEFAULT_SETTINGS.historyUrlBlocklist).toEqual([]);
  });

  it('DEFAULT_SETTINGS 不应包含 undefined 值', () => {
    function checkNoUndefined(obj: Record<string, unknown>, path = ''): void {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          checkNoUndefined(value as Record<string, unknown>, currentPath);
        } else {
          expect(value).not.toBeUndefined();
        }
      }
    }
    checkNoUndefined(DEFAULT_SETTINGS as unknown as Record<string, unknown>);
  });
});
