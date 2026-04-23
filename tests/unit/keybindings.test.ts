/**
 * keybindings 模块单元测试
 */

import { describe, it, expect } from 'vitest';
import { parseKeybinding, getResolvedKey, KEYBINDING_DEFS, type KeybindingMap } from '@/shared/config/keybindings';

describe('parseKeybinding', () => {
  it('匹配单键 Escape', () => {
    const matcher = parseKeybinding('Escape');
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    expect(matcher(event)).toBe(true);
  });

  it('匹配 Mod+k（macOS 用 metaKey）', () => {
    const matcher = parseKeybinding('Mod+k');
    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
    expect(matcher(event)).toBe(true);
  });

  it('匹配 Mod+k（非 macOS 用 ctrlKey）', () => {
    const matcher = parseKeybinding('Mod+k');
    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
    expect(matcher(event)).toBe(true);
  });

  it('不匹配无修饰键的 k', () => {
    const matcher = parseKeybinding('Mod+k');
    const event = new KeyboardEvent('keydown', { key: 'k' });
    expect(matcher(event)).toBe(false);
  });

  it('不匹配错误的修饰键组合', () => {
    const matcher = parseKeybinding('Mod+k');
    const event = new KeyboardEvent('keydown', { key: 'k', altKey: true });
    expect(matcher(event)).toBe(false);
  });

  it('匹配 Mod+Shift+s', () => {
    const matcher = parseKeybinding('Mod+Shift+s');
    const event = new KeyboardEvent('keydown', { key: 's', metaKey: true, shiftKey: true });
    expect(matcher(event)).toBe(true);
  });

  it('不匹配缺少 Shift 的 Mod+s', () => {
    const matcher = parseKeybinding('Mod+Shift+s');
    const event = new KeyboardEvent('keydown', { key: 's', metaKey: true });
    expect(matcher(event)).toBe(false);
  });
});

describe('getResolvedKey', () => {
  it('返回默认值当无自定义', () => {
    const def = KEYBINDING_DEFS.find((d) => d.action === 'search')!;
    const result = getResolvedKey(def, {});
    expect(result).toBe('Mod+k');
  });

  it('返回自定义值当有覆盖', () => {
    const def = KEYBINDING_DEFS.find((d) => d.action === 'search')!;
    const custom: KeybindingMap = { search: 'Mod+Shift+f' };
    const result = getResolvedKey(def, custom);
    expect(result).toBe('Mod+Shift+f');
  });

  it('忽略其他动作的自定义', () => {
    const def = KEYBINDING_DEFS.find((d) => d.action === 'search')!;
    const custom: KeybindingMap = { exitSelection: 'Mod+Escape' };
    const result = getResolvedKey(def, custom);
    expect(result).toBe('Mod+k'); // 不受影响
  });
});
