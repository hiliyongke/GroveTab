import { useState, useCallback, useMemo } from "react";
import type { BookmarkHealth } from "../bookmark-tools";
import { checkBookmarkHealth, removeDeadBookmarks } from "../bookmark-tools";
import { getBookmarkTree } from "@/chrome/bookmarks";
import { useT } from "@/shared/i18n";
import { feedback } from "@/shared/ui/feedback";
import type { BookmarkNode } from "@/chrome/bookmarks";

export function useBookmarkHealth(onMutated: () => void, refreshOverview: () => Promise<void>) {
  const { t } = useT();
  const [healthResults, setHealthResults] = useState<BookmarkHealth[] | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthProgress, setHealthProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [healthPermission, setHealthPermission] = useState<boolean | null>(null);
  const [healthFilter, setHealthFilter] = useState<"all" | "dead" | "timeout" | "ok">("dead");

  const checkHealth = useCallback(async () => {
    const granted = await chrome.permissions.request({ origins: ["<all_urls>"] });
    setHealthPermission(granted);
    if (!granted) {
      feedback.error(t("bookmark.tools.healthNeedPermission"));
      return;
    }
    setHealthLoading(true);
    setHealthProgress({ done: 0, total: 0 });
    const tree = await getBookmarkTree();
    const flat: BookmarkNode[] = [];
    const walk = (nodes: BookmarkNode[]) => {
      for (const n of nodes) {
        if ((n.url ?? "") !== "") flat.push(n);
        if (n.children !== undefined) walk(n.children);
      }
    };
    walk(tree);
    const results = await checkBookmarkHealth(flat, (done, total) => {
      setHealthProgress({ done, total });
    });
    setHealthResults(results);
    setHealthLoading(false);
  }, [t]);

  const applyRemoveDead = useCallback(async () => {
    if (healthResults === null) return;
    const removed = await removeDeadBookmarks(healthResults);
    feedback.success(t("bookmark.tools.healthDone", { count: removed }));
    onMutated();
    setHealthResults(null);
    void refreshOverview();
  }, [healthResults, t, onMutated, refreshOverview]);

  const filteredHealth = useMemo(() => {
    if (healthResults === null) return [];
    if (healthFilter === "all") return healthResults;
    return healthResults.filter((r) => r.status === healthFilter);
  }, [healthResults, healthFilter]);

  const deadList = useMemo(
    () => healthResults?.filter((r) => r.status === "dead" || r.status === "timeout") ?? [],
    [healthResults],
  );

  const healthStats = useMemo(() => {
    if (healthResults === null) return null;
    const ok = healthResults.filter((r) => r.status === "ok").length;
    const dead = healthResults.filter((r) => r.status === "dead").length;
    const timeout = healthResults.filter((r) => r.status === "timeout").length;
    const skipped = healthResults.filter((r) => r.status === "skipped").length;
    return { ok, dead, timeout, skipped, total: healthResults.length };
  }, [healthResults]);

  return {
    healthResults,
    healthLoading,
    healthProgress,
    healthPermission,
    healthFilter,
    setHealthFilter,
    filteredHealth,
    deadList,
    healthStats,
    checkHealth,
    applyRemoveDead,
  };
}
