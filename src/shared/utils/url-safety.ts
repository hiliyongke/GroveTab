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
 * 规范化用户输入的外部 URL。
 *
 * @param value 用户输入或导入的 URL
 * @param options.assumeHttpsWhenMissingProtocol 缺少协议时是否补 `https://`
 */
export function normalizeExternalUrl(
  value: string,
  options: { assumeHttpsWhenMissingProtocol?: boolean } = {},
): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const candidate =
    options.assumeHttpsWhenMissingProtocol === true && !/^[a-z][a-z\d+.-]*:/i.test(trimmed)
      ? `https://${trimmed}`
      : trimmed;
  if (!isSafeExternalUrl(candidate)) return null;
  return candidate;
}

/**
 * 过滤出可安全打开的外部 URL 列表。
 *
 * @param values URL 列表
 */
export function filterSafeExternalUrls(values: string[]): string[] {
  return values.filter(isSafeExternalUrl);
}
