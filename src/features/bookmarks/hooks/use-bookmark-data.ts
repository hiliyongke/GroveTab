/**
 * useBookmarkData — 书签数据管理 Hook
 *
 * 管理书签树数据、权限检查和自动刷新
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getBookmarkTree,
  createBookmark,
  requestBookmarksPermission,
  hasBookmarksPermission,
  type BookmarkNode,
} from "@/chrome/bookmarks";
import { feedback } from "@/shared/ui/feedback";
import { translate } from "@/shared/i18n/core";
import { useBookmarkSync } from "./use-bookmark-sync";
import { countBookmarks } from "../utils/tree-helpers";

interface UseBookmarkDataReturn {
  hasPermission: boolean;
  checking: boolean;
  bookmarks: BookmarkNode[];
  topSections: BookmarkNode[];
  totalBookmarks: number;
  refreshBookmarks: () => Promise<void>;
  handleRequestPermission: () => Promise<void>;
  handleBookmarkAll: (tabs: Array<{ url: string; title: string }>) => Promise<void>;
}

export function useBookmarkData(_tabs: Array<{ url: string; title: string }>): UseBookmarkDataReturn {
  const [hasPermission, setHasPermission] = useState(false);
  const [checking, setChecking] = useState(true);
  const [bookmarks, setBookmarks] = useState<BookmarkNode[]>([]);

  /** 刷新书签树 */
  const refreshBookmarks = useCallback(async () => {
    const tree = await getBookmarkTree();
    setBookmarks(tree);
  }, []);

  /** 检查权限 */
  useEffect(() => {
    void hasBookmarksPermission().then((has) => {
      setHasPermission(has);
      setChecking(false);
      if (has) {
        void refreshBookmarks();
      }
    });
  }, [refreshBookmarks]);

  /** 实时同步：监听 SW 广播的书签变更事件 */
  useBookmarkSync(() => {
    void refreshBookmarks();
  }, hasPermission);

  const handleRequestPermission = useCallback(async () => {
    const granted = await requestBookmarksPermission();
    if (granted) {
      setHasPermission(true);
      await refreshBookmarks();
    } else {
      feedback.error(translate("书签权限被拒绝"));
    }
  }, [refreshBookmarks]);

  const handleBookmarkAll = useCallback(
    async (currentTabs: Array<{ url: string; title: string }>) => {
      let count = 0;
      for (const tab of currentTabs) {
        if (!tab.url.startsWith("chrome://") && !tab.url.startsWith("chrome-extension://")) {
          const result = await createBookmark({ title: tab.title, url: tab.url });
          if (result !== null) count++;
        }
      }
      feedback.success(translate("已收藏 {count} 个标签页", { count }));
      await refreshBookmarks();
    },
    [refreshBookmarks],
  );

  /**
   * 顶层分区。Chrome bookmark tree 的根（id=0）只有一个，其 children 才是
   * 「书签栏(1)/其他书签(2)/移动设备书签(3)」。我们把所有第一/二层文件夹拍平作为分区。
   */
  const topSections = useMemo(() => {
    const result: BookmarkNode[] = [];
    const visit = (nodes: BookmarkNode[]) => {
      for (const n of nodes) {
        if (n.url) continue;
        if (n.id === "0") {
          if (n.children) visit(n.children);
          continue;
        }
        result.push(n);
      }
    };
    visit(bookmarks);
    return result.filter((s) => countBookmarks(s.children) > 0);
  }, [bookmarks]);

  /** 总书签数 */
  const totalBookmarks = useMemo(
    () => topSections.reduce((sum, s) => sum + countBookmarks(s.children), 0),
    [topSections],
  );

  return {
    hasPermission,
    checking,
    bookmarks,
    topSections,
    totalBookmarks,
    refreshBookmarks,
    handleRequestPermission,
    handleBookmarkAll,
  };
}
