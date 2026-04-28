/**
 * DataPanel — 数据管理 Tab
 *
 * 包含：
 *   - 配置预设（保存/加载/切换/删除）
 *   - 存储配额可视化
 *   - 导出归档 JSON
 *   - 导入归档 JSON
 *   - 清空所有归档
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Space, Progress, Alert, App, theme, Input, Popconfirm, Empty, Divider } from 'antd';
import {
  Download,
  Upload,
  Trash2,
  HardDrive,
  Save,
  ArrowLeftRight,
  Pencil,
  RotateCcw,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useT } from '@/shared/i18n';
import { useSettingsStore } from '@/store';
import { exportSessionsJSON, downloadFile, parseImportJSON } from '@/shared/utils/import-export';
import { getArchivedSessions, saveSessions } from '@/services';
import { getQuotaStatus, formatBytes } from '@/shared/utils/quota';
import {
  getProfiles,
  createProfile,
  renameProfile,
  deleteProfile,
  type SettingsProfile,
} from '@/shared/utils/profiles';
import { Field } from '../components/Field';
import { getAllDataKeys, removeData } from '@/repositories/storage-repo';

interface QuotaInfo {
  usedBytes: number;
  totalBytes: number;
  percentage: number;
  isWarning: boolean;
}

const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024;

export function DataPanel() {
  const { t } = useT();
  const { token } = theme.useToken();
  const { modal, message } = App.useApp();
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const resetSettings = useSettingsStore((s) => s.resetSettings);

  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [quotaInfo, setQuotaInfo] = useState<QuotaInfo | null>(null);
  const [profiles, setProfiles] = useState<SettingsProfile[]>([]);
  const [profileName, setProfileName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void getQuotaStatus().then(setQuotaInfo);
    void getProfiles().then(setProfiles);
  }, []);

  /** 创建新预设 */
  const handleCreateProfile = useCallback(async () => {
    if (!profileName.trim()) return;
    await createProfile(profileName.trim(), settings);
    setProfileName('');
    const updated = await getProfiles();
    setProfiles(updated);
    message.success(t('settings.profileCreated'));
  }, [profileName, settings, message, t]);

  /** 应用预设 */
  const handleApplyProfile = useCallback((profile: SettingsProfile) => {
    void updateSettings(profile.settings);
    message.success(t('settings.profileApplied', { name: profile.name }));
  }, [updateSettings, message, t]);

  /** 删除预设 */
  const handleDeleteProfile = useCallback(async (id: string) => {
    await deleteProfile(id);
    const updated = await getProfiles();
    setProfiles(updated);
    message.success(t('settings.profileDeleted'));
  }, [message, t]);

  /** 重命名预设 */
  const handleRenameProfile = useCallback(async (id: string) => {
    if (!editingName.trim()) return;
    await renameProfile(id, editingName.trim());
    setEditingId(null);
    setEditingName('');
    const updated = await getProfiles();
    setProfiles(updated);
    message.success(t('settings.profileRenamed'));
  }, [editingName, message, t]);

  const handleExport = async () => {
    const sessions = await getArchivedSessions();
    const sessionPayload = exportSessionsJSON(sessions);
    const parsedSessions = JSON.parse(sessionPayload) as unknown;
    const bundle = {
      version: 2,
      exportedAt: new Date().toISOString(),
      sessions: parsedSessions,
      settings,
    };
    downloadFile(JSON.stringify(bundle, null, 2), `canopy-backup-${new Date().toISOString().slice(0, 10)}.json`);
    message.success(t('settings.exportDone'));
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file == null) return;

    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setImportStatus(t('settings.importTooLarge', { size: '2 MB' }));
      if (fileInputRef.current !== null) fileInputRef.current.value = '';
      return;
    }

    const text = await file.text();
    let importText = text;
    try {
      const parsed = JSON.parse(text) as { sessions?: unknown; settings?: typeof settings };
      if (parsed && Array.isArray(parsed.sessions)) {
        importText = JSON.stringify(parsed.sessions);
      }
      if (parsed?.settings) {
        await updateSettings(parsed.settings);
      }
    } catch {
      // 兼容旧版仅 sessions JSON
    }

    const { sessions, errors } = parseImportJSON(importText);
    if (errors.length > 0) {
      setImportStatus(t('settings.importError', { count: errors.length }));
      if (fileInputRef.current !== null) fileInputRef.current.value = '';
      return;
    }
    const existing = await getArchivedSessions();
    const existingIds = new Set(existing.map((s) => s.id));
    const newSessions = sessions.filter((s) => !existingIds.has(s.id));
    await saveSessions([...newSessions, ...existing]);
    setImportStatus(t('settings.importDone', { count: newSessions.length }));
    if (fileInputRef.current !== null) fileInputRef.current.value = '';
  };

  const handleClearAll = () => {
    modal.confirm({
      title: t('settings.clearAll'),
      content: t('settings.confirmClear'),
      okButtonProps: { danger: true },
      okText: t('settings.clearAll'),
      cancelText: t('context.cancel'),
      onOk: async () => {
        try {
          await saveSessions([]);
          message.success(t('settings.clearAll'));
        } catch (err) {
          console.error('[DataPanel] clearAll failed:', err);
        }
      },
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
      {/* ── 配置预设 ── */}
      <Field label={t('settings.profiles')} hint={t('settings.profilesHint')}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Input
            size="small"
            placeholder={t('settings.profileNamePlaceholder')}
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            onPressEnter={() => { void handleCreateProfile(); }}
            style={{ flex: 1 }}
          />
          <Button
            size="small"
            type="primary"
icon={<Save size={ICON_SIZE.MEDIUM} />}
            disabled={!profileName.trim()}
            onClick={() => { void handleCreateProfile(); }}
          >
            {t('settings.profileSave')}
          </Button>
        </div>
        {profiles.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('settings.noProfiles')}
            style={{ margin: '8px 0' }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {profiles.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: token.borderRadiusLG,
                  background: token.colorFillQuaternary,
                  border: `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                {editingId === p.id ? (
                  <Input
                    size="small"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onPressEnter={() => { void handleRenameProfile(p.id); }}
                    onBlur={() => { void handleRenameProfile(p.id); }}
                    style={{ flex: 1, marginRight: 8 }}
                    autoFocus
                  />
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{p.name}</span>
                )}
                <Space size={4}>
                  <Button
                    type="text"
                    size="small"
icon={<ArrowLeftRight size={ICON_SIZE.MEDIUM} />}
                    title={t('settings.profileApply')}
                    onClick={() => { void handleApplyProfile(p); }}
                  />
                  <Button
                    type="text"
                    size="small"
icon={<Pencil size={ICON_SIZE.MEDIUM} />}
                    title={t('settings.profileRename')}
                    onClick={() => { setEditingId(p.id); setEditingName(p.name); }}
                  />
                  <Popconfirm
                    title={t('settings.profileDeleteConfirm')}
                    onConfirm={() => { void handleDeleteProfile(p.id); }}
                    okText={t('settings.profileDelete')}
                    cancelText={t('context.cancel')}
                    okButtonProps={{ danger: true }}
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
icon={<Trash2 size={ICON_SIZE.MEDIUM} />}
                      title={t('settings.profileDelete')}
                    />
                  </Popconfirm>
                </Space>
              </div>
            ))}
          </div>
        )}
      </Field>

      {/* ── 存储配额 ── */}
      {quotaInfo !== null && (
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
<HardDrive size={ICON_SIZE.MEDIUM} style={{ color: token.colorInfo }} />
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
              showIcon
              description={t('settings.quotaWarning')}
              style={{ marginTop: 10 }}
            />
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
<Button block icon={<Download size={ICON_SIZE.MEDIUM} />} onClick={() => { void handleExport(); }}>
          {t('settings.export')}
        </Button>
<Button block icon={<Upload size={ICON_SIZE.MEDIUM} />} onClick={() => fileInputRef.current?.click()}>
          {t('settings.import')}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={(e) => { void handleImport(e); }}
        />
        {importStatus !== null && (
          <div style={{ fontSize: 11.5, color: token.colorTextTertiary, padding: '0 4px' }}>
            {importStatus}
          </div>
        )}
      </div>

<Button block danger icon={<Trash2 size={ICON_SIZE.MEDIUM} />} onClick={handleClearAll}>
        {t('settings.clearAll')}
      </Button>

      {/* ═════════════════════════════════════════════════════
          危险区：一键重置三件套（v1.1）
          ═════════════════════════════════════════════════════ */}
      <Divider style={{ fontSize: 12, color: token.colorTextTertiary, margin: '8px 0' }}>
        {t('settings.dangerZone')}
      </Divider>

      {/* 1）恢复默认配置：仅清空设置键，保留所有数据（归档/书签/历史不变） */}
      <Popconfirm
        title={t('settings.resetSettingsConfirm')}
        description={t('settings.resetSettingsDesc')}
        onConfirm={async () => {
          try {
            await resetSettings();
            message.success(t('settings.resetSettingsDone'));
          } catch (err) {
            console.error('[DataPanel] resetSettings failed:', err);
            message.error(t('settings.resetSettingsFailed'));
          }
        }}
      >
<Button block icon={<RotateCcw size={ICON_SIZE.MEDIUM} />}>
          {t('settings.resetSettings')}
        </Button>
      </Popconfirm>

      {/* 2）重播 Onboarding：仅重置 canopy_onboarding_done，下次刷新重新弹欢迎屏 */}
      <Popconfirm
        title={t('settings.replayOnboardingConfirm')}
        onConfirm={async () => {
          try {
            await removeData('canopy_onboarding_done');
            message.success(t('settings.replayOnboardingDone'));
          } catch (err) {
            console.error('[DataPanel] replayOnboarding failed:', err);
          }
        }}
      >
<Button block icon={<Sparkles size={ICON_SIZE.MEDIUM} />}>
          {t('settings.replayOnboarding')}
        </Button>
      </Popconfirm>

      {/*
        3）全量重置为初始状态：清掉所有 canopy_* 键——等同卸载重装。
        高风险操作，走 Modal 双层确认（输入 RESET 文本二次确认）。
      */}
      <Button
        block
        danger
icon={<AlertTriangle size={ICON_SIZE.MEDIUM} />}
        onClick={() => {
          let confirmText = '';
          modal.confirm({
            title: t('settings.factoryResetTitle'),
            content: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Alert
                  type="error"
                  showIcon
                  message={t('settings.factoryResetWarning')}
                />
                <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
                  {t('settings.factoryResetTypeHint')}
                </div>
                <Input
                  placeholder="RESET"
                  onChange={(e) => {
                    confirmText = e.target.value;
                  }}
                />
              </div>
            ),
            okText: t('settings.factoryResetConfirm'),
            okButtonProps: { danger: true },
            cancelText: t('settings.cancel'),
            onOk: async () => {
              if (confirmText.trim().toUpperCase() !== 'RESET') {
                message.error(t('settings.factoryResetMustType'));
                return Promise.reject(new Error('must type RESET'));
              }
              try {
                /** 清空所有 canopy_* 键 */
                const keys = await getAllDataKeys();
                for (const key of keys) {
                  if (key.startsWith('canopy_')) {
                    await removeData(key);
                  }
                }
                /** 重置 store 内存状态 */
                await resetSettings();
                message.success(t('settings.factoryResetDone'));
                setTimeout(() => window.location.reload(), 400);
              } catch (err) {
                console.error('[DataPanel] factoryReset failed:', err);
                message.error(t('settings.factoryResetMustType'));
                return Promise.reject(err);
              }
              return undefined;
            },
          });
        }}
      >
        {t('settings.factoryReset')}
      </Button>
    </div>
  );
}
