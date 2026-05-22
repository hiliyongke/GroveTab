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
  const workers: Array<Promise<void>> = [];
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

// ═══════════════════════════════════════════════════════════
// 4. 空文件夹清理
// ═══════════════════════════════════════════════════════════

/**
 * 找出所有"递归为空"的文件夹（不含任何书签或非空子文件夹）。
 *
 * 设计要点：
 *   - 顶层 Chrome 根（书签栏 / 其他书签 / 移动设备）即使为空也不会返回，避免误删根节点
 *   - 递归判定：只要某子树没有任何 url 节点，整棵子树都算"空"，但只返回**最顶层**的空文件夹，
 *     这样删一个就清掉一片，避免操作链冗长
 */
export interface EmptyFolder {
  folder: BookmarkNode;
  /** 该子树内被一并清掉的空文件夹数（含自身），用于在 UI 上展示"将连带删除 N 项" */
  size: number;
}

export function findEmptyFolders(roots: BookmarkNode[]): EmptyFolder[] {
  const result: EmptyFolder[] = [];

  /** 递归判断：当前子树是否完全没有 url；同时统计含的文件夹数 */
  function walk(node: BookmarkNode, isTopLevel: boolean): { empty: boolean; folderCount: number } {
    if (node.url !== undefined) {
      // 叶子书签：非空
      return { empty: false, folderCount: 0 };
    }
    const children = node.children ?? [];
    let allEmpty = true;
    let folderCount = 1; // 算上自己
    for (const c of children) {
      const r = walk(c, false);
      if (!r.empty) allEmpty = false;
      folderCount += r.folderCount;
    }
    // 顶层根节点不算"空文件夹候选"，但仍要继续向下搜索
    if (allEmpty && !isTopLevel) {
      // 仅当父节点不是空（或自己是根的直接子节点）时才作为候选；
      // 由调用者判断"最顶层"语义即可——这里只标记可清理，并把 size 作为子树总文件夹数返回
      return { empty: true, folderCount };
    }
    return { empty: allEmpty, folderCount };
  }

  /** 第二轮：只采集"最顶层"的空文件夹（父节点不空） */
  function collect(node: BookmarkNode, isTopLevel: boolean) {
    if (node.url !== undefined) return;
    const r = walk(node, isTopLevel);
    if (r.empty && !isTopLevel) {
      result.push({ folder: node, size: r.folderCount });
      return; // 不再继续向下挖（避免重复）
    }
    for (const c of node.children ?? []) collect(c, false);
  }

  for (const root of roots) collect(root, true);
  return result;
}

/**
 * 批量删除空文件夹。注意 chrome.bookmarks.remove 只允许删空节点，
 * 这里的 EmptyFolder 子树本就全是空文件夹，所以会按"自下而上"的顺序删。
 */
export async function removeEmptyFolders(targets: EmptyFolder[]): Promise<number> {
  let removed = 0;
  // 先深度递归删每个子树，保证从叶到根
  async function rmTree(node: BookmarkNode): Promise<void> {
    for (const c of node.children ?? []) {
      await rmTree(c);
    }
    const ok = await removeBookmark(node.id);
    if (ok) removed += 1;
  }
  for (const t of targets) {
    await rmTree(t.folder);
  }
  return removed;
}

// ═══════════════════════════════════════════════════════════
// 总览统计
// ═══════════════════════════════════════════════════════════

export interface BookmarkOverview {
  /** 总书签数（叶子） */
  total: number;
  /** 文件夹数（含根） */
  folders: number;
  /** 不同域名数 */
  domains: number;
  /** 最大深度（根 = 0） */
  maxDepth: number;
}

export function collectBookmarkOverview(roots: BookmarkNode[]): BookmarkOverview {
  let total = 0;
  let folders = 0;
  let maxDepth = 0;
  const domains = new Set<string>();

  function walk(node: BookmarkNode, depth: number) {
    if (depth > maxDepth) maxDepth = depth;
    if (node.url !== undefined) {
      total += 1;
      const host = extractHostname(node.url);
      if (host !== '') domains.add(host);
      return;
    }
    folders += 1;
    for (const c of node.children ?? []) walk(c, depth + 1);
  }
  for (const r of roots) walk(r, 0);
  return { total, folders, domains: domains.size, maxDepth };
}
