import { useState, useCallback } from "react";
import type { DuplicateBookmarkGroup } from "../bookmark-tools";
import { findDuplicateBookmarks, mergeDuplicateBookmarks } from "../bookmark-tools";
import { getBookmarkTree } from "@/chrome/bookmarks";
import { feedback } from "@/shared/ui/feedback";
import { useT } from "@/shared/i18n";

export function useBookmarkDedupe(
  dedupStrictness: string,
  onMutated: () => void,
  refreshOverview: () => Promise<void>,
) {
  const { t } = useT();
  const [dups, setDups] = useState<DuplicateBookmarkGroup[] | null>(null);
  const [dupLoading, setDupLoading] = useState(false);

  const scanDuplicates = useCallback(async () => {
    setDupLoading(true);
    const tree = await getBookmarkTree();
    setDups(
      findDuplicateBookmarks(tree, dedupStrictness as "off" | "strict" | "loose" | undefined),
    );
    setDupLoading(false);
  }, [dedupStrictness]);

  const applyDedupe = useCallback(async () => {
    if (dups === null) return;
    const removed = await mergeDuplicateBookmarks(dups);
    feedback.success(t("bookmark.tools.dedupeDone", { count: removed }));
    onMutated();
    setDups(null);
    void refreshOverview();
  }, [dups, t, onMutated, refreshOverview]);

  return { dups, dupLoading, scanDuplicates, applyDedupe };
}
