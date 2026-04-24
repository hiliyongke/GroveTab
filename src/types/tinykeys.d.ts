/**
 * tinykeys 类型补丁
 *
 * 原因：tinykeys 3.x 在 package.json 中配置了 ESM exports，
 * 但 TypeScript `moduleResolution: "bundler"` 仍偶会命中到 ESM 产物
 * 而忽略 `.d.ts`（见 issue microsoft/TypeScript#49160）。
 *
 * 本文件给出最小可用的 shim，仅覆盖项目实际使用的 API。
 */
declare module 'tinykeys' {
  export type KeyBindingHandler = (event: KeyboardEvent) => void;
  export type KeyBindingMap = Record<string, KeyBindingHandler>;
  export interface KeyBindingOptions {
    event?: 'keydown' | 'keyup';
    capture?: boolean;
  }
  export function tinykeys(
    target: Window | HTMLElement | Document,
    keyBindingMap: KeyBindingMap,
    options?: KeyBindingOptions,
  ): () => void;
}
