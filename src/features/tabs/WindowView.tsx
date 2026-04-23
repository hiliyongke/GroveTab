/**
 * WindowView — 多窗口管理视图
 *
 * 按窗口分组展示标签页，支持：
 *   - 查看每个窗口的标签数量和焦点状态
 *   - 将标签移动到其他窗口
 *   - 合并所有窗口到一个窗口
 *   - 关闭整个窗口
 *
 * 设计：
 *   - 使用 antd Card 展示每个窗口
 *   - 当前窗口高亮显示
 *   - 标签列表可展开/折叠
 */

import { useMemo, useCallback, useState } from 'react';
import { Tag, Button, Collapse, Empty, theme } from 'antd';
import {
  MergeCellsOutlined,
} from '@ant-design/icons';
import { useTabsStore } from '@/store';
import { TabItem } from './TabItem';
import { useT } from '@/shared/i18n';
import { feedback } from '@/shared/ui/feedback';
import { translate } from '@/shared/i18n/core';

/**
 * 多窗口管理视图
 */
export function WindowView() {
  const tabs = useTabsStore((s) => s.tabs);
  const windows = useTabsStore((s) => s.windows);
  const currentWindowId = useTabsStore((s) => s.currentWindowId);
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const closeSingleTab = useTabsStore((s) => s.closeSingleTab);
  const { t } = useT();
  const { token } = theme.useToken();
  const [busy, setBusy] = useState(false);

  /** 按窗口分组 */
  const windowGroups = useMemo(() => {
    const map = new Map<number, typeof tabs>();
    for (const tab of tabs) {
      const list = map.get(tab.windowId) || [];
      list.push(tab);
      map.set(tab.windowId, list);
    }
    return map;
  }, [tabs]);

  /** 所有窗口 ID，当前窗口排最前 */
  const sortedWindowIds = useMemo(() => {
    const ids = Array.from(windowGroups.keys());
    ids.sort((a, b) => {
      if (a === currentWindowId) return -1;
      if (b === currentWindowId) return 1;
      return b - a;
    });
    return ids;
  }, [windowGroups, currentWindowId]);

  /** 合并所有窗口到当前窗口 */
  const handleMergeAll = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const otherTabIds = tabs
        .filter((tab) => tab.windowId !== currentWindowId)
        .map((tab) => tab.id);
      if (otherTabIds.length === 0) {
        setBusy(false);
        return;
      }
      // 使用 chrome.tabs.move 批量移动
      const { moveTabs } = await import('@/chrome');
      // 逐批移动（避免一次性移动太多标签导致超时）
      const BATCH = 10;
      for (let i = 0; i < otherTabIds.length; i += BATCH) {
        const batch = otherTabIds.slice(i, i + BATCH);
        await moveTabs(batch, currentWindowId, -1);
      }
      feedback.success(translate('window.mergedAll', { count: otherTabIds.length }));
      // 刷新
      void useTabsStore.getState().loadAllTabs({ silent: true });
    } catch (err) {
      feedback.error(translate('window.mergeFailed'), err);
    } finally {
      setBusy(false);
    }
  }, [busy, tabs, currentWindowId]);

  /** 所有标签 ID 列表（用于多选） */
  const allTabIds = tabs.map((t) => t.id);

  if (tabs.length === 0) {
    return <Empty description={t('tabs.empty')} style={{ padding: '80px 0' }} />;
  }

  return (
    <div>
      {/* 多窗口操作栏 */}
      {sortedWindowIds.length > 1 && (
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            type="primary"
            icon={<MergeCellsOutlined />}
            loading={busy}
            onClick={handleMergeAll}
          >
            {t('window.mergeAll')}
          </Button>
        </div>
      )}

      <Collapse
        defaultActiveKey={sortedWindowIds.map(String)}
        ghost
        items={sortedWindowIds.map((windowId) => {
          const windowTabs = windowGroups.get(windowId) || [];
          const windowInfo = windows.get(windowId);
          const isCurrent = windowId === currentWindowId;
          const isFocused = windowInfo?.focused ?? false;

          return {
            key: String(windowId),
            label: (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: token.colorText }}>
                  {isCurrent ? t('window.current') : t('window.other')}
                </span>
                {isFocused && (
                  <Tag color="green" style={{ margin: 0, fontSize: 10 }}>
                    {t('window.focused')}
                  </Tag>
                )}
                <Tag style={{ margin: 0, fontSize: 11 }}>
                  {windowTabs.length}
                </Tag>
              </div>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {windowTabs.map((tab) => (
                  <TabItem
                    key={tab.id}
                    tab={tab}
                    onJump={jumpToTab}
                    onClose={closeSingleTab}
                    showHostname
                    selectable
                    visibleTabIds={allTabIds}
                  />
                ))}
              </div>
            ),
          };
        })}
      />
    </div>
  );
}
