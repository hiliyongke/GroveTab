/**
 * NewFolderModal — 新建文件夹对话框
 */

import { useEffect, useState } from "react";
import { Modal, Input } from "antd";
import { useT } from "@/shared/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (name: string) => void | Promise<void>;
}

export function NewFolderModal({ open, onClose, onSave }: Props) {
  const { t } = useT();
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName("");
  }, [open]);

  const handleOk = (): void => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    void onSave(trimmed);
  };

  return (
    <Modal
      open={open}
      title={t("新建文件夹")}
      onOk={handleOk}
      onCancel={onClose}
      okText={t("创建")}
      cancelText={t("取消")}
      okButtonProps={{ disabled: name.trim().length === 0 }}
      destroyOnClose
    >
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("文件夹名称")}
        maxLength={100}
        onPressEnter={handleOk}
        className="bookmark-new-folder__input"
      />
    </Modal>
  );
}
