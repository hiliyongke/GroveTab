/**
 * WorkspaceOverview —— 首页摘要与高频操作区。
 *
 * 目标：
 * 1. 将“搜索 / 整理 / 归档”三条主路径前置，降低首次使用的认知成本。
 * 2. 用摘要指标快速说明当前工作区状态，帮助用户判断下一步最合适的动作。
 * 3. 在不打断免费版主流程的前提下，为未来会员版的高级能力预留清晰位置。
 */

import { useMemo } from 'react';
import { Button, Card, Space, Tag, theme } from 'antd';
import {
  AppstoreOutlined,
  SearchOutlined,
  SaveOutlined,
  ThunderboltOutlined,
  ApartmentOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import type { LiveTab } from '@/shared/types';
import { findDuplicates } from '@/shared/utils/dedupe';
import { detectIdleTabs } from '@/shared/utils/idle-detect';
import { useT } from '@/shared/i18n';
import { iconColor, iconColorAlpha, type IconRole } from '@/shared/utils/icon-colors';

interface WorkspaceOverviewProps {
  tabs: LiveTab[];
  archivedSessionCount: number;
  latestArchiveLabel: string | null;
  archiving: boolean;
  onOpenSearch: () => void;
  onFocusTidy: () => void;
  onArchiveCurrent: () => void;
  onOpenArchive: () => void;
}

interface SelectionModeNoticeProps {
  selectedTabs: LiveTab[];
  onSelectAll: () => void;
  onClearSelection: () => void;
  onExitSelectionMode: () => void;
}

/**
 * 首页摘要卡。
 */
export function WorkspaceOverview({
  tabs,
  archivedSessionCount,
  latestArchiveLabel,
  archiving,
  onOpenSearch,
  onFocusTidy,
  onArchiveCurrent,
  onOpenArchive,
}: WorkspaceOverviewProps) {
  const { t } = useT();
  const { token } = theme.useToken();

  const dupGroups = useMemo(() => findDuplicates(tabs), [tabs]);
  const idleTabs = useMemo(() => detectIdleTabs(tabs), [tabs]);

  const duplicateTabsCount = dupGroups.reduce((sum, group) => sum + group.tabs.length - 1, 0);
  const windowCount = new Set(tabs.map((tab) => tab.windowId)).size;
  const domainCount = new Set(tabs.map((tab) => tab.hostname)).size;
  const hasTidySuggestions = duplicateTabsCount > 0 || idleTabs.length > 0;

  const statItems = [
    { key: 'tabs', icon: <AppstoreOutlined style={{ color: iconColor('tabs', token) }} />, label: t('dashboard.tabsStat'), value: tabs.length, colorRole: 'tabs' as IconRole },
    { key: 'domains', icon: <ApartmentOutlined style={{ color: iconColor('domains', token) }} />, label: t('dashboard.domainsStat'), value: domainCount, colorRole: 'domains' as IconRole },
    { key: 'windows', icon: <ApartmentOutlined style={{ color: iconColor('windows', token) }} />, label: t('dashboard.windowsStat'), value: windowCount, colorRole: 'windows' as IconRole },
    { key: 'duplicates', icon: <ThunderboltOutlined style={{ color: iconColor('duplicates', token) }} />, label: t('dashboard.duplicatesStat'), value: duplicateTabsCount, colorRole: 'duplicates' as IconRole },
    { key: 'idle', icon: <HistoryOutlined style={{ color: iconColor('idle', token) }} />, label: t('dashboard.idleStat'), value: idleTabs.length, colorRole: 'idle' as IconRole },
    { key: 'archives', icon: <SaveOutlined style={{ color: iconColor('sessions', token) }} />, label: t('dashboard.sessionsStat'), value: archivedSessionCount, colorRole: 'sessions' as IconRole },
  ];

  return (
    <Card
      style={{
        marginBottom: 16,
        borderRadius: token.borderRadiusLG * 1.5,
        boxShadow: token.boxShadowTertiary,
        overflow: 'hidden',
      }}
      styles={{ body: { padding: 20 } }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tag color="processing" style={{ margin: 0 }}>
                {t('dashboard.title')}
              </Tag>
              {hasTidySuggestions ? (
                <Tag color="gold" style={{ margin: 0 }}>
                  {t('dashboard.tidyReady')}
                </Tag>
              ) : (
                <Tag color="green" style={{ margin: 0 }}>
                  {t('dashboard.allClear')}
                </Tag>
              )}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: token.colorText }}>
              {t('dashboard.subtitle')}
            </div>
            <div style={{ fontSize: 12.5, color: token.colorTextSecondary, lineHeight: 1.6, maxWidth: 620 }}>
              {t('dashboard.description')}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <Button type="link" size="small" icon={<SaveOutlined />} onClick={onOpenArchive} style={{ paddingInline: 0 }}>
              {t('dashboard.openArchives')}
            </Button>
            <span style={{ fontSize: 12, color: token.colorTextTertiary }}>
              {latestArchiveLabel !== null
                ? t('dashboard.latestArchive', { name: latestArchiveLabel })
                : t('dashboard.noArchiveYet')}
            </span>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: 12,
          }}
        >
          {statItems.map((item) => (
            <div
              key={item.key}
              style={{
                padding: '14px 16px',
                borderRadius: token.borderRadiusLG,
                background: token.colorFillQuaternary,
                border: `1px solid ${token.colorBorderSecondary}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24, height: 24,
                  borderRadius: 6,
                  background: iconColorAlpha(item.colorRole ?? ('tabs' as IconRole), token),
                }}>
                  {item.icon}
                </span>
                <span style={{ color: token.colorTextSecondary }}>{item.label}</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: token.colorText }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <Space size={8} wrap>
          <Button type="primary" icon={<SearchOutlined />} onClick={onOpenSearch}>
            {t('dashboard.searchAction')}
          </Button>
          <Button icon={<ThunderboltOutlined style={{ color: iconColor('tidy', token) }} />} onClick={onFocusTidy}>
            {t('dashboard.tidyAction')}
          </Button>
          <Button icon={<SaveOutlined style={{ color: iconColor('archive', token) }} />} loading={archiving} disabled={tabs.length === 0} onClick={onArchiveCurrent}>
            {t('dashboard.archiveAction')}
          </Button>
        </Space>
      </div>
    </Card>
  );
}

/**
 * 多选模式提示条。
 */
export function SelectionModeNotice({
  selectedTabs,
  onSelectAll,
  onClearSelection,
  onExitSelectionMode,
}: SelectionModeNoticeProps) {
  const { t } = useT();
  const { token } = theme.useToken();

  const selectedCount = selectedTabs.length;
  const selectedDomainCount = new Set(selectedTabs.map((tab) => tab.hostname)).size;
  const selectedWindowCount = new Set(selectedTabs.map((tab) => tab.windowId)).size;

  return (
    <Card
      size="small"
      style={{
        marginBottom: 16,
        borderRadius: token.borderRadiusLG,
        borderColor: token.colorPrimaryBorder,
        background: token.colorPrimaryBg,
      }}
      styles={{ body: { padding: '12px 14px' } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: token.colorText }}>
            {t('selection.title')}
          </div>
          <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
            {selectedCount > 0
              ? t('selection.summary', {
                  count: selectedCount,
                  domains: selectedDomainCount,
                  windows: selectedWindowCount,
                })
              : t('selection.empty')}
          </div>
          <div style={{ fontSize: 11.5, color: token.colorTextTertiary }}>
            {t('selection.hint')}
          </div>
        </div>

        <Space size={6} wrap>
          <Button size="small" onClick={onSelectAll}>
            {t('selection.selectAll')}
          </Button>
          <Button size="small" onClick={onClearSelection} disabled={selectedCount === 0}>
            {t('selection.clear')}
          </Button>
          <Button size="small" type="text" onClick={onExitSelectionMode}>
            {t('selection.exit')}
          </Button>
        </Space>
      </div>
    </Card>
  );
}
