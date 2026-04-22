/**
 * CompactView — Virtualized flat list of all tabs
 */

import { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTabsStore } from '@/store';
import { useT } from '@/shared/i18n';
import { Globe, Volume2, Pin, X } from 'lucide-react';

const ROW_HEIGHT = 40;

export function CompactView() {
  const tabs = useTabsStore((s) => s.tabs);
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const closeSingleTab = useTabsStore((s) => s.closeSingleTab);
  const { t } = useT();

  const sortedTabs = useMemo(
    () => [...tabs].sort((a, b) => b.lastAccessed - a.lastAccessed),
    [tabs],
  );

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: sortedTabs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  if (sortedTabs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-muted">
        <p className="text-lg">{t('tabs.empty')}</p>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="max-h-[70vh] overflow-y-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const tab = sortedTabs[virtualRow.index];
          return (
            <div
              key={tab.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="flex items-center gap-2 px-3 hover:bg-surface-hover rounded-[var(--radius-sm)] cursor-pointer transition-colors duration-100 group"
              onClick={() => jumpToTab(tab.id, tab.windowId)}
            >
              <img
                src={tab.favIconUrl}
                alt=""
                className="w-4 h-4 rounded flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <span className="text-sm text-text truncate flex-1">{tab.title}</span>
              <span className="text-xs text-text-muted truncate max-w-[120px]">{tab.hostname}</span>
              <div className="flex items-center gap-1 flex-shrink-0">
                {tab.pinned && <Pin className="w-3 h-3 text-text-muted" />}
                {tab.audible && <Volume2 className="w-3 h-3 text-text-muted" />}
                {!tab.isCurrentWindow && <Globe className="w-3 h-3 text-text-muted" />}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); closeSingleTab(tab.id); }}
                className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-500/30 text-text-muted hover:text-red-300 transition-colors duration-100 cursor-pointer"
                aria-label={t('tabs.close')}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
