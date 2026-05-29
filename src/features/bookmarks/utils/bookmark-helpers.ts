import type { BookmarkNode } from "@/chrome/bookmarks";

/** 从 URL 提取 hostname 做展示和取色键 */
export function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** 从标题/URL 提取首字母作为 favicon 回退 */
export function getFallbackLetter(title: string, url: string): string {
  if (title) return title.charAt(0).toUpperCase();
  try {
    return new URL(url).hostname.charAt(0).toUpperCase();
  } catch {
    return "?";
  }
}

/**
 * Chrome 默认根级文件夹的 ID 与友好名映射
 * 0: 根  1: 书签栏  2: 其他书签  3: 移动设备书签
 */
export function resolveFolderTitle(
  node: BookmarkNode,
  t: (key: string) => string,
): string {
  if (node.title?.trim()) return node.title;
  switch (node.id) {
    case "1":
      return t("书签栏");
    case "2":
      return t("其他书签");
    case "3":
      return t("移动设备书签");
    default:
      return t("未命名文件夹");
  }
}

/** 递归统计书签总数 */
export function countBookmarks(nodes: BookmarkNode[] | undefined): number {
  if (!nodes) return 0;
  return nodes.reduce((sum, n) => {
    if (n.url) return sum + 1;
    return sum + countBookmarks(n.children);
  }, 0);
}
