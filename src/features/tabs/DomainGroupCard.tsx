/**
 * DomainGroupCard — Collapsible card for a domain group
 */

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { DomainGroup } from '@/shared/utils/domain';
import { getGroupFavicon } from '@/shared/utils/domain';
import { TabItem } from './TabItem';
import { useTabsStore } from '@/store';

interface DomainGroupCardProps {
  group: DomainGroup;
  initialCollapsed?: boolean;
}

export function DomainGroupCard({ group, initialCollapsed = false }: DomainGroupCardProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const closeSingleTab = useTabsStore((s) => s.closeSingleTab);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const favicon = getGroupFavicon(group.tabs);

  return (
    <div className="mb-3">
      {/* Group header */}
      <button
        type="button"
        onClick={toggleCollapse}
        className="group flex items-center gap-3 w-full px-4 py-3 rounded-[var(--radius-lg)]
          bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/15
          transition-all duration-200 cursor-pointer text-left"
      >
        {/* Collapse icon */}
        {collapsed ? (
          <ChevronRight className="w-4 h-4 text-white/40 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/40 flex-shrink-0" />
        )}

        {/* Favicon */}
        {favicon ? (
          <img
            src={favicon}
            alt=""
            className="w-5 h-5 rounded flex-shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-5 h-5 rounded bg-white/20 flex-shrink-0" />
        )}

        {/* Domain name */}
        <span className="text-sm font-semibold text-white/80 flex-1 truncate">
          {group.domain}
        </span>

        {/* Tab count badge */}
        <span className="px-2 py-0.5 rounded-full bg-white/15 text-xs text-white/50 font-medium flex-shrink-0">
          {group.tabs.length}
        </span>
      </button>

      {/* Tab list (expanded) */}
      {!collapsed && (
        <div className="mt-1.5 ml-6 flex flex-col gap-1.5">
          {group.tabs.map((tab) => (
            <TabItem
              key={tab.id}
              tab={tab}
              onJump={jumpToTab}
              onClose={closeSingleTab}
            />
          ))}
        </div>
      )}
    </div>
  );
}
