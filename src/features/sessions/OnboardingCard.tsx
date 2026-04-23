/**
 * OnboardingCard —— 首次访问引导卡片（antd 版）
 *
 * 设计：
 *   - antd Card 作为容器，带背景光晕装饰
 *   - 主 CTA 使用 antd Button（primary）+ 箭头图标
 */

import { useState } from 'react';
import { Button, Card, theme } from 'antd';
import { ArrowRightOutlined, ApartmentOutlined, ThunderboltFilled } from '@ant-design/icons';
import { markOnboardingDone } from '@/repositories';
import { useT } from '@/shared/i18n';

interface OnboardingCardProps {
  onDismiss: () => void;
}

/**
 * 首次访问引导卡片
 */
export function OnboardingCard({ onDismiss }: OnboardingCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const { t } = useT();
  const { token } = theme.useToken();

  const handleDismiss = async () => {
    await markOnboardingDone();
    setDismissed(true);
    onDismiss();
  };

  if (dismissed) return null;

  return (
    <Card
      style={{
        position: 'relative',
        maxWidth: 560,
        margin: '0 auto 20px',
        overflow: 'hidden',
        borderRadius: token.borderRadiusLG * 1.5,
        boxShadow: token.boxShadowSecondary,
      }}
      styles={{
        body: {
          position: 'relative',
          padding: '28px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 14,
        },
      }}
    >
      {/* 背景装饰光晕 */}
      <div
        aria-hidden
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          top: -48,
          right: -48,
          width: 192,
          height: 192,
          borderRadius: '50%',
          background: `radial-gradient(closest-side, ${token.colorPrimaryBg}, transparent)`,
        }}
      />

      {/* Logo 软底板 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 56,
          height: 56,
          borderRadius: token.borderRadiusLG,
          background: token.colorPrimaryBg,
          color: token.colorPrimary,
          position: 'relative',
        }}
      >
        <ApartmentOutlined style={{ fontSize: 26 }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: token.colorText,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {t('onboarding.title')}
          <ThunderboltFilled style={{ fontSize: 14, color: token.colorPrimary }} />
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 500,
            color: token.colorTextSecondary,
          }}
        >
          {t('onboarding.desc')}
        </p>
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 12.5,
          color: token.colorTextTertiary,
          maxWidth: 380,
          lineHeight: 1.6,
        }}
      >
        {t('onboarding.detail')}
      </p>

      <Button
        type="primary"
        size="large"
        onClick={() => { void handleDismiss(); }}
        icon={<ArrowRightOutlined />}
        iconPosition="end"
        style={{ marginTop: 4 }}
      >
        {t('onboarding.dismiss')}
      </Button>
    </Card>
  );
}
