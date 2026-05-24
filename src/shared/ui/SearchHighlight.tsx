/**
 * SearchHighlight —— 搜索高亮渲染组件。
 *
 * 使用 search-highlight 纯函数进行 token 化，然后渲染 <mark> 高亮。
 */

import type { HighlightToken } from "@/shared/utils/search-highlight";
import { tokenizeHighlight } from "@/shared/utils/search-highlight";
import styles from "./SearchHighlight.module.less";

interface SearchHighlightProps {
  /** 原始文本 */
  text: string;
  /** 搜索词 */
  query: string;
  /** 唯一前缀，用于生成稳定的 React key */
  keyPrefix: string;
}

/**
 * 默认渲染函数：匹配片段用 <mark> 包裹。
 */
function defaultRenderToken(
  token: HighlightToken,
  index: number,
  keyPrefix: string,
): React.ReactNode {
  return token.match ? (
    <mark key={`${keyPrefix}-${index}`} className={styles["search-highlight"]}>
      {token.text}
    </mark>
  ) : (
    token.text
  );
}

/**
 * 搜索高亮组件。
 *
 * @example
 * ```tsx
 * <SearchHighlight text="Hello World" query="world" keyPrefix="item-1" />
 * ```
 */
export function SearchHighlight({
  text,
  query,
  keyPrefix,
  renderToken = defaultRenderToken,
}: SearchHighlightProps & {
  /** 自定义 token 渲染函数（可选） */
  renderToken?: (token: HighlightToken, index: number, keyPrefix: string) => React.ReactNode;
}) {
  const tokens = tokenizeHighlight(text, query);

  if (tokens.length === 1 && !tokens[0]!.match) {
    return <>{tokens[0]!.text}</>;
  }

  return <>{tokens.map((token, index) => renderToken(token, index, keyPrefix))}</>;
}
