/**
 * EnhancedRestoreDialog — 增强的一键恢复对话框
 * 
 * 设计目标：
 * - 提供恢复策略选择（新窗口/当前窗口）
 * - 显示恢复进度和状态
 * - 支持取消恢复操作
 * - 提供更好的视觉反馈
 */

import { useState, useEffect } from 'react';
import { Modal, Button, Progress, Radio, Space, Typography, Alert } from 'antd';
import { Play, X, CheckCircle, AlertCircle } from 'lucide-react';
import type { RestoreStrategy, RestoreOutcome } from '@/services/archive-service';
import { restoreSession } from '@/services/archive-service';
import { useT } from '@/shared/i18n';
import { ICON_SIZE } from '@/shared/utils/icon-size';

const { Text } = Typography;

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
  const [restoreStrategy, setRestoreStrategy] = useState<RestoreStrategy>('new_window');
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
      setRestoreStrategy('new_window');
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
      console.error('Restore failed:', error);
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
      return t('archive.restoreReady');
    }
    
    if (isRestoring) {
      return t('archive.restoreInProgress', { current: progress, total });
    }
    
    if (outcome) {
      if (outcome.cancelled) {
        return t('archive.restoreCancelled', { restored: outcome.restored });
      }
      if (outcome.restored === total) {
        return t('archive.restoreCompleted', { count: outcome.restored });
      }
      return t('archive.restorePartial', { restored: outcome.restored, total });
    }
    
    return '';
  };

  const getStatusType = () => {
    if (isRestoring) return 'info';
    if (outcome?.cancelled) return 'warning';
    if (outcome?.restored === total) return 'success';
    if (outcome && outcome.restored < total) return 'warning';
    return 'info';
  };

  return (
    <Modal
      open={open}
      title={t('archive.restoreTitle')}
      onCancel={handleClose}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          {isRestoring ? t('archive.cancelRestore') : t('archive.close')}
        </Button>,
        !isRestoring && !outcome && (
          <Button
            key="restore"
            type="primary"
            icon={<Play size={ICON_SIZE.MEDIUM} />}
            onClick={handleRestore}
          >
            {t('archive.startRestore')}
          </Button>
        ),
        isRestoring && (
          <Button
            key="stop"
            danger
            icon={<X size={ICON_SIZE.MEDIUM} />}
            onClick={handleCancelRestore}
          >
            {t('archive.stopRestore')}
          </Button>
        ),
        outcome && !outcome.cancelled && outcome.restored > 0 && (
          <Button
            key="ok"
            type="primary"
            icon={<CheckCircle size={ICON_SIZE.MEDIUM} />}
            onClick={handleClose}
          >
            {t('archive.done')}
          </Button>
        ),
      ].filter(Boolean)}
      width={500}
      centered
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* 会话信息 */}
        <div>
          <Text strong>{sessionName}</Text>
          <br />
          <Text type="secondary">
            {t('archive.tabCount', { count: tabCount })}
          </Text>
        </div>

        {/* 恢复策略选择 */}
        {!isRestoring && !outcome && (
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              {t('archive.restoreStrategy')}
            </Text>
            <Radio.Group
              value={restoreStrategy}
              onChange={(e) => setRestoreStrategy(e.target.value)}
            >
              <Space direction="vertical">
                <Radio value="new_window">
                  {t('archive.strategyNewWindow')}
                </Radio>
                <Radio value="current_window">
                  {t('archive.strategyCurrentWindow')}
                </Radio>
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
                isRestoring ? 'active' : 
                outcome?.cancelled ? 'exception' : 
                outcome?.restored === total ? 'success' : 'normal'
              }
              strokeColor={
                outcome?.cancelled ? '#ff4d4f' : 
                outcome?.restored === total ? '#52c41a' : '#1890ff'
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
            isRestoring ? <Play size={ICON_SIZE.SMALL} /> :
            outcome?.cancelled ? <X size={ICON_SIZE.SMALL} /> :
            outcome?.restored === total ? <CheckCircle size={ICON_SIZE.SMALL} /> :
            <AlertCircle size={ICON_SIZE.SMALL} />
          }
        />

        {/* 策略说明 */}
        {!isRestoring && !outcome && (
          <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>
            {restoreStrategy === 'new_window' 
              ? t('archive.strategyNewWindowDesc')
              : t('archive.strategyCurrentWindowDesc')
            }
          </Text>
        )}
      </Space>
    </Modal>
  );
}