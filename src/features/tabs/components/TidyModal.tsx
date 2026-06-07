/**
 * TidyModal —— 智能整理弹窗
 *
 * 将 TidySuggestionBar 收敛到 Modal 中，用户在 Header 点击"一键整理"时唤起，
 * 不再在主内容区和底部 StatusBar 重复展示。
 */

import { Modal } from "antd";
import { TidySuggestionBar } from "./TidySuggestionBar";
import { useT } from "@/shared/i18n";

interface TidyModalProps {
  open: boolean;
  onClose: () => void;
  /** 触发 expandSignal，让 TidySuggestionBar 自动展开面板 */
  triggerKey: number;
}

export function TidyModal({ open, onClose, triggerKey }: TidyModalProps) {
  const { t } = useT();

  return (
    <Modal
      title={t("智能整理")}
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
      destroyOnClose
    >
      <TidySuggestionBar expandSignal={triggerKey} />
    </Modal>
  );
}
