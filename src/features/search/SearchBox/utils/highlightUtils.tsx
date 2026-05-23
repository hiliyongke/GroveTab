/**
 * 文本高亮相关工具函数
 */
import type { ReactNode } from "react";

interface HighlightOptions {
  highlightClassName?: string;
}

/**
 * 对文本中的命中片段做高亮
 *
 * 在文本中找到与查询匹配的部分，用 <mark> 标签高亮显示。
 *
 * @param text - 原始文本
 * @param query - 搜索查询字符串
 * @param keyPrefix - 唯一前缀，用于生成稳定的 React key
 * @param options - 可选配置（如自定义高亮类名）
 * @returns 高亮后的 React 节点
 */
export function renderHighlightedText(
  text: string,
  query: string,
  keyPrefix: string,
  options?: HighlightOptions,
): ReactNode {
  const normalizedQuery = query.trim();
  if (normalizedQuery === "" || text === "") return text;

  const highlightClass = options?.highlightClassName ?? "search-box-highlight";
  const escaped = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matcher = new RegExp(`(${escaped})`, "ig");
  const parts = text.split(matcher);

  return parts.map((part, index) => {
    const matched =
      part.localeCompare(normalizedQuery, undefined, { sensitivity: "accent" }) === 0 ||
      part.toLowerCase() === normalizedQuery.toLowerCase();

    return matched ? (
      <mark key={`${keyPrefix}-${index}`} className={highlightClass}>
        {part}
      </mark>
    ) : (
      part
    );
  });
}
