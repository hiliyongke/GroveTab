/**
 * 外部 URL 安全工具。
 *
 * 统一约束所有会被打开、恢复、导入或写入快捷入口的外部链接。
 * 默认只允许 http/https，避免 javascript/data/file/blob/chrome 等协议进入
 * chrome.tabs.create、window.open 或持久化恢复链路。
 */

/** 允许的外部协议白名单（仅 http/https） */
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * 判断一个字符串是否为可安全打开的外部网页 URL
 *
 * 内部使用 `new URL()` 解析，仅允许 http/https 协议。
 * 解析失败或非白名单协议均返回 false。
 *
 * @param value 待校验 URL 字符串
 * @returns 是否可安全打开
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
 * 过滤出可安全打开的外部 URL 列表
 *
 * 遍历输入数组，仅保留通过 `isSafeExternalUrl` 校验的 URL。
 *
 * @param values URL 字符串数组
 * @returns 安全 URL 数组
 */
export function filterSafeExternalUrls(values: string[]): string[] {
  return values.filter(isSafeExternalUrl);
}
