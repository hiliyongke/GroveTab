/**
 * Canopy — New Tab Page App
 */

import { useEffect, useState, useCallback } from 'react';
import { useTabsStore, useSettingsStore, useUndoStore } from '@/store';
import { useSwBroadcast } from '@/shared/hooks';
import { Header, UndoToast } from '@/shared/ui';
import { DomainGroupView } from '@/features/tabs';
import { SearchBox } from '@/features/search';
import { OnboardingCard, ArchivePanel } from '@/features/sessions';
import { hasCompletedOnboarding } from '@/repositories';
import { archiveAllTabs } from '@/services';

function App() {
  const loadAllTabs = useTabsStore((s) => s.loadAllTabs);
  const loading = useTabsStore((s) => s.loading);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadUndoRecords = useUndoStore((s) => s.loadRecords);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checked, setChecked] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showArchive, setShowArchive] = useState(false);

  useSwBroadcast();

  useEffect(() => {
    const init = async () => {
      await loadSettings();
      await loadAllTabs();
      await loadUndoRecords();
      const done = await hasCompletedOnboarding();
      setShowOnboarding(!done);
      setChecked(true);
    };
    init();
  }, [loadAllTabs, loadSettings, loadUndoRecords]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
        setShowArchive(false);
      }
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setShowSearch(true);
          setShowArchive(false);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleArchive = useCallback(async () => {
    try {
      await archiveAllTabs();
      // Reload tabs after archiving
      await loadAllTabs();
    } catch (err) {
      // No tabs to archive, or error
      console.warn('Archive failed:', err);
    }
  }, [loadAllTabs]);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/50 text-sm animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header onSearch={() => setShowSearch(true)} onArchive={handleArchive} />

      <main className="flex-1 px-6 pb-8 max-w-4xl mx-auto w-full">
        {showOnboarding && (
          <OnboardingCard onDismiss={() => setShowOnboarding(false)} />
        )}

        {loading ? (
          <div className="text-white/50 text-sm animate-pulse text-center py-10">
            加载标签页中...
          </div>
        ) : (
          <DomainGroupView />
        )}
      </main>

      <UndoToast />

      {showSearch && <SearchBox onClose={() => setShowSearch(false)} />}
      {showArchive && <ArchivePanel onClose={() => setShowArchive(false)} />}
    </div>
  );
}

export default App;
