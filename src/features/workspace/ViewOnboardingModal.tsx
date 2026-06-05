/**
 * ViewOnboardingModal — 视图引导弹窗
 *
 * 首次使用 GroveTab 时展示 7 个视图的使用场景，
 * 帮助新用户理解不同视图的价值。
 */

import { Modal, Button, Flex, Typography, Card } from "antd";
import { useT } from "@/shared/i18n";
import { VIEW_CONFIGS } from "@/shared/config/views";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { IconRenderer } from "@/shared/ui/IconRenderer";
import styles from "./ViewOnboardingModal.module.less";

const { Text, Title } = Typography;

interface ViewOnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

export function ViewOnboardingModal({ open, onClose }: ViewOnboardingModalProps) {
  const { t } = useT();

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={
        <Flex justify="end" gap={8}>
          <Button onClick={onClose}>{t("onboarding.view.skip")}</Button>
          <Button type="primary" onClick={onClose}>
            {t("onboarding.view.gotIt")}
          </Button>
        </Flex>
      }
      width={640}
      centered
      className="app-view-onboarding-modal"
      styles={{
        body: { padding: "24px 32px 16px" },
      }}
    >
      <Flex vertical align="center" gap={16}>
        <Title level={4} className={styles.onboardingTitle}>
          {t("onboarding.view.title")}
        </Title>
        <Text type="secondary" className={styles.onboardingSubtitle}>
          {t("onboarding.view.subtitle")}
        </Text>

        <Flex wrap="wrap" gap={12} justify="center" className={styles.onboardingGrid}>
          {VIEW_CONFIGS.map((view) => {
            return (
              <Card
                key={view.id}
                size="small"
                className={styles.onboardingCard}
                styles={{
                  body: {
                    padding: 16,
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                  },
                }}
              >
                <Flex align="center" justify="center" className={styles.onboardingIconWrap}>
                  <IconRenderer name={view.iconName} size={ICON_SIZE.LARGE} />
                </Flex>
                <Flex vertical gap={4}>
                  <Text strong className={styles.onboardingCardTitle}>
                    {t(view.labelKey)}
                  </Text>
                  <Text type="secondary" className={styles.onboardingCardDesc}>
                    {t(`view.desc.${view.id}` as const)}
                  </Text>
                </Flex>
              </Card>
            );
          })}
        </Flex>
      </Flex>
    </Modal>
  );
}
