/**
 * smart-tags.ts — 基于域名的智能标签归类
 *
 * 简单正则匹配，零网络请求；用于书签"智能分类"快捷过滤。
 *
 * 注意：优先级遵循"先具体后通用"——例如 github.com 同时命中"开发"，
 * 但不会被错误地再打"搜索"标签。
 */

import type { BookmarkNode } from "@/chrome/bookmarks";
import { translate } from "@/shared/i18n/core";

interface TagRule {
  tag: string;
  pattern: RegExp;
}

const TAG_RULES: TagRule[] = [
  { tag: translate("开发"), pattern: /github\.com|gitlab\.com|bitbucket|stackoverflow|npmjs\.com|pypi\.org|crates\.io|stackexchange/i },
  { tag: translate("视频"), pattern: /youtube\.com|bilibili\.com|vimeo|tiktok|twitch|netflix\.com/i },
  { tag: translate("社交"), pattern: /zhihu\.com|weibo\.com|twitter\.com|x\.com|reddit\.com|tieba|quora/i },
  { tag: translate("阅读"), pattern: /medium\.com|substack|dev\.to|hackernoon|\/blog\/|\/article\//i },
  { tag: translate("购物"), pattern: /amazon\.|jd\.com|taobao|tmall|shopify|aliexpress|pdd\.cn/i },
  { tag: translate("文档"), pattern: /docs\.|documentation|api\.|swagger|wiki|learn|tutorial/i },
  { tag: translate("音乐"), pattern: /music\.|spotify|soundcloud|netease|qq\.com.*music/i },
  { tag: translate("设计"), pattern: /figma\.com|dribbble|behance|pinterest|unsplash|pexels/i },
  { tag: translate("邮箱"), pattern: /gmail|outlook|mail\.|protonmail|webmail/i },
  { tag: translate("AI"), pattern: /openai|chatgpt|claude\.ai|gemini|huggingface|cursor\.com|copilot/i },
  { tag: translate("本地"), pattern: /localhost|127\.0\.0\.1|0\.0\.0\.0/ },
];

/**
 * 返回节点命中的所有标签；无命中时返回 ["其他"]。
 */
export function getSmartTags(node: BookmarkNode): string[] {
  if (node.url === undefined) return [];
  const u = node.url.toLowerCase();
  const tags: string[] = [];
  for (const rule of TAG_RULES) {
    if (rule.pattern.test(u)) tags.push(rule.tag);
  }
  return tags.length > 0 ? tags : [translate("其他")];
}

/**
 * 统计各标签命中的书签数量，按数量降序。
 *
 * @returns `[ [tag, nodes[]], ... ]` —— 可直接喂给 map() 渲染
 */
export function groupBySmartTag(
  nodes: BookmarkNode[],
): Array<[string, BookmarkNode[]]> {
  const map = new Map<string, BookmarkNode[]>();
  for (const n of nodes) {
    if (n.url === undefined) continue;
    for (const tag of getSmartTags(n)) {
      const list = map.get(tag);
      if (list !== undefined) list.push(n);
      else map.set(tag, [n]);
    }
  }
  return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
}
