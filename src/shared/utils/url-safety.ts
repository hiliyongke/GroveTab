/**
 * 外部 URL 安全工具。
 *
 * 统一约束所有会被打开、恢复、导入或写入快捷入口的外部链接。
 * 白名单策略：仅允许 http/https/ftp/ipfs 协议。
 * 显式拦截危险协议：javascript:/data:/file:/blob:/chrome:/chrome-extension:/about: 等。
 */

/** 允许的外部 URL 协议（白名单） */
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'ftp:', 'ipfs:', 'ipns:']);

/** 显式危险协议黑名单（作为额外防御层） */
const DANGEROUS_PROTOCOLS = new Set([
  'javascript:',
  'data:',
  'file:',
  'blob:',
  'chrome:',
  'chrome-extension:',
  'chrome-search:',
  'chrome-devtools:',
  'chrome-untrusted:',
  'about:',
  'vbscript:',
]);

/**
 * 判断一个字符串是否为可安全打开的外部网页 URL。
 *
 * @param value 待校验 URL
 */
export function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    const protocol = url.protocol;

    // 黑名单优先：拦截已知危险协议
    if (DANGEROUS_PROTOCOLS.has(protocol)) {
      return false;
    }

    // 白名单通过：仅允许 http/https 等安全协议
    return ALLOWED_EXTERNAL_PROTOCOLS.has(protocol);
  } catch {
    return false;
  }
}

/**
 * 过滤出可安全打开的外部 URL 列表。
 *
 * @param values URL 列表
 */
export function filterSafeExternalUrls(values: string[]): string[] {
  return values.filter(isSafeExternalUrl);
}
