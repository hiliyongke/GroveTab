/**
 * siteUtils — 常用站点辅助函数
 *
 * 从 URL 提取域名、获取 favicon URL 等纯函数。
 */

import type { SpeedDialSite } from '@/shared/types';

/**
 * 从 URL 提取域名，失败返回原始 URL
 */
export function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * 取域名首字母（去掉 www. 前缀）
 */
export function getInitial(hostname: string): string {
  const ch = hostname.replace(/^www\./, '').charAt(0).toUpperCase();
  return ch || '?';
}

/**
 * 获取 favicon URL。
 * 优先使用站点自带的 favIconUrl，否则使用 Google favicon 服务。
 * chrome://favicon/ API 在扩展页面中可用，但 <img> 加载时可能因 CSP 被拦截，
 * 因此统一使用 Google 的 favicon 服务作为兜底。
 */
export function getFaviconUrl(site: SpeedDialSite): string | undefined {
  if (site.favIconUrl && !site.favIconUrl.includes('google.com/s2/favicons')) {
    return site.favIconUrl;
  }
  const hostname = getHostname(site.url);
  return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
}
