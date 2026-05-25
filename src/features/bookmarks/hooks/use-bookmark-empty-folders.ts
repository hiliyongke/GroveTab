import { useState, useCallback } from "react";
import type { EmptyFolder } from "../bookmark-tools";
import { findEmptyFolders, removeEmptyFolders } from "../bookmark-tools";
import { getBookmarkTree } from "@/chrome/bookmarks";
import { feedback } from "@/shared/ui/feedback";
import { useT } from "@/shared/i18n";

export function useBookmarkEmptyFolders(
  onMutated: () => void,
  refreshOverview: () => Promise<void>,
) {
  const { t } = useT();
  const [emptyFolders, setEmptyFolders] = useState<EmptyFolder[] | null>(null);
  const [emptyLoading, setEmptyLoading] = useState(false);

  const scanEmptyFolders = useCallback(async () => {
    setEmptyLoading(true);
    const tree = await getBookmarkTree();
    setEmptyFolders(findEmptyFolders(tree));
    setEmptyLoading(false);
  }, []);

  const applyRemoveEmpty = useCallback(async () => {
    if (emptyFolders === null) return;
    const removed = await removeEmptyFolders(emptyFolders);
    feedback.success(t('已清理 {count} 个空文件夹', { count: removed }));
    onMutated();
    setEmptyFolders(null);
    void refreshOverview();
  }, [emptyFolders, t, onMutated, refreshOverview]);

  return {
    emptyFolders,
    emptyLoading,
    scanEmptyFolders,
    applyRemoveEmpty,
  };
}
