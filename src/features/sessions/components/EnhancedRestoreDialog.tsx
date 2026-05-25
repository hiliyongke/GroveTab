/**
 * EnhancedRestoreDialog — 增强的一键恢复对话框
 *
 * 设计目标：
 * - 提供恢复策略选择（新窗口/当前窗口）
 * - 显示恢复进度和状态
 * - 支持取消恢复操作
 * - 提供更好的视觉反馈
 */

import { useState, useEffect } from "react";
import { Modal, Button, Progress, Radio, Space, Alert } from "antd";
import { Play, X, CheckCircle, AlertCircle } from "lucide-react";
import type { RestoreStrategy, RestoreOutcome } from "@/services/archive";
import { restoreSession } from "@/services/archive";
import { useT } from "@/shared/i18n";
import { ICON_SIZE } from "@/shared/utils/icon-size";

interface EnhancedRestoreDialogProps {
  open: boolean;
  sessionId: string;
  sessionName: string;
  tabCount: number;
  onClose: () => void;
  onRestoreComplete?: (outcome: RestoreOutcome) => void;
}

export function EnhancedRestoreDialog({
  open,
  sessionId,
  sessionName,
  tabCount,
  onClose,
  onRestoreComplete,
}: EnhancedRestoreDialogProps) {
  const { t } = useT();
  const [restoreStrategy, setRestoreStrategy] = useState<RestoreStrategy>("new_window");
  const [isRestoring, setIsRestoring] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [outcome, setOutcome] = useState<RestoreOutcome | null>(null);
  const [shouldCancel, setShouldCancel] = useState(false);

  useEffect(() => {
    if (open) {
      // 重置状态
      setIsRestoring(false);
      setProgress(0);
      setTotal(0);
      setOutcome(null);
      setShouldCancel(false);
      setRestoreStrategy("new_window");
    }
  }, [open]);

  const handleRestore = async () => {
    setIsRestoring(true);
    setProgress(0);
    setTotal(tabCount);
    setOutcome(null);
    setShouldCancel(false);

    try {
      const result = await restoreSession(sessionId, {
        strategy: restoreStrategy,
        onProgress: (done, total) => {
          setProgress(done);
          setTotal(total);
        },
        shouldCancel: () => shouldCancel,
        batchSize: 5, // 较小的批次大小，提供更流畅的进度反馈
        batchInterval: 200, // 稍长的间隔，让用户能看到进度变化
      });

      setOutcome(result);
      onRestoreComplete?.(result);
    } catch (error) {
      console.error("Restore failed:", error);
      setOutcome({
        restored: progress,
        batches: Math.ceil(progress / 5),
        cancelled: false,
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleCancelRestore = () => {
    setShouldCancel(true);
  };

  const handleClose = () => {
    if (isRestoring) {
      handleCancelRestore();
    }
    onClose();
  };

  const getStatusMessage = () => {
    if (!isRestoring && !outcome) {
      return t("准备恢复 {count} 个标签页");
    }

    if (isRestoring) {
      return t("正在恢复…", { current: progress, total });
    }

    if (outcome) {
      if (outcome.cancelled) {
        return t("已取消恢复，成功恢复 {restored} 个标签", { restored: outcome.restored });
      }
      if (outcome.restored === total) {
        return t("恢复完成", { count: outcome.restored });
      }
      return t("部分恢复成功，已恢复 {restored}/{total} 个标签", {
        restored: outcome.restored,
        total,
      });
    }

    return "";
  };

  const getStatusType = () => {
    if (isRestoring) return "info";
    if (outcome?.cancelled) return "warning";
    if (outcome?.restored === total) return "success";
    if (outcome && outcome.restored < total) return "warning";
    return "info";
  };

  return (
    <Modal
      open={open}
      rootClassName="app-archive-dialog app-archive-restore-dialog"
      title={t("恢复会话")}
      onCancel={handleClose}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          {isRestoring ? t("取消恢复") : t("关闭归档面板")}
        </Button>,
        !isRestoring && !outcome && (
          <Button
            key="restore"
            type="primary"
            icon={<Play size={ICON_SIZE.MEDIUM} />}
            onClick={() => {
              void handleRestore();
            }}
          >
            {t("开始恢复")}
          </Button>
        ),
        isRestoring && (
          <Button
            key="stop"
            danger
            icon={<X size={ICON_SIZE.MEDIUM} />}
            onClick={handleCancelRestore}
          >
            {t("停止")}
          </Button>
        ),
        outcome && !outcome.cancelled && outcome.restored > 0 && (
          <Button
            key="ok"
            type="primary"
            icon={<CheckCircle size={ICON_SIZE.MEDIUM} />}
            onClick={handleClose}
          >
            {t("完成")}
          </Button>
        ),
      ].filter(Boolean)}
      width={500}
      centered
    >
      <Space direction="vertical" size="middle" className="app-archive-dialog__stack">
        {/* 会话信息 */}
        <div className="app-archive-dialog__session-summary">
          <div className="app-archive-dialog__current-name">{sessionName}</div>
          <div className="app-archive-dialog__label">
            {t("{count} 个标签页", { count: tabCount })}
          </div>
        </div>

        {/* 恢复策略选择 */}
        {!isRestoring && !outcome && (
          <div className="app-archive-dialog__section">
            <div className="app-archive-dialog__strategy-label">{t("恢复策略")}</div>
            <Radio.Group
              value={restoreStrategy}
              onChange={(e) => setRestoreStrategy(e.target.value as RestoreStrategy)}
            >
              <Space direction="vertical">
                <Radio value="new_window">{t("新窗口")}</Radio>
                <Radio value="current_window">{t("当前窗口")}</Radio>
              </Space>
            </Radio.Group>
          </div>
        )}

        {/* 进度显示 */}
        {(isRestoring || outcome) && (
          <div>
            <Progress
              percent={total > 0 ? Math.round((progress / total) * 100) : 0}
              status={
                isRestoring
                  ? "active"
                  : outcome?.cancelled
                    ? "exception"
                    : outcome?.restored === total
                      ? "success"
                      : "normal"
              }
            />
          </div>
        )}

        {/* 状态信息 */}
        <Alert
          message={getStatusMessage()}
          type={getStatusType()}
          showIcon
          icon={
            isRestoring ? (
              <Play size={ICON_SIZE.SMALL} />
            ) : outcome?.cancelled ? (
              <X size={ICON_SIZE.SMALL} />
            ) : outcome?.restored === total ? (
              <CheckCircle size={ICON_SIZE.SMALL} />
            ) : (
              <AlertCircle size={ICON_SIZE.SMALL} />
            )
          }
        />

        {/* 策略说明 */}
        {!isRestoring && !outcome && (
          <div className="app-archive-dialog__strategy-copy">
            {restoreStrategy === "new_window"
              ? t("在新的浏览器窗口中打开所有标签页")
              : t("在当前窗口中打开所有标签页")}
          </div>
        )}
      </Space>
    </Modal>
  );
}
