/**
 * useKeybinding · v1.3 —— 基于 tinykeys 的页面级快捷键
 *
 * 重构前（v1.2）使用手写 parseKeybinding；v1.3 改用 tinykeys（~1 KB gz）：
 *   - 成熟的 `$mod` / `Shift` / `Alt` 修饰键语义
 *   - 标准的 `key` / `code` 规范化处理
 *   - 提供官方 SSR / IME / 多键序列支持
 *
 * 行为兼容：
 *   - 在 input/textarea/contentEditable 聚焦时默认禁用（Esc 例外）
 *   - 支持 Mod+k 形式（自动映射到 tinykeys 的 $mod+KeyK）
 *   - API 完全不变：useKeybinding(action, handler)
 */

import { useEffect } from 'react';
import { tinykeys } from 'tinykeys';
import { KEYBINDING_DEFS, getResolvedKey, type KeybindingAction } from '@/shared/config/keybindings';
import { useSettingsStore } from '@/store';

/**
 * 把既有格式 `Mod+k` / `Mod+Shift+s` / `Escape` 转成 tinykeys 语法：
 *   - `Mod`    → `$mod`
 *   - 单字母   → `Key{X}`（tinykeys 对单字母用 KeyCode 更稳）
 *   - 其他键   → 原样保留（Escape / Enter / Tab 等）
 */
function toTinyKeysPattern(key: string): string {
  const parts = key.split('+').map((p) => p.trim());
  return parts
    .map((p) => {
      const lower = p.toLowerCase();
      if (lower === 'mod') return '$mod';
      if (lower === 'shift') return 'Shift';
      if (lower === 'alt') return 'Alt';
      if (lower === 'ctrl') return 'Control';
      if (lower === 'meta') return 'Meta';
      // 单字母 → KeyX；其他（Escape / Enter / ArrowLeft…）保持大写首字母形式
      if (/^[a-z]$/.test(lower)) return `Key${lower.toUpperCase()}`;
      if (/^[0-9]$/.test(lower)) return `Digit${lower}`;
      // Escape / Enter / Tab / ArrowLeft…
      return p.charAt(0).toUpperCase() + p.slice(1);
    })
    .join('+');
}

/**
 * 是否应当在输入聚焦元素上阻断快捷键。
 */
function shouldBlockInInput(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null;
  if (!target) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

/**
 * 在页面内注册一个快捷键动作。
 */
export function useKeybinding(action: KeybindingAction, handler: () => void): void {
  const customKeybindings = useSettingsStore((s) => s.settings.customKeybindings);

  useEffect(() => {
    const def = KEYBINDING_DEFS.find((d) => d.action === action);
    if (!def) return;

    const keyStr = getResolvedKey(def, customKeybindings ?? {});
    const pattern = toTinyKeysPattern(keyStr);

    const bindingHandler = (e: KeyboardEvent) => {
      // 输入框内默认阻断；Esc / allowInInput 动作例外
      if (!def.allowInInput && shouldBlockInInput(e)) return;
      e.preventDefault();
      handler();
    };

    const unbind = tinykeys(window, {
      [pattern]: bindingHandler,
    });

    return () => unbind();
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
