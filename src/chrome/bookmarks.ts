/**
 * Chrome Bookmarks API 封装。需 `bookmarks` optional permission。
 */

import { safeCall } from './safe-call';

/** 书签树节点。 */
export interface BookmarkNode {
  id: string;
  title: string;
  url?: string;
  parentId?: string;
  children?: BookmarkNode[];
}

/** 获取完整书签树。无权限时返回空数组。 */
export async function getBookmarkTree(): Promise<BookmarkNode[]> {
  try {
    const tree = await safeCall('bookmarks.getTree', () => chrome.bookmarks.getTree());
    return tree;
  } catch {
    return [];
  }
}

/** 搜索书签。 */
export async function searchBookmarks(query: string): Promise<BookmarkNode[]> {
  if (!query.trim()) return [];
  try {
    const results = await safeCall('bookmarks.search', () =>
      chrome.bookmarks.search(query),
    );
    return results;
  } catch {
    return [];
  }
}

/** 创建书签。 */
export async function createBookmark(bookmark: { parentId?: string; title?: string; url?: string }): Promise<BookmarkNode | null> {
  try {
    const result = await safeCall('bookmarks.create', () =>
      chrome.bookmarks.create(bookmark),
    );
    return result;
  } catch {
    return null;
  }
}

/** 删除书签或空文件夹。 */
export async function removeBookmark(id: string): Promise<boolean> {
  try {
    await safeCall('bookmarks.remove', () => chrome.bookmarks.remove(id));
    return true;
  } catch {
    return false;
  }
}

/** 更新书签标题/URL。 */
export async function updateBookmark(id: string, changes: { title?: string; url?: string }): Promise<BookmarkNode | null> {
  try {
    return await safeCall('bookmarks.update', () => chrome.bookmarks.update(id, changes));
  } catch {
    return null;
  }
}

/** 获取最近添加的书签。 */
export async function getRecentBookmarks(count: number = 20): Promise<BookmarkNode[]> {
  try {
    return await safeCall('bookmarks.getRecent', () => chrome.bookmarks.getRecent(count));
  } catch { return []; }
}

/** 获取书签子树。 */
export async function getBookmarkSubTree(id: string): Promise<BookmarkNode[]> {
  try {
    return await safeCall('bookmarks.getSubTree', () => chrome.bookmarks.getSubTree(id));
  } catch { return []; }
}

/** 移动书签到指定父节点。 */
export async function moveBookmark(id: string, parentId: string): Promise<boolean> {
  try {
    await safeCall('bookmarks.move', () => chrome.bookmarks.move(id, { parentId }));
    return true;
  } catch {
    return false;
  }
}

/** 请求书签权限。 */
export async function requestBookmarksPermission(): Promise<boolean> {
  try {
    return await chrome.permissions.request({ permissions: ['bookmarks'] });
  } catch {
    return false;
  }
}

/** 检查是否已有书签权限。 */
export async function hasBookmarksPermission(): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ permissions: ['bookmarks'] });
  } catch {
    return false;
  }
}

/** 展平书签树为 URL 列表。 */
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
