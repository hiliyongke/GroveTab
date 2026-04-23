/**
 * Chrome History API 封装。
 */

import { safeCall } from './tabs';

export interface HistorySearchEntry {
  id: string;
  url: string;
  title: string;
  visitCount: number;
  typedCount: number;
  lastVisitTime: number;
}

/**
 * 检查是否已有历史记录权限。
 */
export async function hasHistoryPermission(): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ permissions: ['history'] });
  } catch {
    return false;
  }
}

/**
 * 请求历史记录权限。
 */
export async function requestHistoryPermission(): Promise<boolean> {
  try {
    return await chrome.permissions.request({ permissions: ['history'] });
  } catch {
    return false;
  }
}

/**
 * 搜索浏览器历史记录。
 */
export async function searchHistoryEntries(query: string, maxResults = 6): Promise<HistorySearchEntry[]> {
  const results = await safeCall('history.search', () => chrome.history.search({
    text: query,
    maxResults,
    startTime: 0,
  }));

  return results
    .filter((item) => typeof item.url === 'string' && item.url !== '')
    .map((item) => ({
      id: item.id,
      url: item.url ?? '',
      title: item.title ?? item.url ?? '',
      visitCount: item.visitCount ?? 0,
      typedCount: item.typedCount ?? 0,
      lastVisitTime: item.lastVisitTime ?? 0,
    }));
}
