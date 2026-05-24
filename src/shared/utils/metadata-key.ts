/**
 * URL metadata key 归一化工具
 *
 * 统一 metadata store（tags / notes / pins）与搜索模块对 URL 的归一化逻辑，
 * 确保两边对同一条 URL 的 key 计算完全一致。
 */

/**
 * 将 URL 归一化为稳定的 key，用于 tags / notes / pins 的存储索引。
 *
 * 规则：
 *   1. 解析为 URL 对象
 *   2. 清除 hash（# 及其后内容）
 *   3. 去除尾部的 `/`
 *   4. 还原为字符串；若解析失败则原样返回
 *
 * @param url - 原始 URL 字符串
 * @returns    - 归一化后的 key（可用于 Object key 或 Map key）
 *
 * @example
 * ```typescript
 * normalizeMetadataKey('https://example.com/path?a=1#section');
 * // → 'https://example.com/path?a=1'
 *
 * normalizeMetadataKey('https://example.com/path/');
 * // → 'https://example.com/path'
 * ```
 */
export function normalizeMetadataKey(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return url;
  }
}
