/**
 * DomainGroupView — Default view: tabs grouped by registered domain
 */

import { useMemo } from 'react';
import { useTabsStore } from '@/store';
import { groupTabsByDomain } from '@/shared/utils/domain';
import { DomainGroupCard } from './DomainGroupCard';

export function DomainGroupView() {
  const tabs = useTabsStore((s) => s.tabs);

  const groups = useMemo(() => groupTabsByDomain(tabs), [tabs]);

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white/50">
        <p className="text-lg">没有打开的标签页</p>
        <p className="text-sm mt-2">打开一些网页，然后回到这里查看</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="text-sm text-white/40 mb-3 px-1">
        {tabs.length} 个标签页 · {groups.length} 个域名
      </div>
      {groups.map((group) => (
        <DomainGroupCard
          key={group.domain}
          group={group}
          initialCollapsed={group.tabs.length > 10}
        />
      ))}
    </div>
  );
}
