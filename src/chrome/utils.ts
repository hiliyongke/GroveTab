/**
 * Chrome URL 工具：特殊 URL 检测与 hostname 提取。
 */

import type { SpecialUrlType } from "@/shared/types";
export { extractHostname } from "@/shared/utils/url";

/** 将 URL 归类为特殊类型或 normal。 */
function classifyUrl(url: string): SpecialUrlType {
  if (!url) return "about";
  if (url.startsWith("chrome://") || url.startsWith("chrome-extension://")) return "chrome";
  if (url.startsWith("file://")) return "file";
  if (url.startsWith("about:")) return "about";
  if (url.startsWith("devtools://")) return "devtools";
  if (url.startsWith("edge://")) return "edge";
  return "normal";
}

/** 判断 URL 是否应在标签页列表中显示。about:blank 始终隐藏。 */
export function shouldDisplayUrl(url: string, showSpecial = false): boolean {
  const type = classifyUrl(url);
  if (type === "normal") return true;
  if (url === "about:blank") return false;
  return showSpecial;
}

/** 判断是否为扩展自身的新标签页。 */
function isExtensionNewTab(url: string): boolean {
  return url.startsWith("chrome-extension://") && url.includes("/newtab/");
}

/** 判断标签页是否为扩展自身的新标签页。 */
export function isSelfNewTabPage(tab: { url?: string; pendingUrl?: string }): boolean {
  const url = tab.url ?? tab.pendingUrl ?? "";
  return isExtensionNewTab(url);
}
