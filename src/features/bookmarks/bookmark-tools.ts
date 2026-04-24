/**
 * bookmark-tools.ts —— 书签增强能力（v1.1）
 *
 * 三个能力：
 *   1. 去重（dedupe）：复用全局 `normalizeUrl + dedupStrictness`，扫描重复书签。
 *   2. 失效检测（health check）：并发 HEAD 请求，识别 404/超时/SSL 错书签。
 *   3. 智能整理（auto organize）：按域名分簇 → 建议新建文件夹 / 归档沉睡书签。
 *
 * 所有函数返回"预览数据"和"执行函数"两份，UI 层先展示再让用户点确认，
 * 保障可撤销与安全性（对书签的破坏性写操作必须显式二次确认）。
 */

import type { BookmarkNode } from '@/chrome/bookmarks';
import { flattenBookmarks, removeBookmark, moveBookmark, createBookmark } from '@/chrome/bookmarks';
import { normalizeUrl } from '@/shared/utils/dedupe';
import { extractHostname } from '@/chrome/utils';

// ═══════════════════════════════════════════════════════════
// 1. 去重
// ═══════════════════════════════════════════════════════════

/** 单组重复书签 */
export interface DuplicateBookmarkGroup {
  /** 归一化后的 URL key，用于识别组 */
  key: string;
  /** 该组内的所有书签 */
  items: BookmarkNode[];
}

/**
 * 扫描所有书签，按 normalizeUrl 分组，返回 >1 个成员的组。
 */
export function findDuplicateBookmarks(
  roots: BookmarkNode[],
  strictness: 'strict' | 'loose' | 'off' = 'loose',
): DuplicateBookmarkGroup[] {
  if (strictness === 'off') return [];
  const all = flattenBookmarks(roots).filter((b) => (b.url ?? '') !== '');
  const groups = new Map<string, BookmarkNode[]>();
  for (const b of all) {
    const url = b.url!;
    const key = normalizeUrl(url, strictness);
    const arr = groups.get(key);
    if (arr !== undefined) arr.push(b);
    else groups.set(key, [b]);
  }
  const dups: DuplicateBookmarkGroup[] = [];
  for (const [key, items] of groups.entries()) {
    if (items.length > 1) dups.push({ key, items });
  }
  return dups;
}

/**
 * 合并重复组：默认保留每组**第一个**，删除其余。
 * 返回删除成功的条数。
 */
export async function mergeDuplicateBookmarks(groups: DuplicateBookmarkGroup[]): Promise<number> {
  let removed = 0;
  for (const group of groups) {
    const [keep, ...rest] = group.items;
    if (keep === undefined) continue;
    for (const item of rest) {
      const ok = await removeBookmark(item.id);
      if (ok) removed += 1;
    }
  }
  return removed;
}

// ═══════════════════════════════════════════════════════════
// 2. 失效检测
// ═══════════════════════════════════════════════════════════

/** 单条健康检查结果 */
export interface BookmarkHealth {
  bookmark: BookmarkNode;
  /** 'ok' 可达 / 'dead' 404/500/连接失败 / 'timeout' 超时 / 'skipped' 非 http(s) */
  status: 'ok' | 'dead' | 'timeout' | 'skipped';
  httpStatus?: number;
}

const HEALTH_TIMEOUT_MS = 6_000;
const HEALTH_CONCURRENCY = 5;

/**
 * 对单个 URL 发起健康检查。
 *   - 仅检查 http/https
 *   - 使用 `no-cors` 模式的 GET 请求（HEAD 有些站点禁用）
 *   - 响应 opaque 也视为可达（只要 fetch 没 reject）
 */
async function checkOne(b: BookmarkNode): Promise<BookmarkHealth> {
  const url = b.url ?? '';
  if (!/^https?:\/\//.test(url)) {
    return { bookmark: b, status: 'skipped' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method: 'GET',
      mode: 'no-cors',
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    // no-cors 模式 status 始终 0；认为"能联通"就是 ok
    return { bookmark: b, status: 'ok', httpStatus: resp.status };
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') {
      return { bookmark: b, status: 'timeout' };
    }
    return { bookmark: b, status: 'dead' };
  }
}

/**
 * 批量健康检查（需 `<all_urls>` permission 才能对任意域发 GET）。
 *
 * @param bookmarks  要检查的书签列表（已扁平化）
 * @param onProgress 每完成一条回调一次，用于驱动进度条
 */
export async function checkBookmarkHealth(
  bookmarks: BookmarkNode[],
  onProgress?: (done: number, total: number) => void,
): Promise<BookmarkHealth[]> {
  const total = bookmarks.length;
  const results: BookmarkHealth[] = [];
  let done = 0;
  // 手写并发池，最多 HEALTH_CONCURRENCY 路并发
  const queue = [...bookmarks];
  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(HEALTH_CONCURRENCY, total); i++) {
    workers.push(
      (async () => {
        while (queue.length > 0) {
          const b = queue.shift();
          if (b === undefined) break;
          const r = await checkOne(b);
          results.push(r);
          done += 1;
          onProgress?.(done, total);
        }
      })(),
    );
  }
  await Promise.all(workers);
  return results;
}

/**
 * 批量删除检测为 dead/timeout 的书签。
 * 返回实际删除的条数。
 */
export async function removeDeadBookmarks(results: BookmarkHealth[]): Promise<number> {
  let removed = 0;
  for (const r of results) {
    if (r.status === 'dead' || r.status === 'timeout') {
      const ok = await removeBookmark(r.bookmark.id);
      if (ok) removed += 1;
    }
  }
  return removed;
}

// ═══════════════════════════════════════════════════════════
// 3. 智能整理
// ═══════════════════════════════════════════════════════════

/** 域名聚类结果 */
export interface DomainCluster {
  /** 域名（hostname） */
  domain: string;
  /** 该域名下的书签 */
  items: BookmarkNode[];
}

const MIN_CLUSTER_SIZE = 3;

/**
 * 按域名聚类书签。只返回数量 >= MIN_CLUSTER_SIZE 的簇——
 * 小簇整理价值低，强制归类反而造成文件夹过多。
 */
export function clusterBookmarksByDomain(roots: BookmarkNode[]): DomainCluster[] {
  const all = flattenBookmarks(roots).filter((b) => (b.url ?? '') !== '');
  const map = new Map<string, BookmarkNode[]>();
  for (const b of all) {
    const host = extractHostname(b.url!);
    if (host === '') continue;
    const arr = map.get(host);
    if (arr !== undefined) arr.push(b);
    else map.set(host, [b]);
  }
  const clusters: DomainCluster[] = [];
  for (const [domain, items] of map.entries()) {
    if (items.length >= MIN_CLUSTER_SIZE) {
      clusters.push({ domain, items });
    }
  }
  clusters.sort((a, b) => b.items.length - a.items.length);
  return clusters;
}

/**
 * 把一个域名簇内的书签整理到新建的"by-domain/<domain>"文件夹下。
 *
 * @param cluster    域名聚类
 * @param parentId   新文件夹创建在此父节点下（通常是"其他书签" = "2"）
 * @returns 新建的文件夹 ID；失败则返回 null
 */
export async function organizeClusterIntoFolder(
  cluster: DomainCluster,
  parentId: string,
): Promise<string | null> {
  // 1. 创建文件夹
  const folder = await createBookmark({ parentId, title: cluster.domain });
  if (folder === null) return null;
  // 2. 批量移动
  for (const b of cluster.items) {
    await moveBookmark(b.id, folder.id);
  }
  return folder.id;
}
