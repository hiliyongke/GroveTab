/**
 * Header — Top bar with branding, search, and archive actions
 */

import { TreePine, Search, Archive } from 'lucide-react';
import { useTabsStore } from '@/store';

interface HeaderProps {
  onSearch: () => void;
  onArchive: () => void;
}

export function Header({ onSearch, onArchive }: HeaderProps) {
  const tabCount = useTabsStore((s) => s.tabs.length);

  return (
    <header className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-3">
        <TreePine className="w-7 h-7 text-white/80" />
        <h1 className="text-xl font-bold text-white/90 tracking-tight">Canopy</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Search button */}
        <button
          onClick={onSearch}
          className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)]
            bg-white/10 hover:bg-white/20 border border-white/10
            text-white/50 hover:text-white/80 text-sm
            transition-all duration-150 cursor-pointer"
        >
          <Search className="w-4 h-4" />
          <span className="hidden sm:inline">搜索</span>
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded
            bg-white/10 text-white/30 text-xs font-mono">
            ⌘K
          </kbd>
        </button>

        {/* Archive button */}
        <button
          onClick={onArchive}
          className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)]
            bg-white/10 hover:bg-white/20 border border-white/10
            text-white/50 hover:text-white/80 text-sm
            transition-all duration-150 cursor-pointer"
        >
          <Archive className="w-4 h-4" />
          <span className="hidden sm:inline">归档</span>
        </button>

        <span className="text-sm text-white/40 ml-2">
          {tabCount} 个标签页
        </span>
      </div>
    </header>
  );
}
