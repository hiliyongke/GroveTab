/**
 * ViewSwitcher — Icon group to switch between view modes
 */

import { LayoutGrid, List, Clock, Grid3X3, TrendingUp } from 'lucide-react';
import { useT } from '@/shared/i18n';

export type ViewMode = 'domain' | 'timeline' | 'compact' | 'grid' | 'frequency';

interface ViewSwitcherProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

const VIEW_CONFIG: { mode: ViewMode; icon: React.ReactNode; labelKey: string }[] = [
  { mode: 'domain', icon: <LayoutGrid className="w-4 h-4" />, labelKey: 'view.domain' },
  { mode: 'timeline', icon: <Clock className="w-4 h-4" />, labelKey: 'view.timeline' },
  { mode: 'compact', icon: <List className="w-4 h-4" />, labelKey: 'view.compact' },
  { mode: 'grid', icon: <Grid3X3 className="w-4 h-4" />, labelKey: 'view.grid' },
  { mode: 'frequency', icon: <TrendingUp className="w-4 h-4" />, labelKey: 'view.frequency' },
];

export function ViewSwitcher({ currentView, onViewChange }: ViewSwitcherProps) {
  const { t } = useT();

  return (
    <div className="flex items-center gap-0.5 bg-surface/50 rounded-[var(--radius-md)] border border-border p-0.5">
      {VIEW_CONFIG.map(({ mode, icon, labelKey }) => (
        <button
          key={mode}
          onClick={() => onViewChange(mode)}
          className={`w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)]
            transition-colors duration-150 cursor-pointer
            ${currentView === mode
              ? 'bg-badge text-text shadow-sm'
              : 'text-text-muted hover:text-text hover:bg-surface-hover'
            }`}
          aria-label={t(labelKey)}
          title={t(labelKey)}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
