/**
 * SearchBox — Global search with MiniSearch + keyboard shortcuts
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import MiniSearch from 'minisearch';
import { useTabsStore } from '@/store';
import { TabItem } from '@/features/tabs';
import type { LiveTab } from '@/shared/types';
import { useT } from '@/shared/i18n';

interface SearchBoxProps {
  onClose: () => void;
}

// Build a MiniSearch index from live tabs
function buildSearchIndex(tabs: LiveTab[]): MiniSearch<LiveTab> {
  const ms = new MiniSearch<LiveTab>({
    fields: ['title', 'hostname', 'url'],
    storeFields: ['id', 'title', 'url', 'hostname', 'favIconUrl', 'windowId', 'pinned', 'audible', 'incognito', 'isCurrentWindow', 'lastAccessed', 'groupId'],
    searchOptions: {
      boost: { title: 3, hostname: 2 },
      fuzzy: 0.2,
      prefix: true,
    },
  });
  if (tabs.length > 0) {
    ms.addAll(tabs);
  }
  return ms;
}

export function SearchBox({ onClose }: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const tabs = useTabsStore((s) => s.tabs);
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const closeSingleTab = useTabsStore((s) => s.closeSingleTab);
  const { t } = useT();

  const searchIndex = useMemo(() => buildSearchIndex(tabs), [tabs]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    try {
      return searchIndex.search(query) as unknown as LiveTab[];
    } catch {
      return [];
    }
  }, [query, searchIndex]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keyboard handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (query) {
        setQuery('');
      } else {
        onClose();
      }
    }
  }, [query, onClose]);

  return (
    <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm flex items-start justify-center pt-[15vh]">
      <div
        className="w-full max-w-2xl rounded-[var(--radius-lg)]
          bg-surface backdrop-blur-xl border border-border
          shadow-2xl overflow-hidden"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <Search className="w-5 h-5 text-text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('search.placeholder')}
            className="flex-1 bg-transparent text-text text-base placeholder:text-text-muted
              outline-none border-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="w-6 h-6 flex items-center justify-center rounded-full
                hover:bg-surface-hover text-text-muted hover:text-text
                transition-colors duration-150 cursor-pointer"
              aria-label={t('search.clear')}
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 rounded
            bg-badge text-text-muted text-xs font-mono">
            Esc
          </kbd>
        </div>

        {/* Results */}
        {query.trim() && (
          <div className="max-h-[50vh] overflow-y-auto p-3">
            {results.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <div className="text-xs text-text-muted px-2 mb-1">
                  {t('search.results', { count: results.length })}
                </div>
                {results.map((tab) => (
                  <TabItem
                    key={tab.id}
                    tab={tab}
                    onJump={(id, winId) => {
                      jumpToTab(id, winId);
                      onClose();
                    }}
                    onClose={closeSingleTab}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-text-muted">
                <p className="text-sm">{t('search.noResults')}</p>
                <p className="text-xs mt-1">{t('search.tryOther')}</p>
              </div>
            )}
          </div>
        )}

        {/* Hint when empty */}
        {!query.trim() && (
          <div className="px-5 py-6 text-center text-text-muted text-sm">
            {t('search.hint')}
          </div>
        )}
      </div>
    </div>
  );
}
