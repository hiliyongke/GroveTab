/**
 * url-display — 为 UI 展示格式化 URL
 *
 * 主要用途：同一标题多个 tab 时，用"路径 + 关键参数"做轻量化消歧展示。
 *
 * 设计取舍：
 *   - 不重复显示 hostname（卡片/分组行已经给出）
 *   - 路径多段时优先强调最后一段，中间用 `…` 省略
 *   - query 只展示最多 2 个具有辨识度的键值对
 *   - hash 路由（SPA 常见）保留 `#/xxx` 段
 *   - 总长度截断到 maxLength，避免破坏单行布局
 */

interface UrlDisplayOptions {
  /** 整体最大字符数，超出从中间省略 */
  maxLength?: number;
  /** 每个 query value 最大字符数 */
  maxValueLength?: number;
}

const DEFAULT_MAX_LENGTH = 60;
const DEFAULT_MAX_VALUE_LENGTH = 16;

/**
 * 从 URL 构造友好的展示串。
 *
 * 示例：
 *   - `https://x.com/app/page?tab=a` → `/app/page?tab=a`
 *   - `https://x.com/app/very/long/path/detail/123` → `/…/detail/123`
 *   - `https://x.com/#/settings/profile` → `#/settings/profile`
 *   - `https://x.com/` → `/`（首页）
 */
export function formatUrlForDisplay(
  rawUrl: string,
  options: UrlDisplayOptions = {},
): string {
  const { maxLength = DEFAULT_MAX_LENGTH, maxValueLength = DEFAULT_MAX_VALUE_LENGTH } = options;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    // 非法 URL，回落到裁剪原串
    return truncateMiddle(rawUrl, maxLength);
  }

  const parts: string[] = [];

  // —— 路径段（压缩长路径） ——
  const path = compressPath(url.pathname);
  if (path) parts.push(path);

  // —— query：只挑前 2 个键值 ——
  if (url.search) {
    const queryStr = formatQuery(url.searchParams, maxValueLength);
    if (queryStr) parts.push(`?${queryStr}`);
  }

  // —— hash：SPA 路由常用，保留但同样压缩 ——
  if (url.hash) {
    const hashPath = url.hash.startsWith('#/')
      ? '#' + compressPath(url.hash.slice(1))
      : truncateMiddle(url.hash, 24);
    parts.push(hashPath);
  }

  const result = parts.join('');

  // 完全空（纯 hostname 根路径）回退为 "/"
  if (!result || result === '') return '/';

  return truncateMiddle(result, maxLength);
}

/**
 * 压缩路径：段数 ≤ 2 保留全部，否则首段 + … + 末段
 */
function compressPath(pathname: string): string {
  if (!pathname || pathname === '/') return '';
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return '';
  if (segments.length <= 2) return '/' + segments.join('/');
  return `/${segments[0]}/…/${segments[segments.length - 1]}`;
}

/**
 * 格式化 query：取前 2 个非空参数，超长 value 用 … 收尾
 */
function formatQuery(params: URLSearchParams, maxValueLength: number): string {
  const entries: string[] = [];
  let idx = 0;
  for (const [key, value] of params.entries()) {
    if (idx >= 2) {
      entries.push('…');
      break;
    }
    const shownValue =
      value.length > maxValueLength ? value.slice(0, maxValueLength) + '…' : value;
    entries.push(`${key}=${shownValue}`);
    idx++;
  }
  return entries.join('&');
}

/**
 * 字符串中部省略：`abc…xyz`
 */
function truncateMiddle(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  const keep = Math.max(Math.floor((maxLength - 1) / 2), 8);
  return str.slice(0, keep) + '…' + str.slice(str.length - keep);
}

/**
 * 找出一组 tab 中"标题重复"的 id 集合。
 *
 * 判定规则：
 *   - title 去掉首尾空白后相等视为同名
 *   - 至少出现 2 次才加入集合
 *   - 空 title（loading 中）不参与
 *
 * 返回的集合用于驱动 `TabItem.showUrlHint`
 */
export function findAmbiguousTitleIds(
  tabs: ReadonlyArray<{ id: number; title?: string }>,
): Set<number> {
  const titleCount = new Map<string, number>();
  for (const tab of tabs) {
    const key = (tab.title ?? '').trim();
    if (!key) continue;
    titleCount.set(key, (titleCount.get(key) ?? 0) + 1);
  }
  const result = new Set<number>();
  for (const tab of tabs) {
    const key = (tab.title ?? '').trim();
    if (!key) continue;
    if ((titleCount.get(key) ?? 0) >= 2) result.add(tab.id);
  }
  return result;
}

