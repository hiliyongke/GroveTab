/**
 * Chrome Bookmarks API 封装
 *
 * 需要 `bookmarks` optional permission。
 * 在用户首次使用书签功能时通过 `chrome.permissions.request()` 动态申请。
 * 所有 API 经 safeCall 包装，失败时返回空数组/undefined。
 */

import { safeCall } from './tabs'; // 复用 safeCall 逻辑

/** 书签树节点（简化版，只保留必要字段） */
export interface BookmarkNode {
  id: string;
  title: string;
  url?: string;
  parentId?: string;
  children?: BookmarkNode[];
}

/**
 * 获取书签树
 *
 * 返回完整的书签树结构。若未获取权限则返回空数组。
 */
export async function getBookmarkTree(): Promise<BookmarkNode[]> {
  try {
    const tree = await safeCall('bookmarks.getTree', () => chrome.bookmarks.getTree());
    return tree as unknown as BookmarkNode[];
  } catch {
    return [];
  }
}

/**
 * 获取最近添加的书签
 */
export async function getRecentBookmarks(maxResults: number = 50): Promise<BookmarkNode[]> {
  try {
    const bookmarks = await safeCall('bookmarks.getRecent', () =>
      chrome.bookmarks.getRecent(maxResults),
    );
    return bookmarks as unknown as BookmarkNode[];
  } catch {
    return [];
  }
}

/**
 * 搜索书签
 */
export async function searchBookmarks(query: string): Promise<BookmarkNode[]> {
  if (!query.trim()) return [];
  try {
    const results = await safeCall('bookmarks.search', () =>
      chrome.bookmarks.search(query),
    );
    return results as unknown as BookmarkNode[];
  } catch {
    return [];
  }
}

/**
 * 创建书签
 */
export async function createBookmark(bookmark: { parentId?: string; title?: string; url?: string }): Promise<BookmarkNode | null> {
  try {
    const result = await safeCall('bookmarks.create', () =>
      chrome.bookmarks.create(bookmark),
    );
    return result as unknown as BookmarkNode;
  } catch {
    return null;
  }
}

/**
 * 请求书签权限（optional permission 动态申请）
 */
export async function requestBookmarksPermission(): Promise<boolean> {
  try {
    return await chrome.permissions.request({ permissions: ['bookmarks'] });
  } catch {
    return false;
  }
}

/**
 * 检查是否已有书签权限
 */
export async function hasBookmarksPermission(): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ permissions: ['bookmarks'] });
  } catch {
    return false;
  }
}

/**
 * 展平书签树为 URL 列表
 */
export function flattenBookmarks(nodes: BookmarkNode[]): BookmarkNode[] {
  const result: BookmarkNode[] = [];
  for (const node of nodes) {
    if (node.url) {
      result.push(node);
    }
    if (node.children) {
      result.push(...flattenBookmarks(node.children));
    }
  }
  return result;
}
