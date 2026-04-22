/**
 * DomainGroupView — Default view: tabs grouped by registered domain
 */

import { useMemo } from 'react';
import { useTabsStore, useMetadataStore } from '@/store';
import { groupTabsByDomain } from '@/shared/utils/domain';
import { DomainGroupCard } from './DomainGroupCard';
import { useT } from '@/shared/i18n';

export function DomainGroupView() {
  const tabs = useTabsStore((s) => s.tabs);
  const pinnedUrls = useMetadataStore((s) => s.pinnedUrls);
  const { t } = useT();

  const groups = useMemo(() => groupTabsByDomain(tabs), [tabs]);

  // Sort groups: those with pinned tabs come first
  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => {
      const aHasPinned = a.tabs.some((tab) => pinnedUrls.has(tab.url.replace(/#.*$/, '').replace(/\/+$/, '')));
      const bHasPinned = b.tabs.some((tab) => pinnedUrls.has(tab.url.replace(/#.*$/, '').replace(/\/+$/, '')));
      if (aHasPinned && !bHasPinned) return -1;
      if (!aHasPinned && bHasPinned) return 1;
      if (b.tabs.length !== a.tabs.length) return b.tabs.length - a.tabs.length;
      return 0;
    });
  }, [groups, pinnedUrls]);

  if (sortedGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white/50">
        <p className="text-lg">{t('tabs.empty')}</p>
        <p className="text-sm mt-2">{t('tabs.emptyHint')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="text-sm text-white/40 mb-3 px-1">
        {t('header.tabCount', { count: tabs.length })} · {t('view.domain', { count: sortedGroups.length })}
      </div>
      {sortedGroups.map((group) => (
        <DomainGroupCard
          key={group.domain}
          group={group}
          initialCollapsed={group.tabs.length > 10}
        />
      ))}
    </div>
  );
}
