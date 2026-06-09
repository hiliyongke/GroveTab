/**
 * DuplicatesModal — 重复书签检测结果
 *
 * 策略：URL 完全相等（lowercase）视为重复。
 * 用户可对单个组或全部组执行清理。
 */

import { Modal, Button, Flex, Typography } from "antd";
import { Merge, CheckCircle2, Trash2 } from "lucide-react";
import { useT } from "@/shared/i18n";
import type { DuplicateGroup } from "../hooks/use-duplicate-finder";

interface Props {
  open: boolean;
  groups: DuplicateGroup[];
  onClose: () => void;
  onRemoveGroup: (group: DuplicateGroup) => Promise<number>;
  onRemoveAll: () => Promise<number>;
}

export function DuplicatesModal({ groups, open, onClose, onRemoveGroup, onRemoveAll }: Props) {
  const { t } = useT();

  return (
    <Modal
      open={open}
      title={t("重复书签")}
      onCancel={onClose}
      width={680}
      footer={
        groups.length > 0
          ? [
              <Button key="del-all" danger onClick={() => void onRemoveAll()}>
                {t("清理全部重复")}
              </Button>,
              <Button key="close" onClick={onClose}>
                {t("关闭")}
              </Button>,
            ]
          : [
              <Button key="close" onClick={onClose}>
                {t("关闭")}
              </Button>,
            ]
      }
    >
      {groups.length === 0 ? (
        <Flex vertical align="center" gap={12} className="bookmark-duplicates-modal__success">
          <CheckCircle2 size={32} className="bookmark-duplicates-modal__success-icon" />
          <Typography.Text type="success">{t("没有重复书签！")}</Typography.Text>
          <Typography.Text type="secondary">{t("保持定期整理是个好习惯")}</Typography.Text>
        </Flex>
      ) : (
        <Flex vertical gap={12} className="bookmark-duplicates-modal__list">
          {groups.map((group) => (
            <Flex
              key={group.url}
              vertical
              className="bookmark-duplicates-modal__group"
            >
              <Flex align="center" gap={6} className="bookmark-duplicates-modal__group-header">
                <Merge size={14} className="bookmark-duplicates-modal__group-icon" />
                <Typography.Text type="secondary" className="bookmark-duplicates-modal__group-url">
                  {group.url}
                </Typography.Text>
                <Typography.Text type="secondary" className="bookmark-duplicates-modal__group-count">
                  {t("{n} 个重复", { n: group.items.length })}
                </Typography.Text>
              </Flex>
              {group.items.map((item, idx) => (
                <Flex key={item.id} align="center" gap={8} className="bookmark-duplicates-modal__item">
                  <span className="bookmark-duplicates-modal__item-idx">#{idx + 1}</span>
                  <span className="bookmark-duplicates-modal__item-title">{item.title}</span>
                  {idx === 0 && (
                    <span className="bookmark-duplicates-modal__item-keep">{t("保留")}</span>
                  )}
                </Flex>
              ))}
              <Button
                danger
                icon={<Trash2 size={12} />}
                onClick={() => void onRemoveGroup(group)}
                className="bookmark-duplicates-modal__remove-btn"
              >
                {t("清理 {n} 个重复项", { n: group.items.length - 1 })}
              </Button>
            </Flex>
          ))}
        </Flex>
      )}
    </Modal>
  );
}
