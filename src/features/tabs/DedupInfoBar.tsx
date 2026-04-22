/**
 * DedupInfoBar — Non-intrusive bar showing duplicate tab warning
 */

import { useState, useMemo } from 'react';
import { AlertTriangle, ChevronDown, X } from 'lucide-react';
import { useTabsStore } from '@/store';
import { findDuplicates, type DupGroup } from '@/shared/utils/dedupe';
import { useT } from '@/shared/i18n';

export function DedupInfoBar() {
  const tabs = useTabsStore((s) => s.tabs);
  const closeMultipleTabs = useTabsStore((s) => s.closeMultipleTabs);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { t } = useT();

  const dupGroups = useMemo(() => findDuplicates(tabs), [tabs]);

  if (dismissed || dupGroups.length === 0) return null;

  const totalDupTabs = dupGroups.reduce((sum, g) => sum + g.tabs.length - 1, 0);

  const handleMergeGroup = (group: DupGroup) => {
    // Keep the first tab, close the rest
    const toClose = group.tabs.slice(1).map((tab) => tab.id);
    closeMultipleTabs(toClose);
  };

  const handleMergeAll = () => {
    const toClose = dupGroups.flatMap((g) => g.tabs.slice(1).map((tab) => tab.id));
    closeMultipleTabs(toClose);
  };

  return (
    <div className="mb-4 px-4 py-2.5 rounded-[var(--radius-md)] bg-amber-500/15 border border-amber-500/30 text-amber-200 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{t('dedup.found', { count: dupGroups.length, tabs: totalDupTabs })}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleMergeAll}
            className="px-2.5 py-1 rounded-[var(--radius-sm)] bg-amber-500/25 hover:bg-amber-500/40 text-xs font-medium transition-colors duration-150 cursor-pointer"
          >
            {t('dedup.mergeAll')}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-amber-500/25 cursor-pointer"
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-amber-500/25 cursor-pointer"
            aria-label={t('dedup.dismiss')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-2 space-y-2">
          {dupGroups.map((group) => (
            <div key={group.canonicalUrl} className="flex items-center justify-between bg-amber-500/10 rounded-[var(--radius-sm)] px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs truncate">{group.tabs[0]?.title || group.canonicalUrl}</p>
                <p className="text-xs text-amber-300/60 mt-0.5">{group.tabs.length}x 重复</p>
              </div>
              <button
                onClick={() => handleMergeGroup(group)}
                className="px-2 py-1 rounded-[var(--radius-sm)] bg-amber-500/20 hover:bg-amber-500/35 text-xs cursor-pointer ml-2"
              >
                {t('dedup.merge')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
