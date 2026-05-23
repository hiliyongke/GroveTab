/**
 * 归档服务 - 工具函数
 *
 * 提供归档流程中通用的辅助函数，如标签页过滤、转换、URL 规范化等。
 * 不包含副作用或状态管理，便于独立测试。
 */

import type { ArchivedTab } from '@/shared/types';
import {
  extractHostname,
  isSelfNewTabPage,
  shouldDisplayUrl,
} from '@/chrome';
import { getFaviconUrl } from '@/chrome';

/**
 * 判断标签页是否允许归档。
 *
 * 过滤条件：新标签页、固定标签、无痕标签、无效 URL。
 *
 * @param tab 待检测的 Chrome 标签页对象
 * @returns 允许归档返回 true，否则返回 false
 */
export function isArchivableTab(tab: chrome.tabs.Tab): boolean {
  if (isSelfNewTabPage(tab)) return false;
  if (tab.pinned) return false;
  if (tab.incognito) return false;
  const url = tab.url ?? tab.pendingUrl ?? '';
  return shouldDisplayUrl(url);
}

/**
 * 把 Chrome 标签页转换为归档快照条目。
 *
 * 提取 URL、标题、favicon、hostname、固定状态，
 * 生成归档所需的 `ArchivedTab` 对象。
 *
 * @param tab 待转换的 Chrome 标签页对象
 * @returns 归档快照条目对象
 */
export function toArchivedTab(tab: chrome.tabs.Tab): ArchivedTab {
  const url = tab.url ?? tab.pendingUrl ?? '';
  const extensionFavicon = getFaviconUrl(url);
  return {
    url,
    title: tab.title ?? '',
    favIconUrl: extensionFavicon !== '' ? extensionFavicon : (tab.favIconUrl ?? ''),
    hostname: extractHostname(url),
    pinned: tab.pinned,
  };
}

/**
 * 生成默认会话名，优先复用扩展 i18n 文案。
 *
 * 根据当前语言环境生成带时间戳的默认会话名，
 * 若扩展有配置 i18n 文案则优先使用。
 *
 * @returns 默认会话名称字符串
 */
export function buildDefaultSessionName(): string {
  const locale = typeof chrome === 'undefined'
    ? 'zh-CN'
    : (chrome.i18n?.getUILanguage?.() ?? 'zh-CN');
  const dateStr = new Date().toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const localized = typeof chrome === 'undefined'
    ? ''
    : (chrome.i18n?.getMessage?.('archive_session_name', [dateStr]) ?? '');
  return localized !== '' ? localized : `会话 ${dateStr}`;
}

/**
 * URL 规范化键（忽略 hash、utm/fbclid/gclid 参数），用于去重。
 *
 * 移除 URL 中的 hash 和跟踪参数，排序剩余查询参数，
 * 生成稳定的规范化键，用于归档会话的去重判断。
 *
 * @param url 原始 URL 字符串
 * @returns 规范化后的 URL 键字符串
 */
export function canonicalUrlKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    const params = new URLSearchParams();
    for (const [k, v] of u.searchParams.entries()) {
      if (!/^(utm_\w+|fbclid|gclid)$/i.test(k)) params.set(k, v);
    }
    u.search = params.toString();
    u.searchParams.sort();
    return u.toString().replace(/\/+$/, '');
  } catch {
    return url;
  }
}
