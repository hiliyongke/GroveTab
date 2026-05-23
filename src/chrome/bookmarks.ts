/**
 * Chrome Bookmarks API 封装
 *
 * 需要 `bookmarks` optional permission。
 * 在用户首次使用书签功能时通过 `chrome.permissions.request()` 动态申请。
 * 所有 API 经 safeCall 包装，失败时返回空数组/undefined。
 */

import { safeCall } from './tabs'; // 复用 safeCall 逻辑

/** 书签树节点（chrome.bookmarks.BookmarkTreeNode 的简化版） */
export interface BookmarkNode {
  /** 节点唯一 ID */
  id: string;
  /** 书签标题（文件夹也有标题） */
  title: string;
  /** 书签 URL，文件夹类型时为 undefined */
  url?: string;
  /** 父节点 ID，根节点时为 undefined */
  parentId?: string;
  /** 子节点列表，仅文件夹类型存在 */
  children?: BookmarkNode[];
}

/**
 * 获取完整书签树
 *
 * 返回以根节点为起点的完整书签树。未获授权时返回空数组，不抛异常。
 *
 * @returns 书签树的根节点数组（通常只有一个根）
 */
export async function getBookmarkTree(): Promise<BookmarkNode[]> {
  try {
    const tree = await safeCall('bookmarks.getTree', () => chrome.bookmarks.getTree());
    return tree;
  } catch {
    return [];
  }
}

/**
 * 按关键词搜索书签
 *
 * 调用 chrome.bookmarks.search，对标题和 URL 进行模糊匹配。
 * 空字符串或纯空白直接返回空数组，避免无意义 API 调用。
 *
 * @param query 搜索关键词
 * @returns 匹配的书签节点数组，失败时返回空数组
 */
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

/**
 * 创建书签或文件夹
 *
 * 不传 url 时创建一个文件夹；传了 url 则创建普通书签。
 * parentId 不传时挂到书签栏根节点下。
 *
 * @param bookmark 书签属性对象
 * @param bookmark.parentId 父文件夹 ID（可选）
 * @param bookmark.title    书签标题（可选）
 * @param bookmark.url      书签 URL（可选，不传则创建文件夹）
 * @returns 创建后的书签节点，失败时返回 null
 */
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

/**
 * 删除书签或空文件夹
 *
 * 用于去重合并、失效书签清理等场景。
 * 若节点下有子节点且非空，Chrome 会抛异常，调用方需确保目标已清空。
 *
 * @param id 要删除的书签或文件夹节点 ID
 * @returns 是否删除成功
 */
export async function removeBookmark(id: string): Promise<boolean> {
  try {
    await safeCall('bookmarks.remove', () => chrome.bookmarks.remove(id));
    return true;
  } catch {
    return false;
  }
}

/**
 * 将书签或文件夹移动到指定父节点下
 *
 * 用于智能整理：把同域名书签批量归到新的文件夹。
 * parentId 不存在时会抛异常，由 safeCall 归一化后返回 false。
 *
 * @param id       要移动的节点 ID
 * @param parentId 目标父文件夹 ID
 * @returns 是否移动成功
 */
export async function moveBookmark(id: string, parentId: string): Promise<boolean> {
  try {
    await safeCall('bookmarks.move', () => chrome.bookmarks.move(id, { parentId }));
    return true;
  } catch {
    return false;
  }
}

/**
 * 动态申请书签权限（optional permission）
 *
 * 会触发 Chrome 权限弹窗，建议在用户首次使用书签功能时调用。
 *
 * @returns 用户是否同意授权
 */
export async function requestBookmarksPermission(): Promise<boolean> {
  try {
    return await chrome.permissions.request({ permissions: ['bookmarks'] });
  } catch {
    return false;
  }
}

/**
 * 检查扩展是否已获得书签权限
 *
 * 用于在 UI 层面决定是否展示书签相关功能入口。
 *
 * @returns 是否已授予 `bookmarks` 权限
 */
export async function hasBookmarksPermission(): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ permissions: ['bookmarks'] });
  } catch {
    return false;
  }
}

/**
 * 将书签树展平为一维数组
 *
 * 深度优先遍历，只保留含有 URL 的叶子节点（即实际书签，不含文件夹）。
 * 用于去重检测、批量操作等需要线性遍历的场景。
 *
 * @param nodes 书签树节点数组（通常是 getBookmarkTree() 的返回值）
 * @returns 所有含 URL 的书签节点的一维数组
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
