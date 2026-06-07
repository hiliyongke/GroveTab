/**
 * useBookmarkTree — 加载/刷新/缓存完整书签树
 *
 * 负责：
 *   - 调用 chrome.bookmarks API
 *   - 权限缺失检测
 *   - 内部 ref 缓存（避免不必要的网络）
 *   - SW 事件 → 自动失效缓存
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getBookmarkTree,
  hasBookmarksPermission,
  requestBookmarksPermission,
  type BookmarkNode,
} from "@/chrome/bookmarks";
import { feedback } from "@/shared/ui/feedback";
import { translate } from "@/shared/i18n/core";

export interface UseBookmarkTreeResult {
  tree: BookmarkNode[];
  loading: boolean;
  permissionDenied: boolean;
  /** 强制刷新（清空缓存重新拉取） */
  refresh: () => Promise<void>;
  /** 触发权限请求；授权成功后自动加载 */
  requestPermission: () => Promise<void>;
  /** 主动清空缓存（CRUD 后调用） */
  invalidate: () => void;
}

export function useBookmarkTree(): UseBookmarkTreeResult {
  const [tree, setTree] = useState<BookmarkNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const cacheRef = useRef<BookmarkNode[] | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const has = await hasBookmarksPermission();
      if (!has) {
        setPermissionDenied(true);
        return;
      }
      setPermissionDenied(false);
      if (!force && cacheRef.current !== null) {
        setTree(cacheRef.current);
        return;
      }
      const t = await getBookmarkTree();
      cacheRef.current = t;
      setTree(t);
    } catch {
      setPermissionDenied(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => load(true), [load]);

  const requestPermission = useCallback(async () => {
    const ok = await requestBookmarksPermission();
    if (ok) {
      setPermissionDenied(false);
      await load(true);
    } else {
      feedback.warning(translate("需要书签权限才能管理书签"));
    }
  }, [load]);

  const invalidate = useCallback(() => {
    cacheRef.current = null;
  }, []);

  // 首次加载
  useEffect(() => {
    void load(true);
  }, [load]);

  // SW 事件同步：收到任何 bookmark-* 消息就清缓存
  useEffect(() => {
    const handler = (msg: { type?: string }): void => {
      if (typeof msg.type === "string" && msg.type.startsWith("bookmark-")) {
        cacheRef.current = null;
      }
    };
    chrome.runtime?.onMessage?.addListener?.(handler);
    return () => chrome.runtime?.onMessage?.removeListener?.(handler);
  }, []);

  return { tree, loading, permissionDenied, refresh, requestPermission, invalidate };
}
