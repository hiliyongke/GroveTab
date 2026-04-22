/**
 * TimelineView — Tabs grouped by time segments
 */

import { useMemo } from 'react';
import { useTabsStore } from '@/store';
import { useT } from '@/shared/i18n';
import { TabItem } from './TabItem';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface TimeSegment {
  key: string;
  label: string;
  tabs: import('@/shared/types').LiveTab[];
}

function getTimeSegments(tabs: import('@/shared/types').LiveTab[], t: (key: string) => string): TimeSegment[] {
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const yesterdayStart = todayStart - 86400000;
  const weekStart = todayStart - 6 * 86400000;

  const segments: TimeSegment[] = [
    { key: 'today', label: t('timeline.today'), tabs: [] },
    { key: 'yesterday', label: t('timeline.yesterday'), tabs: [] },
    { key: 'week', label: t('timeline.thisWeek'), tabs: [] },
    { key: 'older', label: t('timeline.older'), tabs: [] },
  ];

  for (const tab of tabs) {
    const accessed = tab.lastAccessed || 0;
    if (accessed >= todayStart) {
      segments[0].tabs.push(tab);
    } else if (accessed >= yesterdayStart) {
      segments[1].tabs.push(tab);
    } else if (accessed >= weekStart) {
      segments[2].tabs.push(tab);
    } else {
      segments[3].tabs.push(tab);
    }
  }

  return segments.filter((s) => s.tabs.length > 0);
}

function SegmentSection({ segment }: { segment: TimeSegment }) {
  const [collapsed, setCollapsed] = useState(false);
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const closeSingleTab = useTabsStore((s) => s.closeSingleTab);

  return (
    <div className="mb-4">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-2 cursor-pointer"
      >
        <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${collapsed ? '-rotate-90' : ''}`} />
        {segment.label}
        <span className="text-xs text-text-muted">({segment.tabs.length})</span>
      </button>
      {!collapsed && (
        <div className="flex flex-col gap-1.5 ml-2">
          {segment.tabs.map((tab) => (
            <TabItem
              key={tab.id}
              tab={tab}
              onJump={jumpToTab}
              onClose={closeSingleTab}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TimelineView() {
  const tabs = useTabsStore((s) => s.tabs);
  const { t } = useT();

  const segments = useMemo(() => getTimeSegments(tabs, t), [tabs, t]);

  if (tabs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-muted">
        <p className="text-lg">{t('tabs.empty')}</p>
      </div>
    );
  }

  return (
    <div>
      {segments.map((segment) => (
        <SegmentSection key={segment.key} segment={segment} />
      ))}
    </div>
  );
}
