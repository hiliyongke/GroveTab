/**
 * FrequencyView — 按使用频率（近期活跃度）排序（antd 版）
 *
 * 设计：
 *   - 顶部标题：火焰图标 + 描述（tracking-wider 小字）
 *   - 序号作为 TabItem 的 leading slot，与行整体共享 hover 高亮
 *   - 前 3 名序号使用品牌色徽章
 *   - 跨域名列表，展示 hostname 辅助识别
 */

import { useMemo } from 'react';
import { useTabsStore } from '@/store';
import { useT } from '@/shared/i18n';
import { findAmbiguousTitleIds } from '@/shared/utils/url-display';
import { TabItem } from './TabItem';
import { FireOutlined } from '@ant-design/icons';
import { theme } from 'antd';

const MAX_DISPLAY = 30;

/**
 * 频率视图
 */
export function FrequencyView() {
  const tabs = useTabsStore((s) => s.tabs);
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const closeSingleTab = useTabsStore((s) => s.closeSingleTab);
  const { t } = useT();
  const { token } = theme.useToken();

  /** 暂用 lastAccessed 近似频率；后续 SW StatsCollector 补全真实数据 */
  const sortedTabs = useMemo(() => {
    return [...tabs].sort((a, b) => b.lastAccessed - a.lastAccessed).slice(0, MAX_DISPLAY);
  }, [tabs]);

  /** 榜单内同名 tab id 集合 */
  const ambiguousIds = useMemo(() => findAmbiguousTitleIds(sortedTabs), [sortedTabs]);

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
        <FireOutlined style={{ fontSize: 14, color: token.colorPrimary }} />
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
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {sortedTabs.map((tab, i) => (
          <TabItem
            key={tab.id}
            tab={tab}
            onJump={(id, wid) => { void jumpToTab(id, wid); }}
            onClose={(id) => { void closeSingleTab(id); }}
            showHostname
            showUrlHint={ambiguousIds.has(tab.id)}
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
