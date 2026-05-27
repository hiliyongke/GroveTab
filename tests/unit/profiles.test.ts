/**
 * profiles 模块单元测试
 *
 * 注：由于 chrome.storage API 在 vitest 中不可用，
 * 此处仅测试纯逻辑函数；集成测试依赖真实 Chrome 环境。
 */

import { describe, it, expect } from 'vitest';
import type { SettingsProfile } from '@/shared/utils/profiles';

describe('SettingsProfile 类型约束', () => {
  it('符合结构约束', () => {
    const profile: SettingsProfile = {
      id: 'abc123',
      name: '工作模式',
      createdAt: Date.now(),
      settings: { theme: 'dark', defaultView: 'tabs' },
    };
    expect(profile.id).toBe('abc123');
    expect(profile.name).toBe('工作模式');
    expect(profile.settings.theme).toBe('dark');
  });

  it('settings 为 Partial<UserSettings>', () => {
    const profile: SettingsProfile = {
      id: 'def456',
      name: '极简',
      createdAt: Date.now(),
      settings: { gradientPreset: 'deepspace' },
    };
    expect(profile.settings.gradientPreset).toBe('deepspace');
    // 其他字段为 undefined（Partial 语义）
    expect(profile.settings.theme).toBeUndefined();
  });
});
