/**
 * Canopy — New Tab Page App
 */

import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useTabsStore, useSettingsStore, useUndoStore } from '@/store';
import { useSwBroadcast } from '@/shared/hooks';
import { Header, UndoToast, GradientBackground, ThemeProvider, type ViewMode } from '@/shared/ui';
import { I18nProvider, useT } from '@/shared/i18n';
import { DomainGroupView, TimelineView, CompactView, GridView, FrequencyView, DedupInfoBar } from '@/features/tabs';
import { SearchBox } from '@/features/search';
import { OnboardingCard, ArchivePanel } from '@/features/sessions';
import { SettingsPanel } from '@/features/settings';
import { hasCompletedOnboarding } from '@/repositories';
import { archiveAllTabs } from '@/services';

function AppContent() {
  const loadAllTabs = useTabsStore((s) => s.loadAllTabs);
  const loading = useTabsStore((s) => s.loading);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadUndoRecords = useUndoStore((s) => s.loadRecords);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checked, setChecked] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('domain');
  const { t } = useT();

  useSwBroadcast();

  useEffect(() => {
    const init = async () => {
      await loadSettings();
      const settings = useSettingsStore.getState().settings;
      setViewMode((settings.defaultView as ViewMode) || 'domain');
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

  const handleViewChange = useCallback((view: ViewMode) => {
    setViewMode(view);
    useSettingsStore.getState().updateSettings({ defaultView: view });
  }, []);

  const handleArchive = useCallback(async () => {
    try {
      await archiveAllTabs();
      await loadAllTabs();
    } catch (err) {
      console.warn('Archive failed:', err);
    }
  }, [loadAllTabs]);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-text-muted text-sm animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        onSearch={() => setShowSearch(true)}
        onArchive={handleArchive}
        onSettings={() => setShowSettings(true)}
        currentView={viewMode}
        onViewChange={handleViewChange}
      />

      <main className="flex-1 px-6 pb-8 max-w-4xl mx-auto w-full">
        {showOnboarding && (
          <OnboardingCard onDismiss={() => setShowOnboarding(false)} />
        )}

        <DedupInfoBar />

        {loading ? (
          <div className="text-text-muted text-sm animate-pulse text-center py-10">
            {t('tabs.loading')}
          </div>
        ) : (
          viewMode === 'domain' ? <DomainGroupView /> :
          viewMode === 'timeline' ? <TimelineView /> :
          viewMode === 'compact' ? <CompactView /> :
          viewMode === 'grid' ? <GridView /> :
          <FrequencyView />
        )}
      </main>

      <UndoToast />

      <AnimatePresence>
        {showSearch && (
          <motion.div
            key="search-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <SearchBox onClose={() => setShowSearch(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showArchive && (
          <motion.div
            key="archive-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <ArchivePanel onClose={() => setShowArchive(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && (
          <motion.div
            key="settings-overlay"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.2 }}
          >
            <SettingsPanel onClose={() => setShowSettings(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <GradientBackground>
          <AppContent />
        </GradientBackground>
      </I18nProvider>
    </ThemeProvider>
  );
}

export default App;
