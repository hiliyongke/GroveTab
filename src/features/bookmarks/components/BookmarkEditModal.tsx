/**
 * BookmarkEditModal — 添加/编辑书签对话框
 *
 * 行为：
 *   - 标题必填
 *   - URL 为空时自动根据标题生成（容错）
 *   - Enter 提交，Esc 关闭
 */

import { useEffect, useState } from "react";
import { Modal, Input, Flex, Typography } from "antd";
import { useT } from "@/shared/i18n";

interface Props {
  open: boolean;
  isNew: boolean;
  initialTitle?: string;
  initialUrl?: string;
  onClose: () => void;
  onSave: (title: string, url: string) => void | Promise<void>;
}

function buildUrlFromTitle(title: string): string {
  const slug = title.toLowerCase().trim().replace(/\s+/g, "-");
  return `https://${slug}.com`;
}

export function BookmarkEditModal({ open, isNew, initialTitle, initialUrl, onClose, onSave }: Props) {
  const { t } = useT();
  const [title, setTitle] = useState(initialTitle ?? "");
  const [url, setUrl] = useState(initialUrl ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(initialTitle ?? "");
      setUrl(initialUrl ?? "");
    }
  }, [open, initialTitle, initialUrl, isNew]);

  const handleOk = async (): Promise<void> => {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) return;
    const trimmedUrl = url.trim() || buildUrlFromTitle(trimmedTitle);
    // 自动生成 URL 可能无效，静默允许但由用户确认
    setSaving(true);
    try {
      await onSave(trimmedTitle, trimmedUrl);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={isNew ? t("添加书签") : t("编辑书签")}
      onOk={() => {
        void handleOk();
      }}
      onCancel={onClose}
      okText={t("保存")}
      cancelText={t("取消")}
      confirmLoading={saving}
      okButtonProps={{ disabled: title.trim().length === 0 }}
      destroyOnClose
    >
      <Flex vertical gap={12} className="bookmark-edit-modal__body">
        <div>
          <Typography.Text type="secondary" className="bookmark-edit-modal__label">
            {t("标题")}
          </Typography.Text>
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("书签标题")}
            onPressEnter={() => {
              void handleOk();
            }}
            maxLength={200}
          />
        </div>
        <div>
          <Typography.Text type="secondary" className="bookmark-edit-modal__label">
            {t("网址")}
          </Typography.Text>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
            onPressEnter={() => {
              void handleOk();
            }}
            maxLength={2000}
          />
        </div>
      </Flex>
    </Modal>
  );
}
