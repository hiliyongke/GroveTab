/**
 * URL 工具函数
 *
 * 统一项目中多处重复的 URL 处理逻辑：
 * - chrome/utils.ts 中的 extractHostname()
 * - quick-start/utils/siteUtils.ts 中的 getHostname()
 * - repositories/history-repo.ts 中的 safeHostname()
 */

/**
 * 从 URL 中提取 hostname，失败返回空字符串
 */
export function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * 去重严格度类型
 */
export type DedupStrictness = "strict" | "loose" | "off";

/**
 * 跟踪参数（去重时移除）
 */
const TRACKING_PARAMS = /^(utm_\w+|fbclid|gclid|mc_eid|mc_cid|ref|source)$/i;

/**
 * 基础 URL 归一化：移除 hash、末尾斜杠
 */
function normalizeBase(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return url;
  }
}

/**
 * 用于 metadata key 的 URL 归一化
 * 规则：清除 hash、去除尾部 /
 */
export function normalizeMetadataKey(url: string): string {
  return normalizeBase(url);
}

/**
 * 用于去重的 URL 归一化
 * - strict：原样返回
 * - loose：移除 hash、跟踪参数、排序参数、移除末尾斜杠
 */
export function normalizeUrl(url: string, strictness: DedupStrictness): string {
  if (strictness === "strict") return url;
  try {
    const parsed = new URL(normalizeBase(url));
    const params = new URLSearchParams();
    for (const [key, value] of parsed.searchParams.entries()) {
      if (!TRACKING_PARAMS.test(key)) params.set(key, value);
    }
    parsed.search = params.toString();
    parsed.searchParams.sort();
    return parsed.toString();
  } catch {
    return url;
  }
}
