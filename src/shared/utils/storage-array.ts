/**
 * localStorage 字符串数组安全读写工具
 *
 * 提供类型安全的 localStorage 字符串数组读取和写入，
 * 避免重复实现和 JSON 解析错误。
 */

/**
 * 从 localStorage 安全读取字符串数组。
 *
 * @param key - localStorage 的键名
 * @returns 字符串数组；如果键不存在或解析失败则返回空数组
 *
 * @example
 * ```typescript
 * const items = loadStringArray('recent-searches');
 * // → ["hello", "world"] 或 []
 * ```
 */
export function loadStringArray(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? (parsed as unknown[]).filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

/**
 * 将字符串数组安全写入 localStorage。
 *
 * @param key - localStorage 的键名
 * @param value - 要存储的字符串数组
 *
 * @example
 * ```typescript
 * saveStringArray('recent-searches', ["hello", "world"]);
 * ```
 */
export function saveStringArray(key: string, value: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 静默处理存储失败（如配额超出）
  }
}
