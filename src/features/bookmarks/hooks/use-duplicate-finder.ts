/**
 * useDuplicateFinder — 重复书签检测 + 批量清理
 *
 * 重复判定：URL 完全相等（lowercase）。后续可扩展到 "url + title" 双键。
 *
 * 设计：
 *   - `compute(nodes)` 一次性计算并写入状态（内部用 requestIdleCallback 切片，避免大树下卡顿）
 *   - `removeGroup / removeAll` 清理并自动从状态移除
 *   - `reset` 清空（重新检测时使用）
 *
 * 性能：计算是 O(n)。对于 10k+ 书签，使用 `requestIdleCallback` 把任务延后到浏览器空闲时执行，
 * 避免阻塞 UI 渲染。
 */

import { useCallback, useState } from "react";
import { removeBookmark } from "@/chrome/bookmarks";
import type { BookmarkNode } from "@/chrome/bookmarks";
import { collectUrlBookmarks } from "../utils/bookmark-tree";
import { feedback } from "@/shared/ui/feedback";
import { useT } from "@/shared/i18n";

export interface DuplicateGroup {
  url: string;
  items: BookmarkNode[];
}

export interface UseDuplicateFinderResult {
  duplicates: DuplicateGroup[];
  /** 扫描并写入结果（覆盖现有结果）。大树下异步执行以避免阻塞主线程。 */
  compute: (nodes: BookmarkNode[]) => void;
  /** 清理单个组的重复项（保留首项，删除其余） */
  removeGroup: (group: DuplicateGroup) => Promise<number>;
  /** 一键清理全部 */
  removeAll: () => Promise<number>;
  reset: () => void;
}

/** 纯函数：URL 完全相等视为重复 */
export function findDuplicateGroups(nodes: BookmarkNode[]): DuplicateGroup[] {
  const map = new Map<string, BookmarkNode[]>();
  for (const n of collectUrlBookmarks(nodes)) {
    if (n.url === undefined) continue;
    const key = n.url.toLowerCase();
    const list = map.get(key);
    if (list !== undefined) list.push(n);
    else map.set(key, [n]);
  }
  return Array.from(map.entries())
    .filter(([, v]) => v.length > 1)
    .map(([url, items]) => ({ url, items }));
}

/** 大树阈值：超过此值走异步分片 */
const IDLE_THRESHOLD = 2000;

export function useDuplicateFinder(): UseDuplicateFinderResult {
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const { t } = useT();

  const compute = useCallback((nodes: BookmarkNode[]): void => {
    if (nodes.length < IDLE_THRESHOLD) {
      // 小数据：直接同步计算
      const groups = findDuplicateGroups(nodes);
      setDuplicates(groups);
      return;
    }

    // 大数据：分片异步执行，**不阻塞** UI
    const win = window as typeof window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    };
    const urlNodes = collectUrlBookmarks(nodes);
    const map = new Map<string, BookmarkNode[]>();
    const CHUNK = 500;
    let cursor = 0;

    const step = (): void => {
      const end = Math.min(cursor + CHUNK, urlNodes.length);
      for (let i = cursor; i < end; i++) {
        const n = urlNodes[i];
        if (n === undefined || n.url === undefined) continue;
        const key = n.url.toLowerCase();
        const list = map.get(key);
        if (list !== undefined) list.push(n);
        else map.set(key, [n]);
      }
      cursor = end;
      if (cursor < urlNodes.length) {
        if (win.requestIdleCallback !== undefined) {
          win.requestIdleCallback(step, { timeout: 50 });
        } else {
          setTimeout(step, 0);
        }
      } else {
        const groups: DuplicateGroup[] = Array.from(map.entries())
          .filter(([, v]) => v.length > 1)
          .map(([url, items]) => ({ url, items }));
        setDuplicates(groups);
      }
    };
    step();
  }, []);

  const removeGroup = useCallback(
    async (group: DuplicateGroup): Promise<number> => {
      const [, ...rest] = group.items;
      let count = 0;
      for (const item of rest) {
        const ok = await removeBookmark(item.id);
        if (ok) count++;
      }
      feedback.success(t("已清理 {n} 个重复书签", { n: count }));
      setDuplicates((prev) => prev.filter((g) => g.url !== group.url));
      return count;
    },
    [t],
  );

  const removeAll = useCallback(async (): Promise<number> => {
    let count = 0;
    for (const group of duplicates) {
      const [, ...rest] = group.items;
      for (const item of rest) {
        const ok = await removeBookmark(item.id);
        if (ok) count++;
      }
    }
    feedback.success(t("已清理 {n} 个重复书签", { n: count }));
    setDuplicates([]);
    return count;
  }, [duplicates, t]);

  const reset = useCallback(() => setDuplicates([]), []);

  return { duplicates, compute, removeGroup, removeAll, reset };
}
