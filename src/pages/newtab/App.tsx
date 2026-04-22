/**
 * Canopy — New Tab Page App
 */

import { useEffect, useState } from 'react';
import { useTabsStore, useSettingsStore, useUndoStore } from '@/store';
import { useSwBroadcast } from '@/shared/hooks';
import { Header, UndoToast } from '@/shared/ui';
import { DomainGroupView } from '@/features/tabs';
import { OnboardingCard } from '@/features/sessions';
import { hasCompletedOnboarding } from '@/repositories';

function App() {
  const loadAllTabs = useTabsStore((s) => s.loadAllTabs);
  const loading = useTabsStore((s) => s.loading);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadUndoRecords = useUndoStore((s) => s.loadRecords);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checked, setChecked] = useState(false);

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

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/50 text-sm animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

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
    </div>
  );
}

export default App;
