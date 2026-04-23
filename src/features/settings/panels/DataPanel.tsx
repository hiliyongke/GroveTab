/**
 * DataPanel — 数据管理 Tab
 *
 * 包含：
 *   - 存储配额可视化
 *   - 导出归档 JSON
 *   - 导入归档 JSON
 *   - 清空所有归档
 */

import { useState, useRef, useEffect } from 'react';
import { Button, Space, Progress, Alert, App, theme } from 'antd';
import { DownloadOutlined, UploadOutlined, DeleteOutlined, HddOutlined } from '@ant-design/icons';
import { useT } from '@/shared/i18n';
import { exportSessionsJSON, downloadFile, parseImportJSON } from '@/shared/utils/import-export';
import { getArchivedSessions, saveSessions } from '@/services';
import { getQuotaStatus, formatBytes } from '@/shared/utils/quota';

interface QuotaInfo {
  usedBytes: number;
  totalBytes: number;
  percentage: number;
  isWarning: boolean;
}

export function DataPanel() {
  const { t } = useT();
  const { token } = theme.useToken();
  const { modal, message } = App.useApp();
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [quotaInfo, setQuotaInfo] = useState<QuotaInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getQuotaStatus().then(setQuotaInfo);
  }, []);

  const handleExport = async () => {
    const sessions = await getArchivedSessions();
    const json = exportSessionsJSON(sessions);
    downloadFile(json, `canopy-backup-${new Date().toISOString().slice(0, 10)}.json`);
    message.success(t('settings.export'));
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const { sessions, errors } = parseImportJSON(text);
    if (errors.length > 0) {
      setImportStatus(t('settings.importError', { count: errors.length }));
      return;
    }
    const existing = await getArchivedSessions();
    const existingIds = new Set(existing.map((s) => s.id));
    const newSessions = sessions.filter((s) => !existingIds.has(s.id));
    await saveSessions([...newSessions, ...existing]);
    setImportStatus(t('settings.importSuccess', { count: newSessions.length }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClearAll = () => {
    modal.confirm({
      title: t('settings.clearAll'),
      content: t('settings.confirmClear'),
      okButtonProps: { danger: true },
      okText: t('settings.clearAll'),
      cancelText: t('context.cancel'),
      onOk: async () => {
        await saveSessions([]);
        message.success(t('settings.clearAll'));
      },
    });
  };

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      {quotaInfo && (
        <div
          style={{
            padding: 14,
            borderRadius: token.borderRadiusLG,
            background: token.colorFillQuaternary,
            border: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12.5,
                fontWeight: 500,
              }}
            >
              <HddOutlined style={{ color: token.colorTextTertiary }} />
              {t('settings.storage')}
            </span>
            <span
              style={{
                fontSize: 11.5,
                fontVariantNumeric: 'tabular-nums',
                color: quotaInfo.isWarning ? token.colorError : token.colorTextTertiary,
              }}
            >
              {formatBytes(quotaInfo.usedBytes)} / {formatBytes(quotaInfo.totalBytes)}
            </span>
          </div>
          <Progress
            percent={Math.round(quotaInfo.percentage)}
            size="small"
            status={quotaInfo.isWarning ? 'exception' : 'normal'}
            showInfo={false}
          />
          {quotaInfo.isWarning && (
            <Alert
              type="error"
              message={t('settings.quotaWarning')}
              showIcon
              style={{ marginTop: 10 }}
            />
          )}
        </div>
      )}

      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Button block icon={<DownloadOutlined />} onClick={handleExport}>
          {t('settings.export')}
        </Button>
        <Button block icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()}>
          {t('settings.import')}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleImport}
        />
        {importStatus && (
          <div style={{ fontSize: 11.5, color: token.colorTextTertiary, padding: '0 4px' }}>
            {importStatus}
          </div>
        )}
      </Space>

      <Button block danger icon={<DeleteOutlined />} onClick={handleClearAll}>
        {t('settings.clearAll')}
      </Button>
    </Space>
  );
}
