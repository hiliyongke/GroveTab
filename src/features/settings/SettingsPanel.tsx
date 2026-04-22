/**
 * SettingsPanel — 右侧抽屉式设置面板（antd 版）
 *
 * 升级点：
 *   - 使用 antd Drawer（右侧抽屉）
 *   - Tabs 分段 / Select / Segmented / Progress 全部走 antd 原生
 *   - 渐变背景预设用 Radio.Group 平铺色卡
 */

import { useState, useRef, useEffect } from 'react';
import {
  Drawer,
  Tabs,
  Select,
  Segmented,
  Button,
  Progress,
  Alert,
  Space,
  Radio,
  Switch,
  theme,
  App,
} from 'antd';
import {
  BgColorsOutlined,
  ControlOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  UploadOutlined,
  DeleteOutlined,
  HddOutlined,
} from '@ant-design/icons';
import { useSettingsStore } from '@/store';
import { useT } from '@/shared/i18n';
import {
  exportSessionsJSON,
  downloadFile,
  parseImportJSON,
} from '@/shared/utils/import-export';
import { getArchivedSessions, saveSessions } from '@/services';
import { getQuotaStatus, formatBytes } from '@/shared/utils/quota';

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface QuotaInfo {
  usedBytes: number;
  totalBytes: number;
  percentage: number;
  isWarning: boolean;
}

/** 背景预设（用户可在 appearance Tab 中选择） */
const GRADIENT_PRESETS: { id: 'aurora' | 'sunrise' | 'deepspace'; label: string; colors: string[] }[] =
  [
    { id: 'aurora', label: 'Slate', colors: ['#f1f5f9', '#e2e8f0', '#cbd5e1'] },
    { id: 'sunrise', label: 'Stone', colors: ['#fafaf9', '#e7e5e4', '#d6d3d1'] },
    { id: 'deepspace', label: 'Deep Space', colors: ['#0F2027', '#203A43', '#2C5364'] },
  ];

/**
 * 设置面板
 */
export function SettingsPanel({ open, onOpenChange }: SettingsPanelProps) {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [quotaInfo, setQuotaInfo] = useState<QuotaInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useT();
  const { token } = theme.useToken();
  const { modal, message } = App.useApp();

  useEffect(() => {
    if (open) getQuotaStatus().then(setQuotaInfo);
  }, [open]);

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
    // 清空 input，确保同名文件可再次触发 change
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

  /** Tab 1：外观 */
  const appearancePanel = (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Field label={t('settings.language')}>
        <Select
          value={settings.language}
          onChange={(v) => updateSettings({ language: v as 'zh-CN' | 'en' })}
          style={{ width: '100%' }}
          options={[
            { value: 'zh-CN', label: '中文' },
            { value: 'en', label: 'English' },
          ]}
        />
      </Field>

      <Field label={t('gradient.title')}>
        <Radio.Group
          value={settings.gradientPreset}
          onChange={(e) =>
            updateSettings({
              gradientPreset: e.target.value as 'aurora' | 'sunrise' | 'deepspace' | 'custom',
            })
          }
          style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}
        >
          {GRADIENT_PRESETS.map((preset) => (
            <Radio.Button
              key={preset.id}
              value={preset.id}
              style={{
                width: 64,
                height: 64,
                padding: 0,
                borderRadius: token.borderRadiusLG,
                overflow: 'hidden',
                background: `linear-gradient(135deg, ${preset.colors.join(', ')})`,
              }}
              title={preset.label}
            />
          ))}
        </Radio.Group>
      </Field>
    </Space>
  );

  /** Tab 2：行为 */
  const behaviorPanel = (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Field label={t('settings.defaultView')}>
        <Select
          value={settings.defaultView}
          onChange={(v) =>
            updateSettings({
              defaultView: v as 'domain' | 'timeline' | 'compact' | 'grid' | 'frequency',
            })
          }
          style={{ width: '100%' }}
          options={[
            { value: 'domain', label: t('view.domain') },
            { value: 'timeline', label: t('view.timeline') },
            { value: 'compact', label: t('view.compact') },
            { value: 'grid', label: t('view.grid') },
            { value: 'frequency', label: t('view.frequency') },
          ]}
        />
      </Field>

      <Field
        label={t('settings.domainGroupColumns')}
        hint={t('settings.domainGroupColumnsHint')}
      >
        <Segmented
          block
          value={String(settings.domainGroupColumns ?? 'auto')}
          onChange={(v) =>
            updateSettings({
              domainGroupColumns:
                v === 'auto' ? 'auto' : (Number(v) as 1 | 2 | 3 | 4 | 5 | 6),
            })
          }
          options={[
            { value: 'auto', label: t('settings.columnsAuto') },
            { value: '2', label: '2' },
            { value: '3', label: '3' },
            { value: '4', label: '4' },
            { value: '5', label: '5' },
          ]}
        />
      </Field>

      <Field
        label={t('settings.domainGroupShowItemFavicon')}
        hint={t('settings.domainGroupShowItemFaviconHint')}
      >
        <Switch
          checked={settings.domainGroupShowItemFavicon ?? true}
          onChange={(v) => updateSettings({ domainGroupShowItemFavicon: v })}
        />
      </Field>

      <Field
        label={t('settings.domainGroupAccentBarPosition')}
        hint={t('settings.domainGroupAccentBarPositionHint')}
      >
        <Segmented
          block
          value={settings.domainGroupAccentBarPosition ?? 'left'}
          onChange={(v) =>
            updateSettings({
              domainGroupAccentBarPosition: v as 'left' | 'top' | 'none',
            })
          }
          options={[
            { value: 'left', label: t('settings.accentBarLeft') },
            { value: 'top', label: t('settings.accentBarTop') },
            { value: 'none', label: t('settings.accentBarNone') },
          ]}
        />
      </Field>

      <Field
        label={t('settings.domainGroupCardRadius')}
        hint={t('settings.domainGroupCardRadiusHint')}
      >
        <Segmented
          block
          value={settings.domainGroupCardRadius ?? 'default'}
          onChange={(v) =>
            updateSettings({
              domainGroupCardRadius: v as 'none' | 'small' | 'default' | 'large',
            })
          }
          options={[
            { value: 'none', label: t('settings.cardRadiusNone') },
            { value: 'small', label: t('settings.cardRadiusSmall') },
            { value: 'default', label: t('settings.cardRadiusDefault') },
            { value: 'large', label: t('settings.cardRadiusLarge') },
          ]}
        />
      </Field>

      <Field
        label={t('settings.timelineGranularity')}
        hint={t('settings.timelineGranularityHint')}
      >
        <Segmented
          block
          // 旧配置里可能残留已废弃的 'fine'，视作 'hour' 显示，避免 Segmented 出现空态
          value={
            (settings.timelineGranularity ?? 'day') === 'fine'
              ? 'hour'
              : settings.timelineGranularity ?? 'day'
          }
          onChange={(v) =>
            updateSettings({
              timelineGranularity: v as 'day' | 'hour',
            })
          }
          options={[
            { value: 'day', label: t('settings.granularityDay') },
            { value: 'hour', label: t('settings.granularityHour') },
          ]}
        />
      </Field>

      <Field
        label={t('settings.timelineShowExactTime')}
        hint={t('settings.timelineShowExactTimeHint')}
      >
        <Switch
          checked={settings.timelineShowExactTime ?? false}
          onChange={(v) => updateSettings({ timelineShowExactTime: v })}
        />
      </Field>
    </Space>
  );

  /** Tab 3：数据 */
  const dataPanel = (
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

  return (
    <Drawer
      open={open}
      onClose={() => onOpenChange(false)}
      title={t('settings.title')}
      placement="right"
      width={420}
      destroyOnHidden
    >
      <Tabs
        defaultActiveKey="appearance"
        items={[
          {
            key: 'appearance',
            label: (
              <span>
                <BgColorsOutlined /> {t('settings.appearance')}
              </span>
            ),
            children: appearancePanel,
          },
          {
            key: 'behavior',
            label: (
              <span>
                <ControlOutlined /> {t('settings.behavior')}
              </span>
            ),
            children: behaviorPanel,
          },
          {
            key: 'data',
            label: (
              <span>
                <DatabaseOutlined /> {t('settings.data')}
              </span>
            ),
            children: dataPanel,
          },
        ]}
      />
    </Drawer>
  );
}

/**
 * 表单字段包装 —— label + control + 可选 hint
 */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const { token } = theme.useToken();
  return (
    <div>
      <label
        style={{
          display: 'block',
          marginBottom: 8,
          fontSize: 12,
          fontWeight: 500,
          color: token.colorTextTertiary,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 11.5,
            color: token.colorTextTertiary,
            lineHeight: 1.5,
          }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
