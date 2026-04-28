/**
 * 鱼塘页面 —— 承载小组件、每日热点与后续个性化能力的独立空间。
 */

import type { ReactNode } from 'react';
import { Button, Card, Col, Row, Space, Tag, Typography, theme } from 'antd';
import { BookOpen, CalendarDays, LayoutGrid, Search, Settings, Sparkles } from 'lucide-react';
import { DashboardWidgets } from '@/features/dashboard-widgets/DashboardWidgets';
import { useSettingsStore } from '@/store';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useT } from '@/shared/i18n';

const { Text, Title } = Typography;

interface FishPondPageProps {
  onOpenSearch: () => void;
  onOpenSettings: () => void;
}

function TodaySummary() {
  const { token } = theme.useToken();
  const { t, locale } = useT();
  const now = new Date();
  const dateLabel = now.toLocaleDateString(locale === 'zh-CN' ? 'zh-CN' : 'en-US', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  return (
    <Card
      style={{
        borderRadius: 24,
        background: 'var(--app-glass-bg)',
        border: '1px solid var(--app-hairline)',
        boxShadow: 'var(--app-shadow-card)',
      }}
      styles={{ body: { padding: 24 } }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
        <Space size={8} wrap>
          <Tag color="processing" style={{ margin: 0, border: 0 }}>
            {t('fishpond.tagPersonal')}
          </Tag>
          <Tag style={{ margin: 0, border: 0 }}>{dateLabel}</Tag>
        </Space>
        <Title level={2} style={{ margin: 0, letterSpacing: '-0.04em' }}>
          {t('fishpond.title')}
        </Title>
        <Text style={{ color: token.colorTextSecondary, maxWidth: 680, display: 'block' }}>
          {t('fishpond.subtitle')}
        </Text>
      </div>
    </Card>
  );
}

function FutureCard({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  const { token } = theme.useToken();
  return (
    <Card
      style={{
        height: '100%',
        borderRadius: 18,
        background: token.colorFillQuaternary,
        border: `1px solid ${token.colorBorderSecondary}`,
      }}
      styles={{ body: { padding: 16 } }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: 12,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: token.colorPrimary,
            background: token.colorPrimaryBg,
          }}
        >
          {icon}
        </span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: token.colorText }}>{title}</div>
          <div style={{ fontSize: 12, color: token.colorTextTertiary, marginTop: 4 }}>
            {description}
          </div>
        </div>
        {action}
      </div>
    </Card>
  );
}

export function FishPondPage({ onOpenSearch, onOpenSettings }: FishPondPageProps) {
  const { t } = useT();
  const dashboardWidgets = useSettingsStore((s) => s.settings.dashboardWidgets);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const widgetsEnabled = dashboardWidgets?.enabled !== false;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '28px 0 0' }}>
      <TodaySummary />

      <Row gutter={[14, 14]}>
        <Col xs={24} md={8}>
          <FutureCard
            icon={<BookOpen size={ICON_SIZE.LARGE} />}
            title={t('fishpond.hotspotTitle')}
            description={t('fishpond.hotspotDesc')}
            action={
              <Button size="small" disabled>
                {t('fishpond.comingSoon')}
              </Button>
            }
          />
        </Col>
        <Col xs={24} md={8}>
          <FutureCard
            icon={<Sparkles size={ICON_SIZE.LARGE} />}
            title={t('fishpond.inspirationTitle')}
            description={t('fishpond.inspirationDesc')}
            action={
              <Button size="small" icon={<Search size={ICON_SIZE.SMALL} />} onClick={onOpenSearch}>
                {t('fishpond.openSearch')}
              </Button>
            }
          />
        </Col>
        <Col xs={24} md={8}>
          <FutureCard
            icon={<CalendarDays size={ICON_SIZE.LARGE} />}
            title={t('fishpond.toolboxTitle')}
            description={t('fishpond.toolboxDesc')}
            action={
              <Button
                size="small"
                icon={<Settings size={ICON_SIZE.SMALL} />}
                onClick={onOpenSettings}
              >
                {t('fishpond.manage')}
              </Button>
            }
          />
        </Col>
      </Row>

      {widgetsEnabled ? (
        <DashboardWidgets
          title={t('fishpond.widgetsTitle')}
          description={t('fishpond.widgetsDesc')}
        />
      ) : (
        <Card
          style={{
            borderRadius: 18,
            background: 'var(--app-glass-bg)',
            border: '1px dashed var(--app-hairline)',
          }}
          styles={{ body: { padding: 24, textAlign: 'center' } }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            <LayoutGrid size={ICON_SIZE.XXL} />
            <Text strong>{t('fishpond.widgetsHidden')}</Text>
            <Button
              type="primary"
              onClick={() =>
                void updateSettings({
                  dashboardWidgets: { ...(dashboardWidgets ?? {}), enabled: true },
                })
              }
            >
              {t('fishpond.enableWidgets')}
            </Button>
          </div>
        </Card>
      )}
    </section>
  );
}

export default FishPondPage;
