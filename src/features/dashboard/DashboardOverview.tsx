/**
 * DashboardOverview — 首页工作区概览卡片（F-34）
 *
 * 位置：HeroBar 下方、ActivityStrip 之后、TidySuggestionBar 之前。
 *
 * 内容：
 *   · 6 个统计卡片：标签页 / 域名 / 窗口 / 重复 / 闲置 / 最近归档
 *   · 3 个高频入口按钮：🔎 搜索标签 / 🧹 一键整理 / 💾 归档当前窗口
 *
 * 性能要求（需求 1.12）：`React.memo + useMemo` 一次 render 完成首帧。
 * 派生统计严格从 props 计算，避免内部订阅导致的额外重渲染。
 */

import { memo, useMemo } from 'react';
import { Card, Row, Col, Button, Space, Tag, Typography, theme } from 'antd';
import { Search, Zap, Save, ChevronRight, BarChart3 } from 'lucide-react';
import type { LiveTab, ArchivedSession } from '@/shared/types';
import { useT } from '@/shared/i18n';

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
  /** 当前重复 Tab 数（扣除保留的一条后的可合并数，由父组件按 dedupStrictness 计算） */
  duplicateCount: number;
  /** 当前闲置 Tab 数（由父组件使用 idleThresholdMinutes 计算） */
  idleCount: number;
  /** 最近归档（取首条即可；组件内部仅读取） */
  latestArchive: ArchivedSession | null;
  onJump: (target: DashboardJumpTarget) => void;
  onSearch: () => void;
  onTidy: () => void;
  onArchive: () => void;
  onInsights: () => void;
}

/**
 * 单个统计卡片
 */
interface StatCardProps {
  label: string;
  value: number | string;
  sub?: string;
  tone?: 'default' | 'warning' | 'muted';
  disabled?: boolean;
  onClick?: () => void;
}

const StatCard = memo(function StatCard({ label, value, sub, tone = 'default', disabled, onClick }: StatCardProps) {
  const { token } = theme.useToken();
  const valueColor =
    tone === 'warning' ? token.colorWarning : tone === 'muted' ? token.colorTextTertiary : token.colorText;
  const clickable = !(disabled ?? false) && onClick !== undefined;
  return (
    <Card
      size="small"
      hoverable={clickable}
      onClick={clickable ? onClick : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : -1}
      onKeyDown={(e) => {
        if (!clickable) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      aria-disabled={disabled}
      style={{
        height: '100%',
        borderRadius: 12,
        background: 'var(--canopy-glass-bg)',
        borderColor: 'var(--canopy-hairline)',
        opacity: disabled === true ? 0.6 : 1,
        cursor: clickable ? 'pointer' : 'default',
        transition: 'transform 160ms ease, box-shadow 160ms ease',
      }}
      styles={{ body: { padding: '14px 16px' } }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {label}
        </Text>
        <span style={{ fontSize: 22, fontWeight: 600, color: valueColor, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          {value}
        </span>
        {sub !== undefined && sub !== '' && (
          <Text type="secondary" style={{ fontSize: 11, marginTop: 2 }}>
            {sub}
          </Text>
        )}
      </div>
    </Card>
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
  const { token } = theme.useToken();

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

  const latestArchiveLabel = useMemo(() => {
    if (latestArchive === null) return t('dashboard.noArchiveYet');
    return latestArchive.name;
  }, [latestArchive, t]);

  const latestArchiveSub = useMemo(() => {
    if (latestArchive === null) return '';
    try {
      return new Date(latestArchive.createdAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }, [latestArchive]);

  const subtleActionStyle: React.CSSProperties = {
    background: token.colorFillQuaternary,
    borderColor: token.colorBorderSecondary,
    color: token.colorTextSecondary,
    boxShadow: 'none',
  };

  const subtlePrimaryActionStyle: React.CSSProperties = {
    ...subtleActionStyle,
    color: token.colorText,
  };

  return (
    <section
      aria-label={t('dashboard.subtitle')}
      style={{
        margin: '8px 0 16px',
        padding: '16px 20px',
        borderRadius: 16,
        background: 'var(--canopy-glass-bg)',
        border: '1px solid var(--canopy-hairline)',
        backdropFilter: 'var(--canopy-glass-filter)',
        WebkitBackdropFilter: 'var(--canopy-glass-filter)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text strong style={{ fontSize: 14, letterSpacing: '-0.01em' }}>
            {t('dashboard.subtitle')}
          </Text>
          {duplicateCount + idleCount > 0 && (
            <Tag
              bordered={false}
              style={{
                margin: 0,
                fontWeight: 500,
                fontSize: 11,
                color: token.colorTextSecondary,
                background: token.colorFillSecondary,
              }}
            >
              {t('dashboard.tidyReady')}
            </Tag>
          )}
        </div>
        <Space size={8} wrap>
          <Button size="small" icon={<Search size={ICON_SIZE.DEFAULT} />} onClick={onSearch} style={subtleActionStyle}>
            {t('dashboard.searchAction')}
          </Button>
          <Button size="small" icon={<Zap size={ICON_SIZE.DEFAULT} />} onClick={onTidy} disabled={duplicateCount + idleCount === 0} style={subtleActionStyle}>
            {t('dashboard.tidyAction')}
          </Button>
          <Button size="small" icon={<Save size={ICON_SIZE.DEFAULT} />} onClick={onArchive} disabled={tabCount === 0} style={subtlePrimaryActionStyle}>
            {t('dashboard.archiveAction')}
          </Button>
          <Button size="small" icon={<BarChart3 size={ICON_SIZE.DEFAULT} />} onClick={onInsights} style={subtleActionStyle}>
            {t('insights.title')}
          </Button>
        </Space>
      </div>

      <Row gutter={[12, 12]}>
        <Col xs={12} sm={8} md={4}>
          <StatCard
            label={t('dashboard.tabsStat')}
            value={tabCount}
            disabled={tabCount === 0}
            onClick={() => onJump('mainView')}
          />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <StatCard
            label={t('dashboard.domainsStat')}
            value={domainCount}
            disabled={domainCount === 0}
            onClick={() => onJump('domainView')}
          />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <StatCard
            label={t('dashboard.windowsStat')}
            value={windowCount}
            disabled={windowCount === 0}
            onClick={() => onJump('windowView')}
          />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <StatCard
            label={t('dashboard.duplicatesStat')}
            value={duplicateCount}
            tone={duplicateCount > 0 ? 'warning' : 'muted'}
            disabled={duplicateCount === 0}
            onClick={() => onJump('tidyDup')}
          />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <StatCard
            label={t('dashboard.idleStat')}
            value={idleCount}
            tone={idleCount > 0 ? 'default' : 'muted'}
            disabled={idleCount === 0}
            onClick={() => onJump('tidyIdle')}
          />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card
            size="small"
            hoverable={latestArchive !== null}
            onClick={latestArchive !== null ? () => onJump('archive') : undefined}
            role={latestArchive !== null ? 'button' : undefined}
            tabIndex={latestArchive !== null ? 0 : -1}
            onKeyDown={(e) => {
              if (latestArchive === null) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onJump('archive');
              }
            }}
            style={{
              height: '100%',
              borderRadius: 12,
              background: 'var(--canopy-glass-bg)',
              borderColor: 'var(--canopy-hairline)',
              opacity: latestArchive === null ? 0.6 : 1,
              cursor: latestArchive !== null ? 'pointer' : 'default',
            }}
            styles={{ body: { padding: '14px 16px' } }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('dashboard.latestArchive', { name: '' }).replace('：', '')}
              </Text>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: token.colorText,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                title={latestArchiveLabel}
              >
                {latestArchiveLabel}
                {latestArchive !== null && (
          <ChevronRight size={ICON_SIZE.SMALL} style={{ color: token.colorTextTertiary, flexShrink: 0 }} />
                )}
              </span>
              {latestArchiveSub !== '' && (
                <Text type="secondary" style={{ fontSize: 11, marginTop: 2 }}>
                  {latestArchiveSub}
                </Text>
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </section>
  );
});

export default DashboardOverview;

import { ICON_SIZE } from '@/shared/utils/icon-size';
