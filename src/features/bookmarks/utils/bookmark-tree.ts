/**
 * bookmark-tree.ts — 书签树操作工具
 *
 * 集中放统计/搜索/展平等纯函数，避免污染视图组件。
 */

import type { BookmarkNode } from "@/chrome/bookmarks";

/** 树形结构的扁平项（含路径与深度） */
export interface FlatItem {
  node: BookmarkNode;
  path: string;
  depth: number;
}

/**
 * 统计书签总数与文件夹数。
 *
 * @returns `{ total, folders }` —— 仅叶子（带 URL）计入 total
 */
export function countBookmarks(nodes: BookmarkNode[]): { total: number; folders: number } {
  let total = 0;
  let folders = 0;
  for (const n of nodes) {
    if (n.url) total++;
    else folders++;
    if (n.children) {
      const c = countBookmarks(n.children);
      total += c.total;
      folders += c.folders;
    }
  }
  return { total, folders };
}

/**
 * 递归搜索书签树：title 或 url 命中（大小写不敏感）。
 *
 * 返回的列表保留原树层级顺序，包含匹配项以及承载匹配项的文件夹祖先。
 * 调用方需自行根据 n.url 判断是书签还是文件夹。
 */
export function searchTree(nodes: BookmarkNode[], query: string): BookmarkNode[] {
  const q = query.toLowerCase();
  const results: BookmarkNode[] = [];
  for (const n of nodes) {
    const hit =
      n.title.toLowerCase().includes(q) ||
      (n.url !== undefined && n.url.toLowerCase().includes(q));
    if (hit && n.url !== undefined) results.push(n);
    if (!hit && n.children) {
      const childMatch = searchTree(n.children, q);
      if (childMatch.length > 0) results.push(n, ...childMatch);
    } else if (n.children) {
      results.push(...searchTree(n.children, q));
    }
  }
  return results;
}

/**
 * 将树展平为带深度与面包屑路径的列表。
 *
 * 用于"搜索结果"和"全选"场景。
 */
export function buildFlatList(
  nodes: BookmarkNode[],
  parentPath = "",
  depth = 0,
): FlatItem[] {
  const r: FlatItem[] = [];
  for (const n of nodes) {
    r.push({ node: n, path: parentPath, depth });
    if (n.children) {
      r.push(...buildFlatList(n.children, `${parentPath} > ${n.title}`, depth + 1));
    }
  }
  return r;
}

/**
 * 把 URL 转成 Chrome 提供的 favicon 服务地址。
 *
 * 解析失败返回空串（避免组件层重复 try/catch）。
 */
export function getFaviconUrl(url: string): string {
  try {
    return `chrome://favicon/${new URL(url).hostname}`;
  } catch {
    return "";
  }
}

/**
 * 判断书签节点是否为文件夹。
 */
export function isFolder(node: BookmarkNode): boolean {
  return node.url === undefined;
}

/**
 * 收集所有带 URL 的书签节点（用于失效链接检测等批量操作）。
 */
export function collectUrlBookmarks(nodes: BookmarkNode[]): BookmarkNode[] {
  const result: BookmarkNode[] = [];
  const walk = (arr: BookmarkNode[]): void => {
    for (const n of arr) {
      if (n.url !== undefined) result.push(n);
      if (n.children) walk(n.children);
    }
  };
  walk(nodes);
  return result;
}
