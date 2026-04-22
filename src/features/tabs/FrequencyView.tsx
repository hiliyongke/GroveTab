/**
 * FrequencyView — Tabs sorted by activation frequency (7-day)
 */

import { useMemo } from 'react';
import { useTabsStore } from '@/store';
import { useT } from '@/shared/i18n';
import { TabItem } from './TabItem';
import { Flame } from 'lucide-react';

const MAX_DISPLAY = 30;

export function FrequencyView() {
  const tabs = useTabsStore((s) => s.tabs);
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const closeSingleTab = useTabsStore((s) => s.closeSingleTab);
  const { t } = useT();

  // For now, use lastAccessed as a proxy for frequency
  // SW StatsCollector will provide real data later
  const sortedTabs = useMemo(() => {
    return [...tabs]
      .sort((a, b) => b.lastAccessed - a.lastAccessed)
      .slice(0, MAX_DISPLAY);
  }, [tabs]);

  if (tabs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-muted">
        <p className="text-lg">{t('tabs.empty')}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-text-secondary mb-3 px-1">
        <Flame className="w-4 h-4" />
        {t('view.frequencyDesc', { count: sortedTabs.length })}
      </div>
      <div className="flex flex-col gap-1.5">
        {sortedTabs.map((tab, i) => (
          <div key={tab.id} className="flex items-center gap-2">
            <span className="w-6 text-xs text-text-muted text-right font-mono">{i + 1}</span>
            <div className="flex-1">
              <TabItem tab={tab} onJump={jumpToTab} onClose={closeSingleTab} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
