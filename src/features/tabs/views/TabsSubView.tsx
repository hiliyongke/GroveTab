/**
 * UnifiedTabsView — TabsView 统一入口
 *
 * 将 TabGroupView / WindowView / TimelineView 合并到 TabsView 作为子维度切换。
 * "auto" 子视图带 TabsToolbar（搜索 + masonry/compact/grid 布局切换 + S/M/L 密度调节）。
 */

import { memo, useState } from 'react';
import { Segmented, Flex } from 'antd';
import { useSettingsStore } from '@/store';
import { usePanelStack } from '@/shared/panels';
import { useT } from '@/shared/i18n';
import { QuickStartLayer } from '@/features/quick-start/QuickStartLayer';
import { DomainGroupView } from './DomainGroupView';
import { CompactView } from './CompactView';
import { GridView } from './GridView';
import { TabGroupView } from './TabGroupView';
import { WindowView } from './WindowView';
import { TimelineView } from './TimelineView';
import { TabsToolbar } from '../toolbar/TabsToolbar';
import type { TabsSubView } from '@/shared/config/views';

export const UnifiedTabsView = memo(function UnifiedTabsView() {
  const { t } = useT();
  const tabsSubView = useSettingsStore((s) => s.settings.tabsSubView ?? 'auto');
  const tabsLayout = useSettingsStore((s) => s.settings.tabsLayout ?? 'masonry');
  const quickStartLayout = useSettingsStore((s) => s.settings.quickStartLayout ?? 'stacked');
  const panelStack = usePanelStack();
  const [filterQuery, setFilterQuery] = useState('');

  const renderAutoSubView = () => {
    return (
      <>
        <TabsToolbar filterQuery={filterQuery} onFilterChange={setFilterQuery} />
        {tabsLayout === 'masonry' && <DomainGroupView filterQuery={filterQuery} />}
        {tabsLayout === 'compact' && <CompactView filterQuery={filterQuery} />}
        {tabsLayout === 'grid' && <GridView filterQuery={filterQuery} />}
      </>
    );
  };

  return (
    <Flex vertical gap={8}>
      <Segmented
        options={[
          { label: t('全部'), value: 'auto' },
          { label: t('分组'), value: 'tabgroup' },
          { label: t('窗口'), value: 'window' },
          { label: t('时间线'), value: 'timeline' },
        ]}
        value={tabsSubView}
        onChange={(v) =>
          useSettingsStore.getState().updateSettings({ tabsSubView: v as TabsSubView })
        }
      />
      {quickStartLayout !== 'sidebar' && (
        <QuickStartLayer onOpenSettings={() => panelStack.openSettings()} />
      )}
      {tabsSubView === 'auto' && renderAutoSubView()}
      {tabsSubView === 'tabgroup' && <TabGroupView />}
      {tabsSubView === 'window' && <WindowView />}
      {tabsSubView === 'timeline' && <TimelineView />}
    </Flex>
  );
});
