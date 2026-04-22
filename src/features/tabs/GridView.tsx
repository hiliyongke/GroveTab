/**
 * GridView — Large cards with favicon/domain color block
 */

import { useMemo } from 'react';
import { useTabsStore } from '@/store';
import { useT } from '@/shared/i18n';
import { groupTabsByDomain } from '@/shared/utils/domain';
import { stringToColor } from '@/shared/utils/color';
import { Volume2 } from 'lucide-react';

export function GridView() {
  const tabs = useTabsStore((s) => s.tabs);
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const { t } = useT();

  const groups = useMemo(() => groupTabsByDomain(tabs), [tabs]);

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-muted">
        <p className="text-lg">{t('tabs.empty')}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {groups.map((group) => {
        const domain = group.domain;
        const color = stringToColor(domain);
        const hasAudible = group.tabs.some((tab) => tab.audible);

        return (
          <button
            key={domain}
            onClick={() => {
              const first = group.tabs[0];
              if (first) jumpToTab(first.id, first.windowId);
            }}
            className="group flex flex-col items-start gap-2 p-4 rounded-[var(--radius-lg)]
              bg-surface hover:bg-surface-hover backdrop-blur-xl border border-border
              transition-colors duration-200 cursor-pointer text-left
              focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
          >
            {/* Thumbnail area */}
            <div
              className="w-full h-20 rounded-[var(--radius-md)] flex items-center justify-center overflow-hidden"
              style={{ backgroundColor: color + '30' }}
            >
              {group.tabs[0]?.favIconUrl ? (
                <img
                  src={group.tabs[0].favIconUrl}
                  alt=""
                  className="w-10 h-10 rounded"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <span className="text-2xl font-bold text-white/80">
                  {domain.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Domain name */}
            <div className="flex items-center gap-1.5 w-full">
              <span className="text-sm font-medium text-text truncate flex-1">{domain}</span>
              {hasAudible && <Volume2 className="w-3 h-3 text-text-muted flex-shrink-0" />}
            </div>

            {/* Tab count */}
            <span className="text-xs text-text-muted">
              {t('header.tabCount', { count: group.tabs.length })}
            </span>
          </button>
        );
      })}
    </div>
  );
}
