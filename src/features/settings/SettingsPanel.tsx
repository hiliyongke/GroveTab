/**
 * SettingsPanel — 右侧抽屉式设置面板（antd 版）
 *
 * 升级点：
 *   - 使用 antd Drawer（右侧抽屉）
 *   - Tabs 分段 / Select / Segmented / Progress 全部走 antd 原生
 *   - 渐变背景预设用 Radio.Group 平铺色卡
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Drawer,
  Tabs,
  Select,
  Segmented,
  Button,
  Progress,
  Alert,
  Space,
  Switch,
  Slider,
  ColorPicker,
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
  KeyOutlined,
  SunOutlined,
  MoonOutlined,
  EditOutlined,
  PlusOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import { useSettingsStore } from '@/store';
import { useT } from '@/shared/i18n';
import { useResolvedTheme } from '@/shared/hooks';
import { GRADIENT_PRESETS, buildGradient } from '@/shared/theme/gradient-presets';
import type { UserSettings } from '@/shared/types';
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

/** 背景预设的数据源已迁移到 @/shared/theme/gradient-presets.ts，此处仅消费 */

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

  /** 当前 resolved 主题（非 setting 里的 theme），用于色卡预览和角标 */
  const isDark = useResolvedTheme() === 'dark';

  /** 自定义渐变编辑器状态 */
  const [showGradientEditor, setShowGradientEditor] = useState(false);

  /** 获取 customGradient 的安全值 */
  const customGradient = settings.customGradient ?? {
    stops: [
      { color: '#667eea', position: 0 },
      { color: '#764ba2', position: 0.5 },
      { color: '#f093fb', position: 1 },
    ],
    angle: 135,
  };

  /** 更新自定义渐变并自动切换到 custom 预设 */
  const updateCustomGradient = useCallback(
    (patch: Partial<UserSettings['customGradient']>) => {
      const merged = { ...customGradient, ...patch };
      updateSettings({
        gradientPreset: 'custom',
        customGradient: merged,
      });
    },
    [customGradient, updateSettings],
  );

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

      <Field label={t('gradient.title')} hint={t('gradient.hint')}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
          }}
        >
          {GRADIENT_PRESETS.map((preset) => {
            const isSelected = settings.gradientPreset === preset.id;
            /** custom 预设需要实时预览用户编辑的渐变 */
            const previewBg =
              preset.id === 'custom' && settings.customGradient
                ? (isDark && settings.customGradient.darkStops
                    ? buildGradient(settings.customGradient.darkStops, settings.customGradient.darkAngle ?? settings.customGradient.angle)
                    : buildGradient(settings.customGradient.stops, settings.customGradient.angle))
                : isDark
                  ? preset.dark
                  : preset.light;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  updateSettings({ gradientPreset: preset.id });
                  if (preset.id === 'custom') setShowGradientEditor(true);
                }}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  borderRadius: token.borderRadiusLG,
                  overflow: 'hidden',
                  border: isSelected
                    ? `2px solid ${token.colorPrimary}`
                    : `1px solid ${token.colorBorderSecondary}`,
                  transition: 'border-color 160ms ease, box-shadow 160ms ease',
                  boxShadow: isSelected ? `0 0 0 1px ${token.colorPrimary}` : 'none',
                }}
              >
                {/* 色卡 */}
                <div
                  style={{
                    height: 48,
                    background: previewBg,
                    position: 'relative',
                  }}
                >
                  {/* 模式兼容角标 */}
                  {preset.compatibleMode !== 'both' && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        fontSize: 9,
                        color: '#fff',
                        background:
                          preset.compatibleMode === 'dark'
                            ? 'rgba(0,0,0,0.5)'
                            : 'rgba(255,255,255,0.7)',
                      }}
                    >
                      {preset.compatibleMode === 'dark' ? (
                        <MoonOutlined />
                      ) : (
                        <SunOutlined style={{ color: '#333' }} />
                      )}
                    </span>
                  )}
                  {/* custom 预设显示编辑图标 */}
                  {preset.id === 'custom' && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: 16,
                        color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.4)',
                      }}
                    >
                      <EditOutlined />
                    </span>
                  )}
                </div>
                {/* 名称标签 */}
                <div
                  style={{
                    padding: '4px 6px',
                    fontSize: 11,
                    fontWeight: isSelected ? 600 : 400,
                    color: isSelected ? token.colorPrimary : token.colorTextSecondary,
                    background: token.colorBgContainer,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {t(preset.labelKey)}
                </div>
              </button>
            );
          })}
        </div>

        {/* 自定义渐变编辑器——仅当选中 custom 或手动展开时显示 */}
        {settings.gradientPreset === 'custom' && (
          <div
            style={{
              marginTop: 8,
              padding: 14,
              borderRadius: token.borderRadiusLG,
              border: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorFillQuaternary,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 500, color: token.colorTextSecondary }}>
                <EditOutlined style={{ marginRight: 6 }} />
                {t('gradient.customEditor')}
              </span>
              <Button
                size="small"
                type={showGradientEditor ? 'default' : 'link'}
                icon={showGradientEditor ? undefined : <EditOutlined />}
                onClick={() => setShowGradientEditor(!showGradientEditor)}
              >
                {showGradientEditor ? t('gradient.collapseEditor') : t('gradient.expandEditor')}
              </Button>
            </div>

            {/* 实时预览条 */}
            <div
              style={{
                height: 32,
                borderRadius: token.borderRadius,
                background: buildGradient(customGradient?.stops ?? [{ color: '#667eea', position: 0 }, { color: '#764ba2', position: 0.5 }, { color: '#f093fb', position: 1 }], customGradient?.angle ?? 135),
                marginBottom: showGradientEditor ? 12 : 0,
              }}
            />

            {/* 展开的编辑控件 */}
            {showGradientEditor && (
              <>
                {/* 角度 */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 4 }}>
                    {t('gradient.angle')}: {customGradient.angle}°
                  </div>
                  <Slider
                    min={0}
                    max={360}
                    value={customGradient.angle}
                    onChange={(v) => updateCustomGradient({ angle: v })}
                  />
                </div>

                {/* 色标列表 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {customGradient.stops.map((stop, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 8px',
                        borderRadius: token.borderRadiusSM,
                        background: token.colorBgContainer,
                      }}
                    >
                      <ColorPicker
                        size="small"
                        value={stop.color}
                        onChangeComplete={(color) => {
                          const newStops = [...customGradient.stops];
                          newStops[i] = { ...newStops[i], color: color.toHexString() };
                          updateCustomGradient({ stops: newStops });
                        }}
                      />
                      <Slider
                        min={0}
                        max={100}
                        value={Math.round(stop.position * 100)}
                        onChange={(v) => {
                          const newStops = [...customGradient.stops];
                          newStops[i] = { ...newStops[i], position: v / 100 };
                          updateCustomGradient({ stops: newStops });
                        }}
                        style={{ flex: 1 }}
                      />
                      {customGradient.stops.length > 2 && (
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<MinusCircleOutlined />}
                          onClick={() => {
                            const newStops = customGradient.stops.filter((_, idx) => idx !== i);
                            updateCustomGradient({ stops: newStops });
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* 添加色标按钮 */}
                {customGradient.stops.length < 6 && (
                  <Button
                    type="dashed"
                    size="small"
                    block
                    icon={<PlusOutlined />}
                    style={{ marginTop: 8 }}
                    onClick={() => {
                      const lastPos = customGradient.stops[customGradient.stops.length - 1]?.position ?? 0.5;
                      const newPos = Math.min(1, lastPos + 0.15);
                      updateCustomGradient({
                        stops: [...customGradient.stops, { color: '#888888', position: newPos }],
                      });
                    }}
                  >
                    {t('gradient.addStop')}
                  </Button>
                )}

                {/* 深色模式配置 */}
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
                  <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 8 }}>
                    {t('gradient.darkModeConfig')}
                  </div>
                  <Switch
                    size="small"
                    checked={customGradient.darkStops != null}
                    onChange={(checked) => {
                      if (checked) {
                        // 从浅色版自动生成暗化版本
                        const darkStops = customGradient.stops.map((s) => ({
                          color: darkenHex(s.color, 0.5),
                          position: s.position,
                        }));
                        updateCustomGradient({ darkStops, darkAngle: customGradient.angle });
                      } else {
                        updateCustomGradient({ darkStops: undefined, darkAngle: undefined });
                      }
                    }}
                  />
                  <span style={{ fontSize: 11, marginLeft: 8, color: token.colorTextSecondary }}>
                    {t('gradient.independentDark')}
                  </span>

                  {customGradient.darkStops && (
                    <div style={{ marginTop: 8 }}>
                      {customGradient.darkStops.map((stop, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '4px 8px',
                            borderRadius: token.borderRadiusSM,
                            background: token.colorBgElevated,
                            marginBottom: 4,
                          }}
                        >
                          <ColorPicker
                            size="small"
                            value={stop.color}
                            onChangeComplete={(color) => {
                              const newStops = [...(customGradient.darkStops ?? [])];
                              newStops[i] = { ...newStops[i], color: color.toHexString() };
                              updateCustomGradient({ darkStops: newStops });
                            }}
                          />
                          <Slider
                            min={0}
                            max={100}
                            value={Math.round(stop.position * 100)}
                            onChange={(v) => {
                              const newStops = [...(customGradient.darkStops ?? [])];
                              newStops[i] = { ...newStops[i], position: v / 100 };
                              updateCustomGradient({ darkStops: newStops });
                            }}
                            style={{ flex: 1 }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
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
              defaultView: v as 'domain' | 'timeline' | 'compact' | 'grid' | 'frequency' | 'tabgroup' | 'window' | 'bookmarks',
            })
          }
          style={{ width: '100%' }}
          options={[
            { value: 'domain', label: t('view.domain') },
            { value: 'tabgroup', label: t('view.tabgroup') },
            { value: 'window', label: t('view.window') },
            { value: 'bookmarks', label: t('view.bookmarks') },
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

  /** Tab 4：快捷键 */
  const shortcutsPanel = (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <Alert
        type="info"
        message={t('settings.shortcutsHint')}
        showIcon
        style={{ fontSize: 12 }}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {[
          { label: t('shortcuts.openCanopy'), keys: 'Alt + C' },
          { label: t('shortcuts.saveAll'), keys: 'Alt + Shift + S' },
          { label: t('shortcuts.toggleSearch'), keys: 'Alt + K' },
          { label: t('shortcuts.localSearch'), keys: '⌘/Ctrl + K', hint: t('shortcuts.localSearchHint') },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: token.borderRadiusLG,
              background: token.colorFillQuaternary,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</div>
              {item.hint && (
                <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 2 }}>
                  {item.hint}
                </div>
              )}
            </div>
            <kbd
              style={{
                fontSize: 12,
                fontFamily: 'inherit',
                padding: '3px 8px',
                borderRadius: token.borderRadiusSM,
                background: token.colorBgContainer,
                border: `1px solid ${token.colorBorder}`,
                color: token.colorTextSecondary,
                whiteSpace: 'nowrap',
              }}
            >
              {item.keys}
            </kbd>
          </div>
        ))}
      </div>
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
          {
            key: 'shortcuts',
            label: (
              <span>
                <KeyOutlined /> {t('settings.shortcuts')}
              </span>
            ),
            children: shortcutsPanel,
          },
        ]}
      />
    </Drawer>
  );
}

/**
 * 将 HEX 色值暗化指定比例
 *
 * @param hex   原始色值（#RRGGBB）
 * @param ratio 暗化比例 0~1，0 不变，1 全黑
 */
function darkenHex(hex: string, ratio: number): string {
  const h = hex.replace('#', '');
  const r = Math.round(parseInt(h.slice(0, 2), 16) * (1 - ratio));
  const g = Math.round(parseInt(h.slice(2, 4), 16) * (1 - ratio));
  const b = Math.round(parseInt(h.slice(4, 6), 16) * (1 - ratio));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
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
