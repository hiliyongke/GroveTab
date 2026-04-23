/**
 * useKeybinding — 页面内快捷键 hook
 *
 * 根据 KEYBINDING_DEFS 注册表 + 用户自定义配置，
 * 在 newtab 页面内注册全局 keydown 监听器。
 *
 * 用法：
 *   useKeybinding('search', () => setShowSearch(true));
 *   useKeybinding('exitSelection', () => selectionStore.exitSelectionMode());
 */

import { useEffect } from 'react';
import { KEYBINDING_DEFS, parseKeybinding, getResolvedKey, type KeybindingAction } from '@/shared/config/keybindings';
import { useSettingsStore } from '@/store';

/**
 * 在页面内注册一个快捷键动作
 *
 * @param action  快捷键动作标识
 * @param handler 命中时执行的回调
 */
export function useKeybinding(action: KeybindingAction, handler: () => void): void {
  const customKeybindings = useSettingsStore((s) => s.settings.customKeybindings);

  useEffect(() => {
    const def = KEYBINDING_DEFS.find((d) => d.action === action);
    if (!def) return;

    const keyStr = getResolvedKey(def, customKeybindings ?? {});
    const matcher = parseKeybinding(keyStr);

    const onKeyDown = (e: KeyboardEvent) => {
      // 输入框内默认不触发（除非 allowInInput）
      if (!def.allowInInput) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
      }

      if (matcher(e)) {
        e.preventDefault();
        handler();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [action, handler, customKeybindings]);
}

/**
 * 获取当前所有快捷键的解析结果（供 ShortcutsPanel 消费）
 */
export function useResolvedKeybindings(): Array<{
  action: KeybindingAction;
  label: string;
  hint?: string;
  keys: string;
  isCustom: boolean;
}> {
  const customKeybindings = useSettingsStore((s) => s.settings.customKeybindings);

  return KEYBINDING_DEFS.map((def) => {
    const custom = customKeybindings ?? {};
    const keys = getResolvedKey(def, custom);
    return {
      action: def.action,
      label: def.labelKey,
      hint: def.hintKey,
      keys,
      isCustom: custom[def.action] !== undefined,
    };
  });
}
