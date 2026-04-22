/**
 * SettingsPanel — Side panel for user preferences
 */

import { useState, useRef, useEffect } from 'react';
import { X, Palette, Sliders, Database, Download, Upload, Trash2 } from 'lucide-react';
import { useSettingsStore } from '@/store';
import { useT } from '@/shared/i18n';
import { GradientPicker } from '@/shared/ui';
import { exportSessionsJSON, downloadFile, parseImportJSON } from '@/shared/utils/import-export';
import { getArchivedSessions, saveSessions } from '@/services';
import { getQuotaStatus, formatBytes } from '@/shared/utils/quota';

interface SettingsPanelProps {
  onClose: () => void;
}

interface QuotaInfo {
  usedBytes: number;
  totalBytes: number;
  percentage: number;
  isWarning: boolean;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const [tab, setTab] = useState<'appearance' | 'behavior' | 'data'>('appearance');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [quotaInfo, setQuotaInfo] = useState<QuotaInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useT();

  useEffect(() => {
    getQuotaStatus().then(setQuotaInfo);
  }, []);

  const handleExport = async () => {
    const sessions = await getArchivedSessions();
    const json = exportSessionsJSON(sessions);
    downloadFile(json, `canopy-backup-${new Date().toISOString().slice(0, 10)}.json`);
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
  };

  const handleClearAll = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    await saveSessions([]);
    setConfirmClear(false);
  };

  const tabs = [
    { key: 'appearance' as const, icon: <Palette className="w-4 h-4" />, label: t('settings.appearance') },
    { key: 'behavior' as const, icon: <Sliders className="w-4 h-4" />, label: t('settings.behavior') },
    { key: 'data' as const, icon: <Database className="w-4 h-4" />, label: t('settings.data') },
  ];

  return (
    <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm flex items-start justify-end">
      <div className="w-full max-w-sm h-full bg-surface backdrop-blur-xl border-l border-border overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text">{t('settings.title')}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-hover text-text-muted hover:text-text transition-colors duration-150 cursor-pointer"
            aria-label={t('settings.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-border">
          {tabs.map(({ key, icon, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors duration-150 cursor-pointer
                ${tab === key ? 'text-text border-b-2 border-text' : 'text-text-muted hover:text-text'}`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          {tab === 'appearance' && (
            <>
              <div>
                <label className="text-sm font-medium text-text mb-2 block">{t('settings.language')}</label>
                <select
                  value={settings.language}
                  onChange={(e) => updateSettings({ language: e.target.value as 'zh-CN' | 'en' })}
                  className="w-full px-3 py-2 rounded-[var(--radius-md)] bg-surface border border-border text-text text-sm"
                >
                  <option value="zh-CN">中文</option>
                  <option value="en">English</option>
                </select>
              </div>
              <GradientPicker />
            </>
          )}

          {tab === 'behavior' && (
            <div>
              <label className="text-sm font-medium text-text mb-2 block">{t('settings.defaultView')}</label>
              <select
                value={settings.defaultView}
                onChange={(e) => updateSettings({ defaultView: e.target.value as any })}
                className="w-full px-3 py-2 rounded-[var(--radius-md)] bg-surface border border-border text-text text-sm"
              >
                <option value="domain">{t('view.domain')}</option>
                <option value="timeline">{t('view.timeline')}</option>
                <option value="compact">{t('view.compact')}</option>
                <option value="grid">{t('view.grid')}</option>
                <option value="frequency">{t('view.frequency')}</option>
              </select>
            </div>
          )}

          {tab === 'data' && (
            <>
              {quotaInfo && (
                <div className="px-4 py-3 rounded-[var(--radius-md)] bg-surface border border-border">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-text">{t('settings.storage')}</span>
                    <span className={`text-xs ${quotaInfo.isWarning ? 'text-amber-300' : 'text-text-muted'}`}>
                      {formatBytes(quotaInfo.usedBytes)} / {formatBytes(quotaInfo.totalBytes)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-badge overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${quotaInfo.isWarning ? 'bg-amber-400' : 'bg-text-muted'}`}
                      style={{ width: `${quotaInfo.percentage}%` }}
                    />
                  </div>
                  {quotaInfo.isWarning && (
                    <p className="text-xs text-amber-300 mt-1.5">{t('settings.quotaWarning')}</p>
                  )}
                </div>
              )}

              <button
                onClick={handleExport}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)]
                  bg-surface hover:bg-surface-hover border border-border text-text text-sm
                  transition-colors duration-150 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                {t('settings.export')}
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)]
                  bg-surface hover:bg-surface-hover border border-border text-text text-sm
                  transition-colors duration-150 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                {t('settings.import')}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImport}
              />
              {importStatus && (
                <p className="text-xs text-text-muted">{importStatus}</p>
              )}

              <button
                onClick={handleClearAll}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)]
                  border text-sm transition-colors duration-150 cursor-pointer
                  ${confirmClear
                    ? 'bg-red-500/20 border-red-500/40 text-red-300'
                    : 'bg-surface hover:bg-surface-hover border-border text-text-muted'
                  }`}
              >
                <Trash2 className="w-4 h-4" />
                {confirmClear ? t('settings.confirmClear') : t('settings.clearAll')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
