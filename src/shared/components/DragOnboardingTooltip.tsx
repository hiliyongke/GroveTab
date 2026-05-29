/**
 * DragOnboardingTooltip — 拖拽功能引导提示组件
 *
 * 首次拖拽时显示，解释 Ghost Drop Zone 的使用方法
 */

import { useState } from "react";
import { Button, Flex, Typography, Tour } from "antd";
import { MousePointerClick, Plus, Merge, Layers } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";

interface DragOnboardingTooltipProps {
  /** 关闭引导回调 */
  onClose: () => void;
  /** 可选的目标元素 ref，用于定位 */
  targetElement?: HTMLElement | null;
}

/**
 * 拖拽功能引导提示组件
 *
 * 使用 Antd Tour 组件展示拖拽功能说明
 */
export function DragOnboardingTooltip({ onClose, targetElement }: DragOnboardingTooltipProps) {
  const { t } = useT();
  const [open, setOpen] = useState(true);

  const steps = [
    {
      title: t("dragOnboarding.welcome.title"),
      description: (
        <Flex vertical gap={12}>
          <Typography.Text>
            {t("dragOnboarding.welcome.description")}
          </Typography.Text>
          <Flex vertical gap={8}>
            <Flex align="center" gap={8}>
              <Plus size={ICON_SIZE.SMALL} />
              <Typography.Text>
                {t("dragOnboarding.feature.createGroup")}
              </Typography.Text>
            </Flex>
            <Flex align="center" gap={8}>
              <Merge size={ICON_SIZE.SMALL} />
              <Typography.Text>
                {t("dragOnboarding.feature.merge")}
              </Typography.Text>
            </Flex>
            <Flex align="center" gap={8}>
              <Layers size={ICON_SIZE.SMALL} />
              <Typography.Text>
                {t("dragOnboarding.feature.reorder")}
              </Typography.Text>
            </Flex>
          </Flex>
        </Flex>
      ),
      target: () => targetElement || document.body,
    },
    {
      title: t("dragOnboarding.dropZone.title"),
      description: (
        <Flex vertical gap={12}>
          <Typography.Text>
            {t("dragOnboarding.dropZone.description")}
          </Typography.Text>
          <Typography.Text type="secondary">
            {t("dragOnboarding.dropZone.hint")}
          </Typography.Text>
        </Flex>
      ),
      target: () => targetElement || document.body,
    },
  ];

  const handleClose = () => {
    setOpen(false);
    onClose();
  };

  return (
    <Tour
      open={open}
      onClose={handleClose}
      steps={steps}
      indicatorsRender={(current, total) => (
        <span>
          {current + 1} / {total}
        </span>
      )}
    />
  );
}

/**
 * 简化的拖拽提示横幅组件
 * 用于在拖拽时显示在界面顶部
 */
export function DragOnboardingBanner({ onClose }: { onClose: () => void }) {
  const { t } = useT();

  return (
    <Flex
      align="center"
      justify="space-between"
      className="drag-onboarding-banner"
      style={{
        position: "fixed",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        padding: "12px 20px",
        background: "var(--ant-color-primary-bg)",
        border: "1px solid var(--ant-color-primary)",
        borderRadius: "var(--ant-border-radius-lg)",
        boxShadow: "var(--ant-box-shadow)",
        maxWidth: 480,
      }}
    >
      <Flex align="center" gap={12}>
        <MousePointerClick size={ICON_SIZE.MEDIUM} color="var(--ant-color-primary)" />
        <Typography.Text>
          {t("dragOnboarding.banner.text")}
        </Typography.Text>
      </Flex>
      <Button type="primary" size="small" onClick={onClose}>
        {t("dragOnboarding.banner.gotIt")}
      </Button>
    </Flex>
  );
}
