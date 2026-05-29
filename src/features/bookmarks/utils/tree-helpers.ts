/**
 * 书签树辅助函数
 *
 * 提取自 BookmarkTreeView.tsx，用于树形数据处理和节点渲染
 */

import type { BookmarkNode } from "@/chrome/bookmarks";

/** 从 URL 提取 hostname */
export function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** 取首字母作为 favicon 回退 */
export function getFallbackLetter(title: string, url: string): string {
  if (title) return title.charAt(0).toUpperCase();
  try {
    return new URL(url).hostname.charAt(0).toUpperCase();
  } catch {
    return "?";
  }
}

/** 递归统计书签数 */
export function countBookmarks(nodes: BookmarkNode[] | undefined): number {
  if (!nodes) return 0;
  return nodes.reduce((sum, n) => {
    if (n.url) return sum + 1;
    return sum + countBookmarks(n.children);
  }, 0);
}

/** 排序：文件夹优先，然后是书签，保持 Chrome 默认顺序 */
export function sortChildrenByType<T extends { url?: string }>(children: T[]): T[] {
  const folders = children.filter((c) => !c.url);
  const links = children.filter((c) => !!c.url);
  return [...folders, ...links];
}
