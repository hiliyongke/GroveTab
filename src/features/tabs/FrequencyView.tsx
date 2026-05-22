/**
 * FrequencyView — 按使用频率排序（F-11 升级版）
 *
 * 升级：优先使用 SW StatsCollector 写入的统计数据（近 7 天激活次数），
 * 数据缺失时回退到 lastAccessed 近似并显示"数据重建中"提示。
 */

import { useEffect, useMemo } from 'react';
import { useTabsStore, useStatsStore } from '@/store';
import { useT } from '@/shared/i18n';
import { findAmbiguousTitleIds } from '@/shared/utils/url-display';
import { TabItem } from './TabItem';
import { Flame } from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { Tag } from 'antd';
import { CONFIG } from '@/shared/config';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';
import styles from './styles/views.module.less';

const MAX_DISPLAY = CONFIG.ui.maxDisplay;

export function FrequencyView() {
  const tabs = useTabsStore((s) => s.tabs);
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const closeSingleTab = useTabsStore((s) => s.closeSingleTab);
  const loadStats = useStatsStore((s) => s.loadStats);
  const isFallback = useStatsStore((s) => s.isFallback);
  const getCountRecent = useStatsStore((s) => s.getCountRecent);
  const statsLoaded = useStatsStore((s) => s.loaded);
  const { t } = useT();

  // 首次进入视图时加载统计数据
  useEffect(() => {
    if (!statsLoaded) {
      void loadStats();
    }
  }, [statsLoaded, loadStats]);

  useEffect(() => {
    if (typeof chrome === 'undefined' || chrome.storage?.onChanged === undefined) return;
    const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName === 'local' && changes[STORAGE_KEYS.stats] !== undefined) {
        void loadStats();
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [loadStats]);

  const sortedTabs = useMemo(() => {
    const withScore = tabs.map((tab) => {
      const preciseCount = getCountRecent(tab.url, 7);
      // 精确为 0 时回落 lastAccessed，保证 UI 仍然按"最近活跃"排序
      const score = preciseCount > 0 ? preciseCount * 1_000_000_000 + tab.lastAccessed : tab.lastAccessed;
      return { tab, score, count: preciseCount };
    });
    return withScore
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_DISPLAY);
  }, [tabs, getCountRecent]);

  const ambiguousIds = useMemo(() => findAmbiguousTitleIds(sortedTabs.map((x) => x.tab)), [sortedTabs]);

  if (tabs.length === 0) return null;

  return (
    <div>
      <div className={styles['app-frequency-header']}>
        <Flame size={ICON_SIZE.MEDIUM} className={styles['app-frequency-header-icon']} />
        <span className={styles['app-frequency-header-copy']}>
          {t('view.frequencyDesc', { count: sortedTabs.length })}
        </span>
        {isFallback && (
          <Tag bordered={false} color="default" className={styles['app-frequency-rebuild-tag']}>
            {t('view.frequencyRebuilding')}
          </Tag>
        )}
      </div>

      <div className={styles['app-frequency-list']}>
        {sortedTabs.map((entry, i) => (
          <TabItem
            key={entry.tab.id}
            tab={entry.tab}
            onJump={(id, wid) => { void jumpToTab(id, wid); }}
            onClose={(id) => { void closeSingleTab(id); }}
            showHostname
            showUrlHint={ambiguousIds.has(entry.tab.id)}
            leading={
              <span className={`${styles['app-frequency-rank']}${i < 3 ? ' is-top-rank' : ''}`}>
                {i + 1}
              </span>
            }
          />
        ))}
      </div>
    </div>
  );
}
