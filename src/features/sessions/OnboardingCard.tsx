/**
 * OnboardingCard v2 —— 首次访问双模式引导（F-25 升级）
 *
 * 流程：
 *   1. 欢迎屏：两个大按钮
 *      - 🌐 接管新标签页（推荐，默认高亮）
 *      - 🧩 仅工具栏按钮
 *   2. 若选"接管"：进入 3 步微引导（工作台总览 → 归档演示 → 快捷键帮助）
 *      键盘：←/→ 切换、Esc 跳过
 *   3. 完成后写 `canopy_onboarded=true`，后续不再自动弹出
 *
 * 注：组件在 App.tsx 里仅在 `!onboarded` 时挂载，本组件内仅负责 UI 与写盘。
 */

import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Button, Card, Modal, Progress, Space, Tag, theme, Typography } from 'antd';
import {
  ArrowLeft,
  ArrowRight,
  Globe,
  Package,
  Network,
  Zap,
  Keyboard,
  Archive as ArchiveIcon,
  Check,
} from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { markOnboardingDone } from '@/repositories';
import { useSettingsStore } from '@/store';
import { useT } from '@/shared/i18n';

const { Text, Paragraph } = Typography;

interface OnboardingCardProps {
  onDismiss: () => void;
}

type Phase = 'welcome' | 'tour';

interface TourStep {
  icon: ReactElement;
  titleKey: string;
  descKey: string;
}

const TOUR_STEPS: TourStep[] = [
  { icon: <Network size={ICON_SIZE.XXLARGE} />, titleKey: 'onboarding.tour.overviewTitle', descKey: 'onboarding.tour.overviewDesc' },
  { icon: <ArchiveIcon size={ICON_SIZE.XXLARGE} />, titleKey: 'onboarding.tour.archiveTitle', descKey: 'onboarding.tour.archiveDesc' },
  { icon: <Keyboard size={ICON_SIZE.XXLARGE} />, titleKey: 'onboarding.tour.shortcutsTitle', descKey: 'onboarding.tour.shortcutsDesc' },
];

/**
 * 首次访问引导卡片（v2）
 */
export function OnboardingCard({ onDismiss }: OnboardingCardProps) {
  const [phase, setPhase] = useState<Phase>('welcome');
  const [stepIndex, setStepIndex] = useState(0);
  const [closed, setClosed] = useState(false);
  const { t } = useT();
  const { token } = theme.useToken();
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const finish = useCallback(async () => {
    await markOnboardingDone();
    setClosed(true);
    onDismiss();
  }, [onDismiss]);

  const pickOverride = useCallback(
    async (next: boolean) => {
      await updateSettings({ overrideNewTab: next });
      if (next) {
        setPhase('tour');
        setStepIndex(0);
      } else {
        await finish();
      }
    },
    [updateSettings, finish],
  );

  // ── 键盘导航 ──
  useEffect(() => {
    if (phase !== 'tour') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setStepIndex((idx) => Math.min(idx + 1, TOUR_STEPS.length - 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setStepIndex((idx) => Math.max(idx - 1, 0));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        void finish();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, finish]);

  const progressPercent = useMemo(
    () => Math.round(((stepIndex + 1) / TOUR_STEPS.length) * 100),
    [stepIndex],
  );

  if (closed) return null;

  if (phase === 'welcome') {
    return (
      <Card
        style={{
          position: 'relative',
          maxWidth: 640,
          margin: '0 auto 20px',
          overflow: 'hidden',
          borderRadius: token.borderRadiusLG * 1.5,
          boxShadow: token.boxShadowSecondary,
        }}
        styles={{
          body: {
            position: 'relative',
            padding: '28px 28px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 16,
          },
        }}
      >
        {/* 背景光晕 */}
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
          }}
        >
          <Network size={ICON_SIZE.XXXLARGE} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 22,
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
            <Zap size={ICON_SIZE.MEDIUM} style={{ color: token.colorPrimary }} />
          </h2>
          <Text type="secondary" style={{ fontSize: 14 }}>
            {t('onboarding.desc')}
          </Text>
        </div>

        <Paragraph type="secondary" style={{ margin: 0, fontSize: 12.5, maxWidth: 460, lineHeight: 1.6 }}>
          {t('onboarding.detail')}
        </Paragraph>

        <Space wrap size={12} style={{ justifyContent: 'center' }}>
          <Tag bordered={false} color="processing" style={{ margin: 0, fontWeight: 500 }}>
            {t('onboarding.featureSearch')}
          </Tag>
          <Tag bordered={false} color="gold" style={{ margin: 0, fontWeight: 500 }}>
            {t('onboarding.featureArchive')}
          </Tag>
          <Tag bordered={false} color="green" style={{ margin: 0, fontWeight: 500 }}>
            {t('onboarding.featureGroup')}
          </Tag>
        </Space>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            width: '100%',
            marginTop: 4,
          }}
        >
          <Button
            className="canopy-lift"
            type="primary"
            size="large"
            onClick={() => {
              void pickOverride(true);
            }}
            icon={<Globe size={ICON_SIZE.LARGE} />}
            autoFocus
            style={{
              background: 'var(--canopy-logo-gradient)',
              border: 'none',
              boxShadow: 'var(--canopy-logo-glow)',
              fontWeight: 600,
              height: 52,
            }}
          >
            {t('onboarding.modeTakeover')}
          </Button>
          <Button
            size="large"
            onClick={() => {
              void pickOverride(false);
            }}
            icon={<Package size={ICON_SIZE.LARGE} />}
            style={{ height: 52 }}
          >
            {t('onboarding.modePopupOnly')}
          </Button>
        </div>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {t('onboarding.modeHint')}
        </Text>
      </Card>
    );
  }

  // phase === 'tour'
  const step = TOUR_STEPS[stepIndex];
  return (
    <Modal
      open
      centered
      width={560}
      onCancel={() => void finish()}
      footer={null}
      closable={false}
      maskClosable={false}
      styles={{ body: { padding: '28px 28px 24px' } }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: token.colorPrimaryBg,
              color: token.colorPrimary,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {step.icon}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Text strong style={{ fontSize: 16 }}>
              {t(step.titleKey)}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('onboarding.tour.stepIndex', { current: stepIndex + 1, total: TOUR_STEPS.length })}
            </Text>
          </div>
        </div>

        <Paragraph type="secondary" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7 }}>
          {t(step.descKey)}
        </Paragraph>

        <Progress percent={progressPercent} size="small" showInfo={false} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            size="small"
            type="text"
            onClick={() => void finish()}
            style={{ color: token.colorTextTertiary }}
          >
            {t('onboarding.tour.skip')}
          </Button>
          <Space size={8}>
            <Button
              size="small"
              icon={<ArrowLeft size={ICON_SIZE.DEFAULT} />}
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((idx) => Math.max(idx - 1, 0))}
            >
              {t('onboarding.tour.prev')}
            </Button>
            {stepIndex < TOUR_STEPS.length - 1 ? (
              <Button
                size="small"
                type="primary"
                icon={<ArrowRight size={ICON_SIZE.DEFAULT} />}
                iconPosition="end"
                onClick={() => setStepIndex((idx) => Math.min(idx + 1, TOUR_STEPS.length - 1))}
              >
                {t('onboarding.tour.next')}
              </Button>
            ) : (
              <Button
                size="small"
                type="primary"
                icon={<Check size={ICON_SIZE.DEFAULT} />}
                onClick={() => void finish()}
              >
                {t('onboarding.tour.done')}
              </Button>
            )}
          </Space>
        </div>
      </div>
    </Modal>
  );
}

export default OnboardingCard;
