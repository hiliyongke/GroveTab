/**
 * Chrome History API 封装
 *
 * 需要 `history` optional permission，在用户首次使用历史记录搜索时动态申请。
 * 未获授权时所有查询类函数返回空结果，不会抛异常。
 */

import { safeCall } from './tabs';

/** 历史记录搜索结果的标准化结构（chrome.history.HistoryItem 的简化版） */
export interface HistorySearchEntry {
  /** 历史记录条目的唯一 ID */
  id: string;
  /** 页面 URL */
  url: string;
  /** 页面标题 */
  title: string;
  /** 用户访问该 URL 的总次数 */
  visitCount: number;
  /** 用户在地址栏中直接输入该 URL 的次数 */
  typedCount: number;
  /** 最后一次访问的时间戳（毫秒） */
  lastVisitTime: number;
}

/**
 * 检查扩展是否已获得历史记录权限
 *
 * 用于在 UI 层面决定是否展示历史记录搜索入口，
 * 避免无权限时发起会静默失败的 API 调用。
 *
 * @returns 是否已授予 `history` 权限
 */
export async function hasHistoryPermission(): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ permissions: ['history'] });
  } catch {
    return false;
  }
}

/**
 * 动态申请历史记录权限（optional permission）
 *
 * 会触发 Chrome 的权限申请弹窗，用户拒绝则返回 false。
 * 建议在用户主动点击"搜索历史记录"时调用，而非启动时硬申请。
 *
 * @returns 用户是否同意授权
 */
export async function requestHistoryPermission(): Promise<boolean> {
  try {
    return await chrome.permissions.request({ permissions: ['history'] });
  } catch {
    return false;
  }
}

/**
 * 搜索浏览器历史记录
 *
 * 调用 chrome.history.search，并将结果标准化为 HistorySearchEntry 结构。
 * 无权限时 safeCall 会抛异常，由外层 catch 降级处理（返回空数组）。
 *
 * @param query      搜索关键词（Chrome 会对 URL / 标题做模糊匹配）
 * @param maxResults 最大返回条数，默认 6
 * @returns 标准化后的历史记录条目数组
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
