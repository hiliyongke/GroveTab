/**
 * OnboardingCard v2 —— 首次访问双模式引导（F-25 升级）
 *
 * 流程：
 *   1. 欢迎屏：两个大按钮
 *      - 🌐 接管新标签页（推荐，默认高亮）
 *      - 🧩 仅工具栏按钮
 *   2. 若选"接管"：进入 3 步微引导（工作台总览 → 归档演示 → 快捷键帮助）
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
  type CSSProperties,
  type ReactElement,
} from "react";
import { Button, Card, Modal, Progress, Space, Tag, theme, Typography } from "antd";
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
  titleKey: string;
  descKey: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    icon: <Network size={ICON_SIZE.XXLARGE} />,
    titleKey: "onboarding.tour.overviewTitle",
    descKey: "onboarding.tour.overviewDesc",
  },
  {
    icon: <ArchiveIcon size={ICON_SIZE.XXLARGE} />,
    titleKey: "onboarding.tour.archiveTitle",
    descKey: "onboarding.tour.archiveDesc",
  },
  {
    icon: <Keyboard size={ICON_SIZE.XXLARGE} />,
    titleKey: "onboarding.tour.shortcutsTitle",
    descKey: "onboarding.tour.shortcutsDesc",
  },
];

function cssVars(vars: Record<string, string>): CSSProperties {
  return vars;
}

export function OnboardingCard({ onDismiss }: OnboardingCardProps) {
  const [phase, setPhase] = useState<Phase>("welcome");
  const [stepIndex, setStepIndex] = useState(0);
  const [closed, setClosed] = useState(false);
  const { t } = useT();
  const { token } = theme.useToken();
  const updateSettings = useSettingsStore((s) => s.updateSettings);

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
        setStepIndex((idx) => Math.min(idx + 1, TOUR_STEPS.length - 1));
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
    () => Math.round(((stepIndex + 1) / TOUR_STEPS.length) * 100),
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
            {t("onboarding.title", { brand: BRAND.name })}
            <Zap size={ICON_SIZE.MEDIUM} className={styles["onboarding-card__title-icon"]} />
          </Typography.Title>
          <Text type="secondary" className={styles["onboarding-card__subtitle"]}>
            {t("onboarding.desc")}
          </Text>
        </div>

        <Paragraph type="secondary" className={styles["onboarding-card__detail"]}>
          {t("onboarding.detail")}
        </Paragraph>

        <Space wrap size={12} className={styles["onboarding-card__features"]}>
          <Tag
            bordered={false}
            color="processing"
            className={styles["onboarding-card__feature-tag"]}
          >
            {t("onboarding.featureSearch")}
          </Tag>
          <Tag bordered={false} color="gold" className={styles["onboarding-card__feature-tag"]}>
            {t("onboarding.featureArchive")}
          </Tag>
          <Tag bordered={false} color="green" className={styles["onboarding-card__feature-tag"]}>
            {t("onboarding.featureGroup")}
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
            {t("onboarding.modeTakeover")}
          </Button>
          <Button
            size="large"
            className={styles["onboarding-card__cta"]}
            onClick={() => {
              void pickOverride(false);
            }}
            icon={<Package size={ICON_SIZE.LARGE} />}
          >
            {t("onboarding.modePopupOnly")}
          </Button>
        </div>
        <Text type="secondary" className={styles["onboarding-card__hint"]}>
          {t("onboarding.modeHint")}
        </Text>
      </Card>
    );
  }

  const step = TOUR_STEPS[stepIndex];
  if (!step) return null;
  return (
    <Modal
      open
      centered
      width={560}
      onCancel={() => void finish()}
      footer={null}
      closable={false}
      maskClosable={false}
      classNames={{ body: styles["onboarding-tour-modal__body"] }}
    >
      <div className={styles["onboarding-tour"]} style={tourVars}>
        <div className={styles["onboarding-tour__header"]}>
          <div className={styles["onboarding-tour__step-badge"]}>{step.icon}</div>
          <div className={styles["onboarding-tour__step-copy"]}>
            <Text strong className={styles["onboarding-tour__step-title"]}>
              {t(step.titleKey)}
            </Text>
            <Text type="secondary" className={styles["onboarding-tour__step-index"]}>
              {t("onboarding.tour.stepIndex", { current: stepIndex + 1, total: TOUR_STEPS.length })}
            </Text>
          </div>
        </div>

        <Paragraph type="secondary" className={styles["onboarding-tour__description"]}>
          {t(step.descKey, { brand: BRAND.name })}
        </Paragraph>

        <Progress percent={progressPercent} size="small" showInfo={false} />

        <div className={styles["onboarding-tour__footer"]}>
          <Button
            size="small"
            type="text"
            onClick={() => void finish()}
            className={styles["onboarding-tour__skip"]}
          >
            {t("onboarding.tour.skip")}
          </Button>
          <Space size={8}>
            <Button
              size="small"
              icon={<ArrowLeft size={ICON_SIZE.DEFAULT} />}
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((idx) => Math.max(idx - 1, 0))}
            >
              {t("onboarding.tour.prev")}
            </Button>
            {stepIndex < TOUR_STEPS.length - 1 ? (
              <Button
                size="small"
                type="primary"
                icon={<ArrowRight size={ICON_SIZE.DEFAULT} />}
                iconPosition="end"
                onClick={() => setStepIndex((idx) => Math.min(idx + 1, TOUR_STEPS.length - 1))}
              >
                {t("onboarding.tour.next")}
              </Button>
            ) : (
              <Button
                size="small"
                type="primary"
                icon={<Check size={ICON_SIZE.DEFAULT} />}
                onClick={() => void finish()}
              >
                {t("onboarding.tour.done")}
              </Button>
            )}
          </Space>
        </div>
      </div>
    </Modal>
  );
}
