/**
 * 搜索查询语法解析器（需求 3.2）
 *
 * 支持以下查询语法：
 *   site:github.com      限定域名
 *   in:archive           限定范围为归档
 *   in:bookmark          限定范围为书签
 *   in:history           限定范围为历史
 *   in:tab               限定范围为标签页（默认）
 *   has:note             含有备注（预留）
 *   tag:react            标签过滤
 *
 * 多个修饰符可组合使用，例如：
 *   site:github.com in:archive react
 */

export type SearchScope = "tab" | "archive" | "bookmark" | "history" | "all";

export interface ParsedQuery {
  /** 纯文本搜索词（去除所有修饰符后的部分） */
  text: string;
  /** 限定域名（site: 修饰符） */
  site?: string;
  /** 限定范围（in: 修饰符） */
  scope?: SearchScope;
  /** 标签过滤（tag: 修饰符） */
  tag?: string;
  /** 是否要求含有备注（has:note） */
  hasNote?: boolean;
  /** 原始查询字符串 */
  raw: string;
}

/**
 * 解析搜索查询字符串，提取修饰符并返回结构化结果。
 *
 * 注意：正则必须在函数内部创建，不能使用带 g 标志的模块级常量，
 * 否则多次调用时 lastIndex 状态残留会导致匹配结果不稳定。
 */
export function parseSearchQuery(raw: string): ParsedQuery {
  let text = raw;

  // site:
  let site: string | undefined;
  text = text.replace(/\bsite:(\S+)/gi, (_, s: string) => {
    site = s.toLowerCase();
    return "";
  });

  // in:
  let scope: SearchScope | undefined;
  text = text.replace(/\bin:(archive|bookmark|history|tab|all)\b/gi, (_, s: string) => {
    scope = s.toLowerCase() as SearchScope;
    return "";
  });

  // tag:
  let tag: string | undefined;
  text = text.replace(/\btag[:：]\s*(\S+)/gi, (_, t: string) => {
    tag = t;
    return "";
  });

  // has:note
  let hasNote: boolean | undefined;
  text = text.replace(/\bhas:note\b/gi, () => {
    hasNote = true;
    return "";
  });

  // 清理多余空格
  text = text.replace(/\s+/g, " ").trim();

  return { text, site, scope, tag, hasNote, raw };
}

/**
 * 判断 URL 是否匹配 site: 过滤条件。
 */
export function matchesSite(url: string, site: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === site || hostname.endsWith(`.${site}`);
  } catch {
    return false;
  }
}
