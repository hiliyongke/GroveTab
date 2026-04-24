/**
 * FrequencyView — 按使用频率排序（F-11 升级版）
 *
 * 升级：优先使用 SW StatsCollector 写入的 canopy_stats 数据（近 7 天激活次数），
 * 数据缺失时回退到 lastAccessed 近似并显示"数据重建中"提示。
 */

import { useEffect, useMemo } from 'react';
import { useTabsStore, useStatsStore } from '@/store';
import { useT } from '@/shared/i18n';
import { findAmbiguousTitleIds } from '@/shared/utils/url-display';
import { TabItem } from './TabItem';
import { Flame } from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { theme, Tag } from 'antd';
import { CONFIG } from '@/shared/config';

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
  const { token } = theme.useToken();

  // 首次进入视图时加载统计数据
  useEffect(() => {
    if (!statsLoaded) {
      void loadStats();
    }
  }, [statsLoaded, loadStats]);

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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
          padding: '0 10px',
        }}
      >
        <Flame size={ICON_SIZE.MEDIUM} style={{ color: token.colorPrimary }} />
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: token.colorTextTertiary,
          }}
        >
          {t('view.frequencyDesc', { count: sortedTabs.length })}
        </span>
        {isFallback && (
          <Tag bordered={false} color="default" style={{ fontSize: 10.5, margin: 0 }}>
            {t('view.frequencyRebuilding')}
          </Tag>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {sortedTabs.map((entry, i) => (
          <TabItem
            key={entry.tab.id}
            tab={entry.tab}
            onJump={(id, wid) => { void jumpToTab(id, wid); }}
            onClose={(id) => { void closeSingleTab(id); }}
            showHostname
            showUrlHint={ambiguousIds.has(entry.tab.id)}
            leading={
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  fontSize: 10.5,
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                  background:
                    i < 3 ? token.colorPrimaryBg : token.colorFillSecondary,
                  color:
                    i < 3 ? token.colorPrimary : token.colorTextTertiary,
                }}
              >
                {i + 1}
              </span>
            }
          />
        ))}
      </div>
    </div>
  );
}
