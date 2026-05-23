/**
 * siteUtils — 常用站点辅助函数
 *
 * 从 URL 提取域名、获取 favicon URL 等纯函数。
 */

import type { SpeedDialSite } from '@/shared/types';

/**
 * 从 URL 提取域名，失败返回原始 URL
 * @param url
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
 * @param hostname
 */
export function getInitial(hostname: string): string {
  const ch = hostname.replace(/^www\./, '').charAt(0).toUpperCase();
  return ch || '?';
}

/**
 * 判断是否是 Google favicon 代理 URL。
 * 代理 URL 对内网站通常会 404，不能作为已保存的有效 favicon 使用。
 * @param url
 */
function isGoogleFaviconProxy(url: string): boolean {
  return url.includes('google.com/s2/favicons') || url.includes('gstatic.com/faviconV2');
}

/**
 * 判断是否应避免使用外部 favicon 代理。
 * 内网域名、本地域名和私网 IP 对 Google 不可见，交给现有首字母兜底即可。
 * @param hostname
 */
function shouldAvoidExternalFaviconProxy(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === 'woa.com' ||
    lower === 'oa.com' ||
    lower.endsWith('.local') ||
    lower.endsWith('.woa.com') ||
    lower.endsWith('.oa.com') ||
    !lower.includes('.')
  ) {
    return true;
  }

  if (/^(10|127)\./.test(lower)) return true;
  if (lower.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(lower)) return true;

  return false;
}

/**
 * 获取 favicon URL。
 * 优先使用站点自带的 favIconUrl，否则公网域名使用 Google favicon 服务。
 * 内网域名不走外部代理，避免 `t3.gstatic.com/faviconV2` 产生必然失败的 404。
 * @param site
 */
export function getFaviconUrl(site: SpeedDialSite): string | undefined {
  if (site.favIconUrl && !isGoogleFaviconProxy(site.favIconUrl)) {
    return site.favIconUrl;
  }
  const hostname = getHostname(site.url);
  if (shouldAvoidExternalFaviconProxy(hostname)) {
    return undefined;
  }
  return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
}
