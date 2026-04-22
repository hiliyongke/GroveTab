/**
 * TabItem — Single tab row in the list view
 */

import { useState } from 'react';
import type { LiveTab } from '@/shared/types';
import { Globe, Volume2, Pin, MessageSquare } from 'lucide-react';
import { useT } from '@/shared/i18n';
import { useMetadataStore } from '@/store';
import { stringToColor } from '@/shared/utils/color';
import { TabContextMenu } from './TabContextMenu';

interface TabItemProps {
  tab: LiveTab;
  onJump: (tabId: number, windowId: number) => void;
  onClose: (tabId: number) => void;
}

export function TabItem({ tab, onJump, onClose }: TabItemProps) {
  const { t } = useT();
  const isPinned = useMetadataStore((s) => s.isPinned(tab.url));
  const tags = useMetadataStore((s) => s.getTags(tab.url));
  const note = useMetadataStore((s) => s.getNote(tab.url));
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleClick = () => onJump(tab.id, tab.windowId);
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose(tab.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className="group flex items-center gap-3 w-full px-4 py-2.5 rounded-[var(--radius-md)]
          bg-surface hover:bg-surface-hover backdrop-blur-xl border border-border
          transition-colors duration-200 text-left cursor-pointer
          focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
      >
        {/* Favicon */}
        <img
          src={tab.favIconUrl}
          alt=""
          className="w-5 h-5 rounded flex-shrink-0"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '';
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />

        {/* Title + Domain */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-text truncate font-medium">{tab.title}</span>
            {isPinned && <Pin className="w-3 h-3 text-text-muted flex-shrink-0" />}
            {note && <MessageSquare className="w-3 h-3 text-text-muted flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-text-secondary truncate">{tab.hostname}</span>
            {tags.map((tag) => (
              <span
                key={tag}
                className="px-1 py-0 rounded text-[10px] font-medium text-white leading-tight"
                style={{ backgroundColor: stringToColor(tag) }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {tab.audible && <Volume2 className="w-3.5 h-3.5 text-text-muted" aria-label={t('tabs.playing')} />}
          {!tab.isCurrentWindow && (
            <span title={t('tabs.otherWindow')} aria-label={t('tabs.otherWindow')}>
              <Globe className="w-3.5 h-3.5 text-text-muted" />
            </span>
          )}
        </div>

        {/* Close button */}
        <span
          onClick={handleClose}
          role="button"
          tabIndex={0}
          aria-label={t('tabs.close')}
          className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center
            rounded-full hover:bg-surface-hover text-text-muted hover:text-text
            transition-colors duration-150 text-sm flex-shrink-0"
        >
          ×
        </span>
      </button>

      {/* Context menu */}
      {contextMenu && (
        <TabContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          url={tab.url}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
