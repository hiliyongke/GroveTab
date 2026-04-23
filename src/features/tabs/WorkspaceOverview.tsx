/**
 * WorkspaceOverview —— 首页摘要与高频操作区。
 *
 * 排版策略（v3 轻量条）：
 *   - 整体做成轻量状态条而非独立大卡片，与搜索区视觉连贯
 *   - 统计区：横排紧凑色块 + 竖线分隔，视觉更轻量不占纵向空间
 *   - 操作区：仅保留 primary 搜索按钮，其余降级为 text，减少视觉噪音
 *   - 整体高度压缩，留更多空间给标签列表主体内容
 */

import { useMemo } from 'react';
import { Button, Card, Space, Tag, theme } from 'antd';
import {
  Search,
  Save,
  Zap,
  Network,
  History,
  LayoutGrid,
} from 'lucide-react';
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
 * 单个统计色块：图标 + 数字，紧凑排列
 */
function StatChip({
  icon,
  value,
  colorRole,
  token,
}: {
  icon: React.ReactNode;
  value: number;
  colorRole: IconRole;
  token: ReturnType<typeof theme.useToken>['token'];
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 0',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: 8,
          background: iconColorAlpha(colorRole, token),
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: token.colorText,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * 竖线分隔符
 */
function DividerVertical({ token }: { token: ReturnType<typeof theme.useToken>['token'] }) {
  return (
    <div
      aria-hidden
      style={{
        width: 1,
        height: 28,
        background: token.colorBorderSecondary,
        margin: '0 4px',
        flexShrink: 0,
      }}
    />
  );
}

/**
 * 首页摘要卡
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

  /** 统计色块数据，按重要性排序 */
  const stats = [
    { key: 'tabs', icon: <LayoutGrid size={13} style={{ color: iconColor('tabs', token) }} />, value: tabs.length, colorRole: 'tabs' as IconRole },
    { key: 'domains', icon: <Network size={13} style={{ color: iconColor('domains', token) }} />, value: domainCount, colorRole: 'domains' as IconRole },
    { key: 'windows', icon: <Network size={13} style={{ color: iconColor('windows', token) }} />, value: windowCount, colorRole: 'windows' as IconRole },
    { key: 'duplicates', icon: <Zap size={13} style={{ color: iconColor('duplicates', token) }} />, value: duplicateTabsCount, colorRole: 'duplicates' as IconRole },
    { key: 'idle', icon: <History size={13} style={{ color: iconColor('idle', token) }} />, value: idleTabs.length, colorRole: 'idle' as IconRole },
    { key: 'archives', icon: <Save size={13} style={{ color: iconColor('sessions', token) }} />, value: archivedSessionCount, colorRole: 'sessions' as IconRole },
  ];

  return (
    <div
      style={{
        marginBottom: 12,
        padding: '10px 18px',
        borderRadius: 12,
        background: token.colorFillQuaternary,
        border: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        {/* 左侧：标签 + 统计横排色块 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {hasTidySuggestions ? (
            <Tag color="gold" style={{ margin: 0, borderRadius: 6, fontWeight: 500, fontSize: 11 }}>
              {t('dashboard.tidyReady')}
            </Tag>
          ) : (
            <Tag color="green" style={{ margin: 0, borderRadius: 6, fontWeight: 500, fontSize: 11 }}>
              {t('dashboard.allClear')}
            </Tag>
          )}
          <DividerVertical token={token} />
          {stats.map((item) => (
            <StatChip
              key={item.key}
              icon={item.icon}
              value={item.value}
              colorRole={item.colorRole}
              token={token}
            />
          ))}
        </div>

        {/* 右侧：操作按钮组 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Button
            type="primary"
            icon={<Search size={14} />}
            onClick={onOpenSearch}
            style={{ borderRadius: 9, fontWeight: 500 }}
          >
            {t('dashboard.searchAction')}
          </Button>
          {hasTidySuggestions && (
            <Button
              type="text"
              size="small"
              icon={<Zap size={14} style={{ color: iconColor('tidy', token) }} />}
              onClick={onFocusTidy}
            >
              {t('dashboard.tidyAction')}
            </Button>
          )}
          <Button
            type="text"
            size="small"
            icon={<Save size={14} style={{ color: iconColor('archive', token) }} />}
            loading={archiving}
            disabled={tabs.length === 0}
            onClick={onArchiveCurrent}
          >
            {t('dashboard.archiveAction')}
          </Button>
          <Button
            type="text"
            size="small"
            icon={<Save size={14} />}
            onClick={onOpenArchive}
          >
            {t('dashboard.openArchives')}
          </Button>
        </div>
      </div>

      {/* 归档提示行——仅在最近有归档记录时显示 */}
      {latestArchiveLabel !== null && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: `1px solid ${token.colorBorderSecondary}`,
            fontSize: 12,
            color: token.colorTextTertiary,
          }}
        >
          {t('dashboard.latestArchive', { name: latestArchiveLabel })}
        </div>
      )}
    </div>
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
