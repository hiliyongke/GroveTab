/**
 * Header — Top bar with branding, search, theme toggle, and archive actions
 */

import { TreePine, Search, Archive } from 'lucide-react';
import { useTabsStore } from '@/store';
import { ThemeToggle } from './ThemeToggle';
import { ViewSwitcher, type ViewMode } from './ViewSwitcher';
import { useT } from '@/shared/i18n';

interface HeaderProps {
  onSearch: () => void;
  onArchive: () => void;
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export function Header({ onSearch, onArchive, currentView, onViewChange }: HeaderProps) {
  const tabCount = useTabsStore((s) => s.tabs.length);
  const { t } = useT();

  return (
    <header className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-3">
        <TreePine className="w-7 h-7 text-text" />
        <h1 className="text-xl font-bold text-text tracking-tight">Canopy</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* View switcher */}
        <ViewSwitcher currentView={currentView} onViewChange={onViewChange} />

        {/* Search button */}
        <button
          onClick={onSearch}
          className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)]
            bg-surface hover:bg-surface-hover border border-border
            text-text-secondary hover:text-text text-sm
            transition-colors duration-150 cursor-pointer"
          aria-label={t('header.search')}
        >
          <Search className="w-4 h-4" />
          <span className="hidden sm:inline">{t('header.search')}</span>
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded
            bg-badge text-text-muted text-xs font-mono">
            {t('search.shortcut')}
          </kbd>
        </button>

        {/* Archive button */}
        <button
          onClick={onArchive}
          className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)]
            bg-surface hover:bg-surface-hover border border-border
            text-text-secondary hover:text-text text-sm
            transition-colors duration-150 cursor-pointer"
          aria-label={t('header.archive')}
        >
          <Archive className="w-4 h-4" />
          <span className="hidden sm:inline">{t('header.archive')}</span>
        </button>

        {/* Theme toggle */}
        <ThemeToggle />

        <span className="text-sm text-text-muted ml-2">
          {t('header.tabCount', { count: tabCount })}
        </span>
      </div>
    </header>
  );
}
