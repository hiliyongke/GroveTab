/**
 * Chrome URL 工具函数 — 特殊 URL 识别与 hostname 提取
 *
 * 用于区分 Chrome 内部页面（chrome://、extension:// 等）与普通网页，
 * 决定标签页是否在扩展的标签列表中显示。
 */

import type { SpecialUrlType } from '@/shared/types';

/**
 * 将 URL 分类为特殊类型或普通网页
 *
 * 用于快速判断一个 URL 是否属于 Chrome 内部页面，
 * 以便在 UI 层面决定是否显示该标签页。
 *
 * @param url 待分类的 URL 字符串
 * @returns 分类结果：'normal' | 'chrome' | 'file' | 'about' | 'devtools' | 'edge'
 */
function classifyUrl(url: string): SpecialUrlType {
  if (!url) return 'about';
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return 'chrome';
  if (url.startsWith('file://')) return 'file';
  if (url.startsWith('about:')) return 'about';
  if (url.startsWith('devtools://')) return 'devtools';
  if (url.startsWith('edge://')) return 'edge';
  return 'normal';
}

/**
 * 判断某个 URL 是否应在标签列表中显示
 *
 * chrome:// 和 about:blank/newtab 默认隐藏（属于浏览器自身 UI，不是用户标签）。
 * 当用户开启"显示特殊页面"选项时，'chrome' / 'file' / 'devtools' / 'edge' 类型会放行。
 *
 * @param url         待判断的 URL
 * @param showSpecial 是否放行特殊页面（默认 false）
 * @returns 是否应在列表中显示
 */
export function shouldDisplayUrl(url: string, showSpecial = false): boolean {
  const type = classifyUrl(url);
  if (type === 'normal') return true;
  // about:blank is the new tab page itself — always hide
  if (url === 'about:blank') return false;
  return showSpecial;
}

/**
 * 从 URL 中提取 hostname
 *
 * 封装了 new URL() 的 try/catch，避免调用方重复处理异常。
 * 无效 URL 返回空串。
 *
 * @param url 完整的 URL 字符串
 * @returns hostname（如 'www.google.com'），解析失败时返回空串
 */
export function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * 判断 URL 是否是扩展自身的新标签页
 *
 * 扩展劫持了新标签页（newtab）时，URL 会以 chrome-extension://<id>/newtab/ 开头。
 * 这类页面在标签列表中通常应隐藏或特殊处理。
 *
 * @param url 待判断的 URL
 * @returns 是否是扩展新标签页
 */
function isExtensionNewTab(url: string): boolean {
  return url.startsWith('chrome-extension://') && url.includes('/newtab/');
}

/**
 * 判断某个标签页是否是扩展自身的新标签页
 *
 * 同时检查 tab.url 和 tab.pendingUrl，因为 Chrome 在页面加载过程中
 * pendingUrl 会先一步就绪，而 url 可能暂时为空。
 *
 * @param tab          标签页对象
 * @param tab.url        标签页 URL（可能为空）
 * @param tab.pendingUrl 标签页加载中的 pending URL（可能为空）
 * @returns 是否是扩展新标签页
 */
export function isSelfNewTabPage(tab: { url?: string; pendingUrl?: string }): boolean {
  const url = tab.url ?? tab.pendingUrl ?? '';
  return isExtensionNewTab(url);
}
