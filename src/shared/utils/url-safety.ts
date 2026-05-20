/**
 * 外部 URL 安全工具。
 *
 * 统一约束所有会被打开、恢复、导入或写入快捷入口的外部链接。
 * 默认只允许 http/https，避免 javascript/data/file/blob/chrome 等协议进入
 * chrome.tabs.create、window.open 或持久化恢复链路。
 */

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * 判断一个字符串是否为可安全打开的外部网页 URL。
 *
 * @param value 待校验 URL
 */
export function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return ALLOWED_EXTERNAL_PROTOCOLS.has(url.protocol);
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
