/**
 * Header — Top bar with branding and stats
 */

import { TreePine } from 'lucide-react';
import { useTabsStore } from '@/store';

export function Header() {
  const tabCount = useTabsStore((s) => s.tabs.length);

  return (
    <header className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-3">
        <TreePine className="w-7 h-7 text-white/80" />
        <h1 className="text-xl font-bold text-white/90 tracking-tight">Canopy</h1>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-white/50">
          {tabCount} 个标签页
        </span>
      </div>
    </header>
  );
}
