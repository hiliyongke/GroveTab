/**
 * TabItem — Single tab row in the list view
 */

import type { LiveTab } from '@/shared/types';
import { Globe, Volume2, Pin } from 'lucide-react';
import { useT } from '@/shared/i18n';

interface TabItemProps {
  tab: LiveTab;
  onJump: (tabId: number, windowId: number) => void;
  onClose: (tabId: number) => void;
}

export function TabItem({ tab, onJump, onClose }: TabItemProps) {
  const { t } = useT();
  const handleClick = () => onJump(tab.id, tab.windowId);
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose(tab.id);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
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
        <div className="text-sm text-text truncate font-medium">
          {tab.title}
        </div>
        <div className="text-xs text-text-secondary truncate">
          {tab.hostname}
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {tab.pinned && <Pin className="w-3.5 h-3.5 text-text-muted" />}
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
  );
}
