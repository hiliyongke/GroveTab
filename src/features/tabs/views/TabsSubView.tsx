/**
 * UnifiedTabsView — TabsView 统一入口
 *
 * 将 TabGroupView / WindowView / TimelineView 合并到 TabsView 作为子维度切换，
 * 不再独立注册为顶层视图。FeatureFlag `unified_tabs_view` 控制是否启用。
 */

import { Segmented } from 'antd';
import { useSettingsStore, useFeatureFlagStore } from '@/store';
import { usePanelStack } from '@/shared/panels';
import { useT } from '@/shared/i18n';
import { QuickStartLayer } from '@/features/quick-start/QuickStartLayer';
import { TabsView as OldTabsView } from './TabsView.old';
import { TabGroupView } from './TabGroupView';
import { WindowView } from './WindowView';
import { TimelineView } from './TimelineView';

export function UnifiedTabsView() {
  const { t } = useT();
  const tabsSubView = useSettingsStore((s) => s.settings.tabsSubView ?? 'auto');
  const quickStartLayout = useSettingsStore((s) => s.settings.quickStartLayout ?? 'stacked');
  const flag = useFeatureFlagStore((s) => s.flags.unified_tabs_view);
  const panelStack = usePanelStack();

  if (!flag) return <OldTabsView />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 8 }}>
        <Segmented
          options={[
            { label: t('全部'), value: 'auto' },
            { label: t('分组'), value: 'tabgroup' },
            { label: t('窗口'), value: 'window' },
            { label: t('时间线'), value: 'timeline' },
          ]}
          value={tabsSubView}
          onChange={(v) =>
            useSettingsStore.getState().updateSettings({ tabsSubView: v as any })
          }
        />
      </div>
      {/* 快捷站点：位于子标签下方、正文上方 */}
      {quickStartLayout !== 'sidebar' && (
        <QuickStartLayer onOpenSettings={() => panelStack.openSettings()} />
      )}
      {tabsSubView === 'auto' && <OldTabsView />}
      {tabsSubView === 'tabgroup' && <TabGroupView />}
      {tabsSubView === 'window' && <WindowView />}
      {tabsSubView === 'timeline' && <TimelineView />}
    </div>
  );
}
