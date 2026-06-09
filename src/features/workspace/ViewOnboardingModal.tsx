/**
 * ViewOnboardingModal — 视图引导弹窗
 *
 * 首次使用 GroveTab 时展示主要视图的使用场景，
 * 帮助新用户理解不同视图的价值。
 */

import { useMemo } from "react";
import { Modal, Button, Flex, Typography, Card, theme } from "antd";
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
  const { token } = theme.useToken();

  const viewDescs = useMemo<Record<string, string>>(
    () => ({
      tabs: t("浏览和管理当前所有打开的标签页"),
      tabgroup: t("按 Chrome 标签组分组管理标签页"),
      window: t("按浏览器窗口分组管理标签页"),
      timeline: t("按时间轴查看标签页活动"),
      kanban: t("看板视图管理任务和工作流"),
      bookmarks: t("管理和搜索浏览器书签"),
      frequency: t("查看标签页访问频率热力图"),
      history: t("浏览和搜索浏览历史记录"),
      archive: t("归档和管理已保存的标签会话"),
      trash: t("查看和恢复已删除的标签页"),
      sessions: t("保存和恢复会话快照"),
      insights: t("统计洞察与数据可视化"),
      trending: t("聚合全网热点与热榜资讯"),
      devtools: t("本地开发工具集（JSON、加密、编码等）"),
    }),
    [t],
  );

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={
        <Flex justify="end" gap={8}>
          <Button onClick={onClose}>{t("跳过")}</Button>
          <Button type="primary" onClick={onClose}>
            {t("知道了")}
          </Button>
        </Flex>
      }
      width={640}
      centered
      className="app-view-onboarding-modal"
    >
      <Flex vertical align="center" gap={16}>
        <Title level={4} className={styles.onboardingTitle}>
          {t("欢迎使用 GroveTab")}
        </Title>
        <Text type="secondary" className={styles.onboardingSubtitle}>
          {t("选择一个视图开始浏览")}
        </Text>

        <Flex wrap="wrap" gap={12} justify="center" className={styles.onboardingGrid}>
          {VIEW_CONFIGS.filter((v) => v.primary !== false).map((view) => {
            return (
              <Card
                key={view.id}
                className={styles.onboardingCard}
                styles={{
                  body: {
                    display: "flex",
                    gap: token.paddingSM,
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
                    {viewDescs[view.id] ?? ""}
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
