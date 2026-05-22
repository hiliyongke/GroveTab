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
import { Button, Space, Progress, Alert, App, Input, Popconfirm, Empty, Divider } from 'antd';
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
import { Field } from '@/features/settings/components/Field';
import { getAllDataKeys, removeData } from '@/repositories/storage-repo';
import { APP_RESOURCE_NAMES, STORAGE_KEYS, isAppStorageKey } from '@/shared/config/storage-keys';
import type { SettingsProfile } from '@/shared/utils/profiles';
import { getProfiles, createProfile, renameProfile, deleteProfile } from '@/shared/utils/profiles';
import './styles/data.css';

interface QuotaInfo {
  usedBytes: number;
  totalBytes: number;
  percentage: number;
  isWarning: boolean;
}

const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024;

export function DataPanel() {
  const { t } = useT();
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

  const handleCreateProfile = useCallback(async () => {
    if (!profileName.trim()) return;
    await createProfile(profileName.trim(), settings);
    setProfileName('');
    const updated = await getProfiles();
    setProfiles(updated);
    message.success(t('settings.profileCreated'));
  }, [profileName, settings, message, t]);

  const handleApplyProfile = useCallback((profile: SettingsProfile) => {
    void updateSettings(profile.settings);
    message.success(t('settings.profileApplied', { name: profile.name }));
  }, [updateSettings, message, t]);

  const handleDeleteProfile = useCallback(async (id: string) => {
    await deleteProfile(id);
    const updated = await getProfiles();
    setProfiles(updated);
    message.success(t('settings.profileDeleted'));
  }, [message, t]);

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
    downloadFile(
      JSON.stringify(bundle, null, 2),
      `${APP_RESOURCE_NAMES.backupFilePrefix}-${new Date().toISOString().slice(0, 10)}.json`,
    );
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
    const existingIds = new Set(existing.map((session) => session.id));
    const newSessions = sessions.filter((session) => !existingIds.has(session.id));
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
    <div className="data-panel settings-panel-stack">
      <section className="settings-section">
        <Field label={t('settings.profiles')} hint={t('settings.profilesHint')}>
        <div className="data-panel__profile-create">
          <Input
            size="small"
            placeholder={t('settings.profileNamePlaceholder')}
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            onPressEnter={() => { void handleCreateProfile(); }}
            className="data-panel__profile-input"
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
            className="data-panel__empty"
          />
        ) : (
          <div className="data-panel__profile-list">
            {profiles.map((profile) => (
              <div key={profile.id} className="data-panel__profile-card">
                {editingId === profile.id ? (
                  <Input
                    size="small"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onPressEnter={() => { void handleRenameProfile(profile.id); }}
                    onBlur={() => { void handleRenameProfile(profile.id); }}
                    className="data-panel__profile-edit-input"
                    autoFocus
                  />
                ) : (
                  <span className="data-panel__profile-name">{profile.name}</span>
                )}
                <Space size={4}>
                  <Button
                    type="text"
                    size="small"
                    icon={<ArrowLeftRight size={ICON_SIZE.MEDIUM} />}
                    title={t('settings.profileApply')}
                    onClick={() => { void handleApplyProfile(profile); }}
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<Pencil size={ICON_SIZE.MEDIUM} />}
                    title={t('settings.profileRename')}
                    onClick={() => { setEditingId(profile.id); setEditingName(profile.name); }}
                  />
                  <Popconfirm
                    title={t('settings.profileDeleteConfirm')}
                    onConfirm={() => { void handleDeleteProfile(profile.id); }}
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
      </section>

      {quotaInfo !== null && (
        <section className="settings-section">
          <div className="data-panel__quota">
          <div className="data-panel__quota-header">
            <span className="data-panel__quota-label">
              <HardDrive size={ICON_SIZE.MEDIUM} className="data-panel__quota-icon" />
              {t('settings.storage')}
            </span>
            <span className={`data-panel__quota-meta${quotaInfo.isWarning ? ' is-warning' : ''}`}>
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
              className="data-panel__quota-alert"
            />
          )}
        </div>
        </section>
      )}

      <section className="settings-section">
        <div className="data-panel__actions">
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
          className="data-panel__file-input"
          onChange={(e) => { void handleImport(e); }}
        />
        {importStatus !== null && (
          <div className="data-panel__import-status">{importStatus}</div>
        )}
      </div>
      </section>

      <section className="settings-section">
        <Button block danger icon={<Trash2 size={ICON_SIZE.MEDIUM} />} onClick={handleClearAll}>
        {t('settings.clearAll')}
      </Button>

      <Divider className="data-panel__divider">{t('settings.dangerZone')}</Divider>

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

      <Popconfirm
        title={t('settings.replayOnboardingConfirm')}
        onConfirm={async () => {
          try {
            await removeData(STORAGE_KEYS.onboardingDone);
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

      <Button
        block
        danger
        icon={<AlertTriangle size={ICON_SIZE.MEDIUM} />}
        onClick={() => {
          let confirmText = '';
          modal.confirm({
            title: t('settings.factoryResetTitle'),
            content: (
              <div className="data-panel__factory-confirm">
                <Alert
                  type="error"
                  showIcon
                  message={t('settings.factoryResetWarning')}
                />
                <div className="data-panel__factory-copy">{t('settings.factoryResetTypeHint')}</div>
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
                const keys = await getAllDataKeys();
                for (const key of keys) {
                  if (isAppStorageKey(key)) {
                    await removeData(key);
                  }
                }
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
      </section>
    </div>
  );
}
