/**
 * 搜索高亮纯逻辑
 *
 * 将文本按搜索词拆分为 token 列表，由调用方负责渲染。
 * 这样拆分后，匹配逻辑可以独立编写单元测试。
 */

export interface HighlightToken {
  /** 文本片段 */
  text: string;
  /** 是否匹配搜索词 */
  match: boolean;
}

/**
 * 对文本中的命中片段做高亮，返回 token 列表。
 *
 * @param text - 原始文本
 * @param query - 搜索词
 * @returns  token 列表，每个 token 包含文本和是否匹配
 *
 * @example
 * ```typescript
 * const tokens = tokenizeHighlight("Hello World", "world");
 * // → [{ text: "Hello ", match: false }, { text: "World", match: true }]
 * ```
 */
export function tokenizeHighlight(text: string, query: string): HighlightToken[] {
  const normalizedQuery = query.trim();
  if (normalizedQuery === "" || text === "") {
    return [{ text, match: false }];
  }

  const escaped = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matcher = new RegExp(`(${escaped})`, "ig");
  const parts = text.split(matcher);

  return parts.map((part) => {
    const matched =
      part.localeCompare(normalizedQuery, undefined, { sensitivity: "accent" }) === 0 ||
      part.toLowerCase() === normalizedQuery.toLowerCase();

    return { text: part, match: matched };
  });
}
