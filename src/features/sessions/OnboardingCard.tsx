/**
 * OnboardingCard v2 —— 首次访问双模式引导（F-25 升级）
 *
 * 流程：
 *   1. 欢迎屏：两个大按钮
 *      - 🌐 接管新标签页（推荐，默认高亮）
 *      - 🧩 仅工具栏按钮
 *   2. 若选"接管"：进入 3 步微引导（工作台总览 → 会话管理 → 效率提升）
 *      键盘：←/→ 切换、Esc 跳过
 *   3. 完成后写入引导完成标志，后续不再自动弹出
 *
 * 注：组件在 App.tsx 里仅在 `!onboarded` 时挂载，本组件内仅负责 UI 与写盘。
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
} from "react";
import { Button, Card, Modal, Progress, Space, Tag, theme, Typography } from "antd";
import { cssVars } from "@/shared/utils/css-vars";
import {
  ArrowLeft,
  ArrowRight,
  Globe,
  Package,
  Network,
  Layers,
  Zap,
  Sparkles,
  Check,
} from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { markOnboardingDone } from "@/repositories";
import { useSettingsStore } from "@/store";
import { useT } from "@/shared/i18n";
import { BRAND } from "@/shared/config/brand";
import styles from "./styles/onboarding.module.less";

const { Text, Paragraph } = Typography;

interface OnboardingCardProps {
  onDismiss: () => void;
}

type Phase = "welcome" | "tour";

interface TourStep {
  icon: ReactElement;
  title: string;
  desc: string;
}

export function OnboardingCard({ onDismiss }: OnboardingCardProps) {
  const [phase, setPhase] = useState<Phase>("welcome");
  const [stepIndex, setStepIndex] = useState(0);
  const [closed, setClosed] = useState(false);
  const { t } = useT();
  const { token } = theme.useToken();
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const tourSteps = useMemo<TourStep[]>(
    () => [
      { icon: <Network size={ICON_SIZE.XXLARGE} />, title: t("工作台总览"), desc: t("所有打开的标签页都会在这里按域名自动分组展示，{brand} 帮你一屏掌握全局", { brand: BRAND.name }) },
      { icon: <Layers size={ICON_SIZE.XXLARGE} />, title: t("会话管理"), desc: t("一键归档当前工作区，稍后从侧边栏恢复，告别数不清的标签页") },
      { icon: <Sparkles size={ICON_SIZE.XXLARGE} />, title: t("效率提升"), desc: t("⌘K 全局搜索、快捷键批量关闭、自动释放内存——让浏览器更快更轻") },
    ],
    [t],
  );

  const welcomeVars = useMemo(
    () =>
      cssVars({
        "--onboarding-card-radius": `${token.borderRadiusLG * 1.5}px`,
        "--onboarding-card-shadow": token.boxShadowSecondary,
        "--onboarding-card-primary-bg": token.colorPrimaryBg,
        "--onboarding-card-primary": token.colorPrimary,
        "--onboarding-card-text": token.colorText,
        "--onboarding-card-text-tertiary": token.colorTextTertiary,
      }),
    [token],
  );

  const tourVars = useMemo(
    () =>
      cssVars({
        "--onboarding-tour-primary-bg": token.colorPrimaryBg,
        "--onboarding-tour-primary": token.colorPrimary,
        "--onboarding-tour-text-tertiary": token.colorTextTertiary,
      }),
    [token],
  );

  const finish = useCallback(async () => {
    await markOnboardingDone();
    setClosed(true);
    onDismiss();
  }, [onDismiss]);

  const pickOverride = useCallback(
    async (next: boolean) => {
      await updateSettings({ overrideNewTab: next });
      if (next) {
        setPhase("tour");
        setStepIndex(0);
      } else {
        await finish();
      }
    },
    [updateSettings, finish],
  );

  useEffect(() => {
    if (phase !== "tour") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setStepIndex((idx) => Math.min(idx + 1, tourSteps.length - 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setStepIndex((idx) => Math.max(idx - 1, 0));
      } else if (e.key === "Escape") {
        e.preventDefault();
        void finish();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, finish]);

  const progressPercent = useMemo(
    () => Math.round(((stepIndex + 1) / tourSteps.length) * 100),
    [stepIndex],
  );

  if (closed) return null;

  if (phase === "welcome") {
    return (
      <Card
        className={styles["onboarding-card"]}
        classNames={{ body: styles["onboarding-card__body"] }}
        style={welcomeVars}
      >
        <div aria-hidden className={styles["onboarding-card__glow"]} />
        <div className={styles["onboarding-card__badge"]}>
          <Network size={ICON_SIZE.XXXLARGE} />
        </div>

        <div className={styles["onboarding-card__headline"]}>
          <Typography.Title level={2} className={styles["onboarding-card__title"]}>
            {t('欢迎使用 {brand}', { brand: BRAND.name })}
            <Zap size={ICON_SIZE.MEDIUM} className={styles["onboarding-card__title-icon"]} />
          </Typography.Title>
          <Text type="secondary" className={styles["onboarding-card__subtitle"]}>
            {t('你的标签页，找到归属。')}
          </Text>
        </div>

        <Paragraph type="secondary" className={styles["onboarding-card__detail"]}>
          {t('每次打开新标签页，所有已打开的网页都会在这里展示。按域名分组、搜索、归档—3 秒内找到任何标签。')}
        </Paragraph>

        <Space wrap size={12} className={styles["onboarding-card__features"]}>
          <Tag color="processing" className={styles["onboarding-card__feature-tag"]}>
            {t('全局搜索')}
          </Tag>
          <Tag color="gold" className={styles["onboarding-card__feature-tag"]}>
            {t('一键归档')}
          </Tag>
          <Tag color="green" className={styles["onboarding-card__feature-tag"]}>
            {t('智能分组')}
          </Tag>
        </Space>

        <div className={styles["onboarding-card__actions"]}>
          <Button
            className={`${styles["app-lift"]} ${styles["onboarding-card__cta"]} ${styles["onboarding-card__cta--primary"]}`}
            type="primary"
            size="large"
            onClick={() => {
              void pickOverride(true);
            }}
            icon={<Globe size={ICON_SIZE.LARGE} />}
            autoFocus
          >
            {t('接管新标签页（推荐）')}
          </Button>
          <Button
            size="large"
            className={styles["onboarding-card__cta"]}
            onClick={() => {
              void pickOverride(false);
            }}
            icon={<Package size={ICON_SIZE.LARGE} />}
          >
            {t('仅工具栏按钮')}
          </Button>
        </div>
        <Text type="secondary" className={styles["onboarding-card__hint"]}>
          {t('随时可在 设置 → 行为 中切换模式')}
        </Text>
      </Card>
    );
  }

  const step = tourSteps[stepIndex];
  if (!step) return null;
  return (
    <Modal
      open
      centered
      width={560}
      onCancel={() => void finish()}
      footer={null}
      closable={false}
      classNames={{ body: styles["onboarding-tour-modal__body"] }}
    >
      <div className={styles["onboarding-tour"]} style={tourVars}>
        <div className={styles["onboarding-tour__header"]}>
          <div className={styles["onboarding-tour__step-badge"]}>{step.icon}</div>
          <div className={styles["onboarding-tour__step-copy"]}>
            <Text strong className={styles["onboarding-tour__step-title"]}>
              {step.title}
            </Text>
            <Text type="secondary" className={styles["onboarding-tour__step-index"]}>
              {t('第 {current} / {total} 步', { current: stepIndex + 1, total: tourSteps.length })}
            </Text>
          </div>
        </div>

        <Paragraph type="secondary" className={styles["onboarding-tour__description"]}>
          {step.desc}
        </Paragraph>

        <Progress percent={progressPercent} showInfo={false} />

        <div className={styles["onboarding-tour__footer"]}>
          <Button
            type="text"
            onClick={() => void finish()}
            className={styles["onboarding-tour__skip"]}
          >
            {t('跳过引导')}
          </Button>
          <Space size={8}>
            <Button
              icon={<ArrowLeft size={ICON_SIZE.DEFAULT} />}
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((idx) => Math.max(idx - 1, 0))}
            >
              {t('上一步')}
            </Button>
            {stepIndex < tourSteps.length - 1 ? (
              <Button
                type="primary"
                iconPlacement="end"
                icon={<ArrowRight size={ICON_SIZE.DEFAULT} />}
                onClick={() => setStepIndex((idx) => Math.min(idx + 1, tourSteps.length - 1))}
              >
                {t('下一步')}
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<Check size={ICON_SIZE.DEFAULT} />}
                onClick={() => void finish()}
              >
                {t('开始使用')}
              </Button>
            )}
          </Space>
        </div>
      </div>
    </Modal>
  );
}
