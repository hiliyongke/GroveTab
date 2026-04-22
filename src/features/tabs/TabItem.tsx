/**
 * TabItem — Single tab row in the list view
 */

import type { LiveTab } from '@/shared/types';
import { Globe, Volume2, Pin } from 'lucide-react';

interface TabItemProps {
  tab: LiveTab;
  onJump: (tabId: number, windowId: number) => void;
  onClose: (tabId: number) => void;
}

export function TabItem({ tab, onJump, onClose }: TabItemProps) {
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
        bg-white/15 hover:bg-white/25 backdrop-blur-xl border border-white/20
        transition-all duration-200 text-left cursor-pointer"
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
        <div className="text-sm text-white/90 truncate font-medium">
          {tab.title}
        </div>
        <div className="text-xs text-white/50 truncate">
          {tab.hostname}
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {tab.pinned && <Pin className="w-3.5 h-3.5 text-white/40" />}
        {tab.audible && <Volume2 className="w-3.5 h-3.5 text-white/40" />}
        {!tab.isCurrentWindow && (
          <span title="Other window">
            <Globe className="w-3.5 h-3.5 text-blue-300/60" />
          </span>
        )}
      </div>

      {/* Close button */}
      <span
        onClick={handleClose}
        className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center
          rounded-full hover:bg-white/20 text-white/60 hover:text-white/90
          transition-all duration-150 text-sm flex-shrink-0"
      >
        ×
      </span>
    </button>
  );
}
