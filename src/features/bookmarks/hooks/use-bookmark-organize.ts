import { useState, useCallback } from "react";
import type { DomainCluster } from "../bookmark-tools";
import { clusterBookmarksByDomain, organizeClusterIntoFolder } from "../bookmark-tools";
import { getBookmarkTree } from "@/chrome/bookmarks";
import { feedback } from "@/shared/ui/feedback";
import { useT } from "@/shared/i18n";

export function useBookmarkOrganize(onMutated: () => void, refreshOverview: () => Promise<void>) {
  const { t } = useT();
  const [clusters, setClusters] = useState<DomainCluster[] | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);
  const [selectedClusters, setSelectedClusters] = useState<Set<string>>(new Set());
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);

  const scanClusters = useCallback(async () => {
    setOrgLoading(true);
    const tree = await getBookmarkTree();
    const c = clusterBookmarksByDomain(tree);
    setClusters(c);
    setSelectedClusters(new Set(c.map((x) => x.domain)));
    setOrgLoading(false);
  }, []);

  const applyOrganize = useCallback(async () => {
    if (clusters === null) return;
    const parentId = "2"; // "其他书签"
    let created = 0;
    for (const c of clusters) {
      if (!selectedClusters.has(c.domain)) continue;
      const fid = await organizeClusterIntoFolder(c, parentId);
      if (fid !== null) created += 1;
    }
    feedback.success(t('已创建 {count} 个分类文件夹', { count: created }));
    onMutated();
    setClusters(null);
    void refreshOverview();
  }, [clusters, selectedClusters, t, onMutated, refreshOverview]);

  return {
    clusters,
    orgLoading,
    selectedClusters,
    setSelectedClusters,
    expandedCluster,
    setExpandedCluster,
    scanClusters,
    applyOrganize,
  };
}
