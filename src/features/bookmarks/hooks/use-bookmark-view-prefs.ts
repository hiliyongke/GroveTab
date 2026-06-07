/**
 * useBookmarkViewPrefs — 书签视图用户偏好持久化
 *
 * 集中管理 3 个 localStorage 状态：
 *   - bookmark_view_tab      (tree / recent)
 *   - bookmark_sort          (default / name / recent)
 *   - bookmark_collapsed_dirs (string[])
 *
 * 使用统一的 localStorage 写入容错（try/catch），避免隐私模式 / 配额爆掉时崩溃。
 */

import { useCallback, useEffect, useState } from "react";

export type BookmarkViewTab = "tree" | "recent";
export type BookmarkSortMode = "default" | "name" | "recent";

const LS_VIEW_TAB = "bookmark_view_tab";
const LS_SORT_MODE = "bookmark_sort";
const LS_COLLAPSED = "bookmark_collapsed_dirs";

function safeRead<T>(key: string, fallback: T, parse: (s: string) => T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return parse(raw);
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 隐私模式或配额已满，忽略 */
  }
}

export interface UseBookmarkViewPrefsResult {
  viewTab: BookmarkViewTab;
  setViewTab: (v: BookmarkViewTab) => void;
  sortMode: BookmarkSortMode;
  setSortMode: (m: BookmarkSortMode) => void;
  collapsedDirs: Set<string>;
  toggleCollapsed: (id: string) => void;
  expandAll: (ids: string[]) => void;
  collapseAll: (ids: string[]) => void;
}

function readCollapsed(): Set<string> {
  return safeRead<Set<string>>(LS_COLLAPSED, new Set<string>(), (raw) => {
    try {
      const arr = JSON.parse(raw) as unknown;
      return new Set(Array.isArray(arr) ? arr.filter((v): v is string => typeof v === "string") : []);
    } catch {
      return new Set<string>();
    }
  });
}

function writeCollapsed(set: Set<string>): void {
  safeWrite(LS_COLLAPSED, JSON.stringify(Array.from(set)));
}

export function useBookmarkViewPrefs(): UseBookmarkViewPrefsResult {
  const [viewTab, setViewTabState] = useState<BookmarkViewTab>(
    () => safeRead<BookmarkViewTab>(LS_VIEW_TAB, "tree", (s) => s as BookmarkViewTab),
  );
  const [sortMode, setSortModeState] = useState<BookmarkSortMode>(
    () => safeRead<BookmarkSortMode>(LS_SORT_MODE, "default", (s) => s as BookmarkSortMode),
  );
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(readCollapsed);

  const setViewTab = useCallback((v: BookmarkViewTab) => {
    setViewTabState(v);
    safeWrite(LS_VIEW_TAB, v);
  }, []);

  const setSortMode = useCallback((m: BookmarkSortMode) => {
    setSortModeState(m);
    safeWrite(LS_SORT_MODE, m);
  }, []);

  const toggleCollapsed = useCallback((id: string) => {
    setCollapsedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeCollapsed(next);
      return next;
    });
  }, []);

  const expandAll = useCallback((ids: string[]) => {
    const next = new Set<string>();
    setCollapsedDirs(next);
    writeCollapsed(next);
    // ids 留作将来扩展（例如 "只展开选中"）
    void ids;
  }, []);

  const collapseAll = useCallback((ids: string[]) => {
    const next = new Set<string>(ids);
    setCollapsedDirs(next);
    writeCollapsed(next);
  }, []);

  // 跨 tab 同步：当其他窗口改变折叠状态时同步
  useEffect(() => {
    const onStorage = (e: StorageEvent): void => {
      if (e.key === LS_COLLAPSED) setCollapsedDirs(readCollapsed());
      else if (e.key === LS_VIEW_TAB && e.newValue !== null)
        setViewTabState(e.newValue as BookmarkViewTab);
      else if (e.key === LS_SORT_MODE && e.newValue !== null)
        setSortModeState(e.newValue as BookmarkSortMode);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return {
    viewTab,
    setViewTab,
    sortMode,
    setSortMode,
    collapsedDirs,
    toggleCollapsed,
    expandAll,
    collapseAll,
  };
}
