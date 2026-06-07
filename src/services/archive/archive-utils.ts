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
import { translate } from '@/shared/i18n/core';

/** 判断标签页是否允许归档。 */
export function isArchivableTab(tab: chrome.tabs.Tab): boolean {
  if (isSelfNewTabPage(tab)) return false;
  if (tab.pinned) return false;
  if (tab.incognito) return false;
  const url = tab.url ?? tab.pendingUrl ?? '';
  return shouldDisplayUrl(url);
}

/** 把 Chrome 标签页转换为归档快照条目。 */
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

/** 生成默认会话名，优先复用扩展 i18n 文案。 */
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
  return localized !== '' ? localized : translate("会话 {dateStr}", { dateStr });
}

/** URL 规范化键（忽略 hash、utm/fbclid/gclid 参数），用于去重。 */
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
