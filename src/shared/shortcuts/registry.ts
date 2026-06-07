/**
 * 快捷键统一注册中心
 *
 * 所有快捷键集中在 registry 中维护，支持统一注册与查询。
 *   2. 冲突检测（dev mode 自动告警）
 *   3. 与 Settings → Shortcuts 面板同步
 *
 * Chrome 全局快捷键（Alt+C 等）由 manifest.json commands 控制，
 * 此处仅管理 newtab 页面内快捷键。
 */

import { KEYBINDING_DEFS, type KeybindingAction, type KeybindingDef } from "@/shared/config/keybindings";
import { translate } from "@/shared/i18n/core";

// ── 注册表 ────────────────────────────────────────────────────────────────────

/** 用户自定义快捷键映射 */
let customKeyMap: Partial<Record<KeybindingAction, string>> = {};

/** 注册自定义快捷键（如从 chrome.storage 加载） */
export function setCustomKeybindings(map: Partial<Record<KeybindingAction, string>>): void {
  customKeyMap = map;
  if (import.meta.env.DEV) {
    detectConflicts();
  }
}

/** 获取用户自定义快捷键 */
export function getCustomKeybindings(): Partial<Record<KeybindingAction, string>> {
  return { ...customKeyMap };
}

/** 获取已解析的快捷键定义列表（用户自定义优先） */
export function getResolvedKeybindings(): (KeybindingDef & { resolvedKey: string })[] {
  return KEYBINDING_DEFS.map((def) => ({
    ...def,
    resolvedKey: customKeyMap[def.action] ?? def.defaultKey,
  }));
}

/** 按 action 查找快捷键定义 */
export function getKeybindingDef(action: KeybindingAction): KeybindingDef | undefined {
  return KEYBINDING_DEFS.find((def) => def.action === action);
}

// ── 冲突检测 ─────────────────────────────────────────────────────────────────

/**
 * 检测快捷键冲突（dev mode 自动运行）
 *
 * 同一快捷键绑定到多个 action 时输出 console.warn
 */
export function detectConflicts(): string[] {
  const resolved = getResolvedKeybindings();
  const keyMap = new Map<string, string[]>();

  for (const def of resolved) {
    const key = def.resolvedKey.toLowerCase();
    if (!keyMap.has(key)) keyMap.set(key, []);
    keyMap.get(key)!.push(def.action);
  }

  const conflicts: string[] = [];
  for (const [key, actions] of keyMap) {
    if (actions.length > 1) {
      const msg = `[Shortcuts] ${translate("冲突: \"{key}\" 被绑定到 {actions}", { key, actions: actions.join(", ") })}`;
      if (import.meta.env.DEV) {
        console.warn(msg);
      }
      conflicts.push(msg);
    }
  }

  return conflicts;
}

// ── 初始化 ───────────────────────────────────────────────────────────────────

// Dev mode 启动时自动检测冲突
if (import.meta.env.DEV) {
  detectConflicts();
}
