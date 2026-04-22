/**
 * DomainGroupCard — Collapsible card for a domain group
 */

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import type { DomainGroup } from '@/shared/utils/domain';
import { getGroupFavicon } from '@/shared/utils/domain';
import { TabItem } from './TabItem';
import { useTabsStore } from '@/store';
import { useT } from '@/shared/i18n';

interface DomainGroupCardProps {
  group: DomainGroup;
  initialCollapsed?: boolean;
}

export function DomainGroupCard({ group, initialCollapsed = false }: DomainGroupCardProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const closeSingleTab = useTabsStore((s) => s.closeSingleTab);
  const closeDomainGroup = useTabsStore((s) => s.closeDomainGroup);
  const { t } = useT();

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const handleCloseAll = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    closeDomainGroup(group.domain);
  }, [closeDomainGroup, group.domain]);

  const favicon = getGroupFavicon(group.tabs);

  return (
    <div className="mb-3">
      {/* Group header */}
      <button
        type="button"
        onClick={toggleCollapse}
        aria-label={collapsed ? t('tabs.collapse') : t('tabs.expand')}
        className="group flex items-center gap-3 w-full px-4 py-3 rounded-[var(--radius-lg)]
          bg-surface hover:bg-surface-hover backdrop-blur-xl border border-border
          transition-colors duration-200 cursor-pointer text-left
          focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
      >
        {/* Collapse icon */}
        {collapsed ? (
          <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-text-muted flex-shrink-0" />
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
          <div className="w-5 h-5 rounded bg-surface flex-shrink-0" />
        )}

        {/* Domain name */}
        <span className="text-sm font-semibold text-text flex-1 truncate">
          {group.domain}
        </span>

        {/* Tab count badge */}
        <span className="px-2 py-0.5 rounded-full bg-badge text-xs text-text-secondary font-medium flex-shrink-0">
          {group.tabs.length}
        </span>

        {/* Close all button */}
        <span
          onClick={handleCloseAll}
          role="button"
          tabIndex={0}
          aria-label={t('tabs.closeDomain')}
          className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center
            rounded-full hover:bg-red-500/30 text-text-muted hover:text-red-300
            transition-colors duration-150 flex-shrink-0"
        >
          <X className="w-4 h-4" />
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
