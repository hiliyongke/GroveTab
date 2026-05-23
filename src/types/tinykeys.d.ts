/**
 * tinykeys 类型补丁
 *
 * 原因：tinykeys 3.x 在 package.json 中配置了 ESM exports，
 * 但 TypeScript `moduleResolution: "bundler"` 仍偶会命中到 ESM 产物
 * 而忽略 `.d.ts`（见 issue microsoft/TypeScript#49160）。
 *
 * 本文件给出最小可用的 shim，仅覆盖项目实际使用的 API。
 * @param target
 * @param keyBindingMap
 * @param options
 */
declare module 'tinykeys' {
  export type KeyBindingHandler = (event: KeyboardEvent) => void;
  export type KeyBindingMap = Record<string, KeyBindingHandler>;
  export interface KeyBindingOptions {
    event?: 'keydown' | 'keyup';
    capture?: boolean;
  }
  /**
   * 注册键盘快捷键绑定
   * @param target - 绑定目标（window、DOM 元素或 document）
   * @param keyBindingMap - 按键绑定映射表
   * @param options - 可选配置项
   * @returns 清理函数，调用后移除键盘事件监听
   */
  export function tinykeys(
    target: Window | HTMLElement | Document,
    keyBindingMap: KeyBindingMap,
    options?: KeyBindingOptions,
  ): () => void;
}
