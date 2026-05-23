/**
 * BatchOperationsMenu - 批量操作菜单组件
 * 提供多选模式和批量操作功能，支持恢复、删除、合并等操作
 */

import { useState } from "react";
import { Undo2, Trash2, GitMerge, Download, CheckSquare, X } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import type { MenuProps } from "antd";
import { Button, Dropdown, Space, Popconfirm, Tooltip, Badge } from "antd";
import { useT } from "@/shared/i18n";
import { feedback } from "@/shared/ui/feedback";

export interface BatchOperationsMenuProps {
  /** 选中的会话ID集合 */
  selectedIds: Set<string>;
  /** 总会话数量 */
  totalCount: number;
  /** 是否处于选择模式 */
  selectable: boolean;
  /** 切换选择模式 */
  onToggleSelectMode: (enabled: boolean) => void;
  /** 批量恢复选中的会话 */
  onBatchRestore: (ids: string[]) => void | Promise<void>;
  /** 批量删除选中的会话 */
  onBatchDelete: (ids: string[]) => void | Promise<void>;
  /** 合并选中的会话 */
  onMergeSessions: (ids: string[]) => void | Promise<void>;
  /** 导出选中的会话 */
  onExportSessions: (ids: string[]) => void | Promise<void>;
  /** 清空所有会话 */
  onClearAll: () => void | Promise<void>;
}

export function BatchOperationsMenu({
  selectedIds,
  totalCount,
  selectable,
  onToggleSelectMode,
  onBatchRestore,
  onBatchDelete,
  onMergeSessions,
  onExportSessions,
  onClearAll,
}: BatchOperationsMenuProps) {
  const { t } = useT();
  const [operating, setOperating] = useState(false);

  const selectedCount = selectedIds.size;

  const menuItems: MenuProps["items"] = [
    {
      key: "restore",
      label: t("archive.batchRestore"),
      icon: <Undo2 size={ICON_SIZE.SMALL} />,
      disabled: selectedCount === 0 || operating,
      onClick: () => {
        void (async () => {
          setOperating(true);
          try {
            await onBatchRestore(Array.from(selectedIds));
            feedback.success(t("archive.batchRestoreSuccess", { count: selectedCount }));
          } catch (_error) {
            feedback.error(t("archive.batchRestoreFailed"));
          } finally {
            setOperating(false);
          }
        })();
      },
    },
    {
      key: "delete",
      label: t("archive.batchDelete"),
      icon: <Trash2 size={ICON_SIZE.SMALL} />,
      danger: true,
      disabled: selectedCount === 0 || operating,
      onClick: () => {
        void (async () => {
          setOperating(true);
          try {
            await onBatchDelete(Array.from(selectedIds));
            feedback.success(t("archive.batchDeleteSuccess", { count: selectedCount }));
          } catch (_error) {
            feedback.error(t("archive.batchDeleteFailed"));
          } finally {
            setOperating(false);
          }
        })();
      },
    },
    {
      type: "divider",
    },
    {
      key: "merge",
      label: t("archive.merge"),
      icon: <GitMerge size={ICON_SIZE.SMALL} />,
      disabled: selectedCount < 2 || operating,
      onClick: () => {
        void (async () => {
          setOperating(true);
          try {
            await onMergeSessions(Array.from(selectedIds));
          } catch (_error) {
            feedback.error(t("archive.mergeFailed"));
          } finally {
            setOperating(false);
          }
        })();
      },
    },
    {
      key: "export",
      label: t("archive.batchExport"),
      icon: <Download size={ICON_SIZE.SMALL} />,
      disabled: selectedCount === 0 || operating,
      onClick: () => {
        void (async () => {
          setOperating(true);
          try {
            await onExportSessions(Array.from(selectedIds));
            feedback.success(t("archive.batchExportSuccess", { count: selectedCount }));
          } catch (_error) {
            feedback.error(t("archive.batchExportFailed"));
          } finally {
            setOperating(false);
          }
        })();
      },
    },
  ];

  return (
    <Space size={8}>
      {/* 选择模式切换 */}
      {!selectable ? (
        <Tooltip title={t("archive.selectMode")}>
          <Button
            size="small"
            type="text"
            icon={<CheckSquare size={ICON_SIZE.DEFAULT} />}
            onClick={() => onToggleSelectMode(true)}
            disabled={totalCount === 0}
          >
            {t("archive.selectMode")}
          </Button>
        </Tooltip>
      ) : (
        <>
          {/* 选中数量显示 */}
          <Badge
            count={selectedCount}
            showZero={false}
            size="small"
            classNames={{ indicator: "app-archive-batch-menu__badge-indicator" }}
          >
            <span className="app-archive-batch-menu__summary">
              {t("archive.selectedCount", { count: selectedCount })}
            </span>
          </Badge>

          {/* 批量操作下拉菜单 */}
          <Dropdown menu={{ items: menuItems }} placement="bottomRight" disabled={operating}>
            <Button size="small" type="primary" loading={operating} disabled={selectedCount === 0}>
              {t("archive.batchOperations")}
            </Button>
          </Dropdown>

          {/* 取消选择 */}
          <Tooltip title={t("archive.cancelSelect")}>
            <Button
              size="small"
              type="text"
              icon={<X size={ICON_SIZE.DEFAULT} />}
              onClick={() => onToggleSelectMode(false)}
            />
          </Tooltip>
        </>
      )}

      {/* 清空所有会话 */}
      {totalCount > 0 && (
        <Popconfirm
          title={t("archive.clearAllConfirmTitle")}
          description={t("archive.clearAllConfirmDesc", { count: totalCount })}
          onConfirm={() => {
            void onClearAll();
          }}
          okText={t("archive.clearAllConfirmOk")}
          cancelText={t("archive.clearAllConfirmCancel")}
          okButtonProps={{ danger: true }}
        >
          <Tooltip title={t("archive.clearAll")}>
            <Button size="small" type="text" danger icon={<Trash2 size={ICON_SIZE.DEFAULT} />} />
          </Tooltip>
        </Popconfirm>
      )}
    </Space>
  );
}
