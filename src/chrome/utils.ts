/**
 * Chrome URL Utilities — Special URL detection and hostname extraction
 */

import type { SpecialUrlType } from '@/shared/types';

/**
 * Classify a URL into special types or 'normal'
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
 * Check if a URL should be displayed in the tab list
 * chrome:// and about:blank/newtab are hidden by default
 */
export function shouldDisplayUrl(url: string, showSpecial = false): boolean {
  const type = classifyUrl(url);
  if (type === 'normal') return true;
  // about:blank is the new tab page itself — always hide
  if (url === 'about:blank') return false;
  return showSpecial;
}

/**
 * Extract hostname from URL
 */
export function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * Check if a tab is the extension new tab page itself
 */
function isExtensionNewTab(url: string): boolean {
  return url.startsWith('chrome-extension://') && url.includes('/newtab/');
}

/**
 * Check if the extension's own new tab URL matches
 */
export function isSelfNewTabPage(tab: { url?: string; pendingUrl?: string }): boolean {
  const url = tab.url ?? tab.pendingUrl ?? '';
  return isExtensionNewTab(url);
}
