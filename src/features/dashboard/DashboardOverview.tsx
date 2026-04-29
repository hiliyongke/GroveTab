/**
 * DashboardOverview —— 首页工作区概览卡片（F-34）
 *
 * 位置：HeroBar 下方、ActivityStrip 之后、TidySuggestionBar 之前。
 *
 * 设计目标：
 *   · 保留概览与快捷动作，但弱化“第二层重型面板”感
 *   · 统计区改为更轻量的摘要 tile，降低高度与视觉噪音
 *   · 业务样式仅消费主题变量，不做深层 antd 覆盖
 */

import { memo, useMemo } from 'react';
import { Button, Space, Typography } from 'antd';
import { Search, Zap, Save, ChevronRight, BarChart3 } from 'lucide-react';
import type { LiveTab, ArchivedSession } from '@/shared/types';
import { useT } from '@/shared/i18n';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import './styles/overview.css';

const { Text } = Typography;

export type DashboardJumpTarget =
  | 'mainView'
  | 'domainView'
  | 'windowView'
  | 'tidyDup'
  | 'tidyIdle'
  | 'archive';

export interface DashboardOverviewProps {
  tabs: readonly LiveTab[];
  duplicateCount: number;
  idleCount: number;
  latestArchive: ArchivedSession | null;
  onJump: (target: DashboardJumpTarget) => void;
  onSearch: () => void;
  onTidy: () => void;
  onArchive: () => void;
  onInsights: () => void;
}

interface StatTileProps {
  label: string;
  value: number | string;
  sub?: string;
  tone?: 'default' | 'warning' | 'muted' | 'accent';
  disabled?: boolean;
  onClick?: () => void;
  wide?: boolean;
}

const StatTile = memo(function StatTile({
  label,
  value,
  sub,
  tone = 'default',
  disabled,
  onClick,
  wide = false,
}: StatTileProps) {
  const clickable = !(disabled ?? false) && onClick !== undefined;
  const className = [
    'dashboard-overview__tile',
    `tone-${tone}`,
    wide ? 'is-wide' : '',
    clickable ? 'is-clickable' : '',
    disabled === true ? 'is-disabled' : '',
    typeof value === 'string' ? 'has-text-value' : '',
  ].filter(Boolean).join(' ');

  const content = (
    <>
      <div className="dashboard-overview__tile-head">
        <Text type="secondary" className="dashboard-overview__tile-label">
          {label}
        </Text>
        {clickable && <ChevronRight size={ICON_SIZE.SMALL} className="dashboard-overview__tile-chevron" />}
      </div>
      <div className="dashboard-overview__tile-value" title={typeof value === 'string' ? value : undefined}>
        {value}
      </div>
      {sub !== undefined && sub !== '' && (
        <Text type="secondary" className="dashboard-overview__tile-sub">
          {sub}
        </Text>
      )}
    </>
  );

  if (!clickable) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {content}
    </button>
  );
});

export const DashboardOverview = memo(function DashboardOverview({
  tabs,
  duplicateCount,
  idleCount,
  latestArchive,
  onJump,
  onSearch,
  onTidy,
  onArchive,
  onInsights,
}: DashboardOverviewProps) {
  const { t } = useT();

  const { tabCount, domainCount, windowCount } = useMemo(() => {
    const domains = new Set<string>();
    const windows = new Set<number>();

    for (const tab of tabs) {
      if (tab.hostname !== '') domains.add(tab.hostname);
      windows.add(tab.windowId);
    }

    return {
      tabCount: tabs.length,
      domainCount: domains.size,
      windowCount: windows.size,
    };
  }, [tabs]);

  const pendingCount = duplicateCount + idleCount;

  const workspaceSummary = useMemo(
    () => [
      `${tabCount} ${t('dashboard.tabsStat')}`,
      `${domainCount} ${t('dashboard.domainsStat')}`,
      `${windowCount} ${t('dashboard.windowsStat')}`,
    ].join(' · '),
    [tabCount, domainCount, windowCount, t],
  );

  const latestArchiveStatLabel = useMemo(() => {
    const label = t('dashboard.latestArchive', { name: '' }).trim();
    return label.replace(/[:：]\s*$/, '') || t('dashboard.sessionsStat');
  }, [t]);

  const latestArchiveLabel = useMemo(() => {
    if (latestArchive === null) return t('dashboard.noArchiveYet');
    return latestArchive.name;
  }, [latestArchive, t]);

  const latestArchiveSub = useMemo(() => {
    if (latestArchive === null) return t('dashboard.openArchives');

    try {
      return new Date(latestArchive.createdAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return t('dashboard.openArchives');
    }
  }, [latestArchive, t]);

  return (
    <section aria-label={t('dashboard.subtitle')} className="dashboard-overview">
      <div className="dashboard-overview__header">
        <div className="dashboard-overview__heading">
          <div className="dashboard-overview__title-row">
            <Text strong className="dashboard-overview__title">
              {t('dashboard.subtitle')}
            </Text>
            <span className={`dashboard-overview__state-pill${pendingCount > 0 ? ' is-alert' : ' is-calm'}`}>
              {pendingCount > 0 ? `${pendingCount} ${t('header.pending')}` : t('dashboard.allClear')}
            </span>
          </div>
          <Text type="secondary" className="dashboard-overview__meta">
            {workspaceSummary}
          </Text>
        </div>

        <Space size={8} wrap className="dashboard-overview__actions">
          <Button
            size="small"
            icon={<Search size={ICON_SIZE.DEFAULT} />}
            onClick={onSearch}
            className="dashboard-overview__action-btn"
          >
            {t('dashboard.searchAction')}
          </Button>
          <Button
            size="small"
            icon={<Zap size={ICON_SIZE.DEFAULT} />}
            onClick={onTidy}
            disabled={pendingCount === 0}
            className="dashboard-overview__action-btn dashboard-overview__action-btn--tidy"
          >
            {t('dashboard.tidyAction')}
          </Button>
          <Button
            size="small"
            icon={<Save size={ICON_SIZE.DEFAULT} />}
            onClick={onArchive}
            disabled={tabCount === 0}
            className="dashboard-overview__action-btn dashboard-overview__action-btn--primary"
          >
            {t('dashboard.archiveAction')}
          </Button>
          <Button
            size="small"
            icon={<BarChart3 size={ICON_SIZE.DEFAULT} />}
            onClick={onInsights}
            className="dashboard-overview__action-btn"
          >
            {t('insights.title')}
          </Button>
        </Space>
      </div>

      <div className="dashboard-overview__metrics">
        <StatTile
          label={t('dashboard.tabsStat')}
          value={tabCount}
          disabled={tabCount === 0}
          onClick={() => onJump('mainView')}
        />
        <StatTile
          label={t('dashboard.domainsStat')}
          value={domainCount}
          disabled={domainCount === 0}
          onClick={() => onJump('domainView')}
        />
        <StatTile
          label={t('dashboard.windowsStat')}
          value={windowCount}
          disabled={windowCount === 0}
          onClick={() => onJump('windowView')}
        />
        <StatTile
          label={t('dashboard.duplicatesStat')}
          value={duplicateCount}
          tone={duplicateCount > 0 ? 'warning' : 'muted'}
          disabled={duplicateCount === 0}
          onClick={() => onJump('tidyDup')}
        />
        <StatTile
          label={t('dashboard.idleStat')}
          value={idleCount}
          tone={idleCount > 0 ? 'default' : 'muted'}
          disabled={idleCount === 0}
          onClick={() => onJump('tidyIdle')}
        />
        <StatTile
          label={latestArchiveStatLabel}
          value={latestArchiveLabel}
          sub={latestArchiveSub}
          tone={latestArchive !== null ? 'accent' : 'muted'}
          onClick={() => onJump('archive')}
          wide
        />
      </div>
    </section>
  );
});

export default DashboardOverview;
