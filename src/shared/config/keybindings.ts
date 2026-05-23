/**
 * 快捷键配置中心
 *
 * 定义所有页面内可自定义快捷键的元数据和默认值。
 * Chrome 全局快捷键（Alt+C 等）由 manifest.json 控制，无法在页面内修改；
 * 此处仅管理 newtab 页面内的快捷键绑定。
 */

/** 快捷键动作标识符 */
export type KeybindingAction =
  | 'search'
  | 'exitSelection'
  | 'selectAll';

/** 单条快捷键绑定定义 */
export interface KeybindingDef {
  /** 动作标识 */
  action: KeybindingAction;
  /** 默认快捷键（修饰键+键名，如 'Mod+k'） */
  defaultKey: string;
  /** 显示用的 i18n key */
  labelKey: string;
  /** 可选的提示 i18n key */
  hintKey?: string;
  /** 是否允许在输入框内触发（默认 false） */
  allowInInput?: boolean;
}

/**
 * 快捷键定义注册表
 *
 * 新增快捷键只需在此添加一条定义，ShortcutsPanel 和 useKeybinding 自动同步。
 */
export const KEYBINDING_DEFS: KeybindingDef[] = [
  {
    action: 'search',
    defaultKey: 'Mod+k',
    labelKey: 'shortcuts.localSearch',
    hintKey: 'shortcuts.localSearchHint',
  },
  {
    action: 'exitSelection',
    defaultKey: 'Escape',
    labelKey: 'shortcuts.exitSelection',
    hintKey: 'shortcuts.exitSelectionHint',
    allowInInput: true,
  },
  {
    action: 'selectAll',
    defaultKey: 'Mod+a',
    labelKey: 'shortcuts.selectAll',
    hintKey: 'shortcuts.selectAllHint',
  },
];

/** 用户自定义快捷键映射（action → 快捷键字符串） */
export type KeybindingMap = Partial<Record<KeybindingAction, string>>;

/**
 * 解析快捷键字符串为匹配函数
 *
 * 支持的格式：
 *   - 'Mod+k'：Mod 代表 Cmd（macOS）或 Ctrl（其他）
 *   - 'Escape'：单键
 *   - 'Mod+Shift+s'：多修饰键
 *
 * @param key - 快捷键字符串（如 'Mod+k'、'Escape'）
 * @returns 返回匹配函数，接收 KeyboardEvent 并返回是否匹配
 */
export function parseKeybinding(key: string): (e: KeyboardEvent) => boolean {
  const parts = key.split('+').map((p) => p.trim().toLowerCase());
  const requiresMod = parts.includes('mod');
  const requiresShift = parts.includes('shift');
  const requiresAlt = parts.includes('alt');
  const mainKey = parts.find((p) => !['mod', 'shift', 'alt'].includes(p)) ?? '';

  return (e: KeyboardEvent) => {
    const modPressed = e.metaKey || e.ctrlKey;
    if (requiresMod && !modPressed) return false;
    if (!requiresMod && modPressed && mainKey !== 'escape') return false;
    if (requiresShift && !e.shiftKey) return false;
    if (!requiresShift && e.shiftKey && mainKey !== 'escape') return false;
    if (requiresAlt && !e.altKey) return false;
    if (!requiresAlt && e.altKey) return false;
    return e.key.toLowerCase() === mainKey || e.code.toLowerCase() === mainKey;
  };
}

/**
 * 获取某动作的解析后快捷键（用户自定义优先，否则用默认值）
 *
 * @param def - 快捷键定义对象
 * @param custom - 用户自定义快捷键映射
 * @returns 解析后的快捷键字符串
 */
export function getResolvedKey(def: KeybindingDef, custom: KeybindingMap): string {
  return custom[def.action] ?? def.defaultKey;
}
