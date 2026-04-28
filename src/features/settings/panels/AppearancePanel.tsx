/**
 * AppearancePanel — 外观设置 Tab
 *
 * 包含：
 *   - 皮肤预设选择器（5 套高级皮肤）
 *   - 语言选择
 *   - 渐变背景预设选择器 + 自定义渐变编辑器
 *   - 自定义背景图（URL / 文件上传 + 填充模式 + 定位）
 *   - 背景遮罩层（颜色 + 模糊度）
 *   - 布局密度（紧凑 / 默认 / 宽松）
 *   - 内容区最大宽度
 *   - 动效控制（减弱动效）
 *   - UI 区域显隐（顶栏 / 搜索框 / 视图切换 / 概览 / 整理建议）
 */

import { useState, useCallback } from 'react';
import { App, Select, Button, Slider, ColorPicker, Space, Switch, InputNumber, Input, Upload, Divider, theme } from 'antd';
import {
  Pencil,
  Plus,
  MinusCircle,
  Sun,
  Moon,
  Image,
  Trash2,
} from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useT } from '@/shared/i18n';
import { useResolvedTheme } from '@/shared/hooks';
import { GRADIENT_PRESETS, buildGradient } from '@/shared/theme/gradient-presets';
import { SKIN_PRESETS } from '@/shared/theme/skin-presets';
import type { UserSettings } from '@/shared/types';
import { Field } from '../components/Field';
import { BRAND } from '@/shared/config/brand';

interface AppearancePanelProps {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void | Promise<void>;
}

const MAX_BACKGROUND_IMAGE_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_BACKGROUND_IMAGE_EDGE = 1920;
const BACKGROUND_IMAGE_QUALITY = 0.84;
const MAX_VIDEO_BACKGROUND_FILE_BYTES = 50 * 1024 * 1024;

/** 将上传背景图压缩为 WebP data URL，避免原图 base64 长期占用 storage 与渲染内存。 */
async function optimizeBackgroundImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择图片文件');
  }
  if (file.size > MAX_BACKGROUND_IMAGE_SOURCE_BYTES) {
    throw new Error('图片不能超过 20MB');
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new window.Image();
  try {
    image.decoding = 'async';
    image.src = objectUrl;
    await image.decode();

    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;
    if (sourceWidth <= 0 || sourceHeight <= 0) {
      throw new Error('图片尺寸无效');
    }

    const scale = Math.min(1, MAX_BACKGROUND_IMAGE_EDGE / Math.max(sourceWidth, sourceHeight));
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (ctx === null) throw new Error('无法处理图片');
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    const dataUrl = canvas.toDataURL('image/webp', BACKGROUND_IMAGE_QUALITY);
    canvas.width = 1;
    canvas.height = 1;
    return dataUrl;
  } finally {
    image.src = '';
    URL.revokeObjectURL(objectUrl);
  }
}

export function AppearancePanel({ settings, updateSettings }: AppearancePanelProps) {
  const { t } = useT();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const isDark = useResolvedTheme() === 'dark';
  const [showGradientEditor, setShowGradientEditor] = useState(false);

  const customGradient = settings.customGradient ?? {
    stops: [
      { color: '#667eea', position: 0 },
      { color: '#764ba2', position: 0.5 },
      { color: '#f093fb', position: 1 },
    ],
    angle: 135,
  };

  const updateCustomGradient = useCallback(
    (patch: Partial<UserSettings['customGradient']>) => {
      const merged = { ...customGradient, ...patch };
      void updateSettings({
        gradientPreset: 'custom',
        customGradient: merged,
      });
    },
    [customGradient, updateSettings],
  );

  /** 安全更新 backgroundImage */
  const updateBgImage = useCallback(
    (patch: Partial<NonNullable<UserSettings['backgroundImage']>>) => {
      const current = settings.backgroundImage ?? { url: '', fit: 'cover' as const };
      void updateSettings({ backgroundImage: { ...current, ...patch } });
    },
    [settings.backgroundImage, updateSettings],
  );

  /** 安全更新 backgroundOverlay */
  const updateBgOverlay = useCallback(
    (patch: Partial<NonNullable<UserSettings['backgroundOverlay']>>) => {
      const current = settings.backgroundOverlay ?? {
        enabled: false,
        color: 'rgba(0,0,0,0.35)',
        colorDark: 'rgba(0,0,0,0.6)',
        blur: 0,
      };
      void updateSettings({ backgroundOverlay: { ...current, ...patch } });
    },
    [settings.backgroundOverlay, updateSettings],
  );

  /** 安全更新 uiVisibility */
  const updateUiVisibility = useCallback(
    (key: keyof NonNullable<UserSettings['uiVisibility']>, value: boolean) => {
      const current = settings.uiVisibility ?? {
        header: true,
        heroSearch: true,
        viewSwitcher: true,
        workspaceOverview: true,
        tidySuggestion: true,
      };
      void updateSettings({ uiVisibility: { ...current, [key]: value } });
    },
    [settings.uiVisibility, updateSettings],
  );

  /** 处理文件上传：先压缩降采样，再写入背景图配置。 */
  const handleFileUpload = useCallback(
    (file: File) => {
      void optimizeBackgroundImage(file)
        .then((dataUrl) => updateBgImage({ url: dataUrl }))
        .catch((err) => {
          console.warn(`${BRAND.logTag} background image optimize failed`, err);
          void message.warning(err instanceof Error ? err.message : '图片处理失败');
        });
    },
    [message, updateBgImage],
  );

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      {/* ── 皮肤预设选择器 ── */}
      <Field label={t('skin.title')} hint={t('skin.hint')}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
          }}
        >
          {SKIN_PRESETS.map((skin) => {
            const isSelected = settings.skinPreset === skin.id || (!settings.skinPreset && skin.id === 'minimal');
            const gradientBg = `linear-gradient(135deg, ${skin.previewColors[0]}, ${skin.previewColors[1]}, ${skin.previewColors[2] ?? skin.previewColors[1]})`;
            return (
              <button
                key={skin.id}
                type="button"
                onClick={() => { void updateSettings({ skinPreset: skin.id }); }}
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
                <div style={{ height: 52, background: gradientBg, position: 'relative' }}>
                  {skin.compatibleMode !== 'both' && (
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
                          skin.compatibleMode === 'dark'
                            ? 'rgba(0,0,0,0.5)'
                            : 'rgba(255,255,255,0.7)',
                      }}
                    >
                      {skin.compatibleMode === 'dark' ? (
                        <Moon size={ICON_SIZE.XS} />
                      ) : (
                        <Sun size={ICON_SIZE.XS} style={{ color: '#333' }} />
                      )}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    padding: '4px 6px',
                    background: token.colorBgContainer,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: isSelected ? 600 : 500,
                      color: isSelected ? token.colorPrimary : token.colorText,
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {t(skin.labelKey)}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: token.colorTextTertiary,
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginTop: 1,
                    }}
                  >
                    {t(skin.descriptionKey)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Field>

      {/* ── 极客模式：单 token 精细化定制 ── */}
      <Field label={t('skin.customTitle')} hint={t('skin.customHint')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/*
           * 总开关：关闭时即使 settings.skinCustom 存在，也通过清空实现"一键回到预设"。
           * 这样 AntdThemeProvider 的 skinCustom === undefined 分支会直接使用预设原值。
           */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
              {t('skin.customEnable')}
            </span>
            <Switch
              checked={settings.skinCustom !== undefined}
              onChange={(on) => {
                void updateSettings({
                  skinCustom: on
                    ? { borderRadius: 8, fontSize: 14, controlHeight: 32, borderWidth: 1 }
                    : undefined,
                });
              }}
            />
          </div>

          {settings.skinCustom !== undefined && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                padding: 12,
                borderRadius: token.borderRadiusLG,
                background: token.colorFillQuaternary,
              }}
            >
              {/* 圆角 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: token.colorText }}>{t('skin.customRadius')}</span>
                  <span style={{ fontSize: 12, color: token.colorTextTertiary, fontFeatureSettings: '"tnum"' }}>
                    {settings.skinCustom.borderRadius ?? 8}px
                  </span>
                </div>
                <Slider
                  min={0}
                  max={24}
                  step={1}
                  value={settings.skinCustom.borderRadius ?? 8}
                  onChange={(v) => {
                    void updateSettings({
                      skinCustom: { ...settings.skinCustom, borderRadius: v },
                    });
                  }}
                />
                <div style={{ fontSize: 11, color: token.colorTextTertiary }}>
                  {t('skin.customRadiusHint')}
                </div>
              </div>

              {/* 基础字号 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: token.colorText }}>{t('skin.customFontSize')}</span>
                  <span style={{ fontSize: 12, color: token.colorTextTertiary, fontFeatureSettings: '"tnum"' }}>
                    {settings.skinCustom.fontSize ?? 14}px
                  </span>
                </div>
                <Slider
                  min={12}
                  max={16}
                  step={1}
                  value={settings.skinCustom.fontSize ?? 14}
                  onChange={(v) => {
                    void updateSettings({
                      skinCustom: { ...settings.skinCustom, fontSize: v },
                    });
                  }}
                />
                <div style={{ fontSize: 11, color: token.colorTextTertiary }}>
                  {t('skin.customFontSizeHint')}
                </div>
              </div>

              {/* 控件高度 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: token.colorText }}>{t('skin.customControlHeight')}</span>
                  <span style={{ fontSize: 12, color: token.colorTextTertiary, fontFeatureSettings: '"tnum"' }}>
                    {settings.skinCustom.controlHeight ?? 32}px
                  </span>
                </div>
                <Slider
                  min={24}
                  max={40}
                  step={2}
                  value={settings.skinCustom.controlHeight ?? 32}
                  onChange={(v) => {
                    void updateSettings({
                      skinCustom: { ...settings.skinCustom, controlHeight: v },
                    });
                  }}
                />
                <div style={{ fontSize: 11, color: token.colorTextTertiary }}>
                  {t('skin.customControlHeightHint')}
                </div>
              </div>

              {/* 边框粗细 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: token.colorText }}>{t('skin.customBorderWidth')}</span>
                  <span style={{ fontSize: 12, color: token.colorTextTertiary, fontFeatureSettings: '"tnum"' }}>
                    {settings.skinCustom.borderWidth ?? 1}px
                  </span>
                </div>
                <Slider
                  min={0.5}
                  max={2}
                  step={0.5}
                  value={settings.skinCustom.borderWidth ?? 1}
                  onChange={(v) => {
                    void updateSettings({
                      skinCustom: { ...settings.skinCustom, borderWidth: v },
                    });
                  }}
                />
                <div style={{ fontSize: 11, color: token.colorTextTertiary }}>
                  {t('skin.customBorderWidthHint')}
                </div>
              </div>

              {/* 品牌主色 */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: token.colorText }}>{t('skin.customColorPrimary')}</span>
                  <ColorPicker
                    value={settings.skinCustom.colorPrimary}
                    size="small"
                    showText
                    onChange={(c) => {
                      void updateSettings({
                        skinCustom: { ...settings.skinCustom, colorPrimary: c.toHexString() },
                      });
                    }}
                  />
                </div>
                <div style={{ fontSize: 11, color: token.colorTextTertiary }}>
                  {t('skin.customColorPrimaryHint')}
                </div>
              </div>

              <Button
                size="small"
                onClick={() => {
                  void updateSettings({ skinCustom: undefined });
                }}
              >
                {t('skin.customReset')}
              </Button>
            </div>
          )}
        </div>
      </Field>

      {/* ── 语言选择 ── */}
      <Field label={t('settings.language')}>
        <Select
          value={settings.language}
          onChange={(v) => { void updateSettings({ language: v }); }}
          style={{ width: '100%' }}
          options={[
            { value: 'zh-CN', label: '中文' },
            { value: 'en', label: 'English' },
          ]}
        />
      </Field>

      {/* ══════════════════════════════════════════════════
          背景定制区
          ══════════════════════════════════════════════════ */}
      <Divider style={{ fontSize: 12, color: token.colorTextTertiary, margin: '8px 0' }}>
        {t('bg.sectionTitle')}
      </Divider>

      {/* ── 渐变背景预设 ── */}
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
            const previewBg =
              preset.id === 'custom' && settings.customGradient
                ? isDark && settings.customGradient.darkStops
                  ? buildGradient(settings.customGradient.darkStops, settings.customGradient.darkAngle ?? settings.customGradient.angle)
                  : buildGradient(settings.customGradient.stops, settings.customGradient.angle)
                : isDark
                  ? preset.dark
                  : preset.light;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  void updateSettings({ gradientPreset: preset.id });
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
                <div style={{ height: 48, background: previewBg, position: 'relative' }}>
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
                        <Moon size={ICON_SIZE.XS} />
                      ) : (
                        <Sun size={ICON_SIZE.XS} style={{ color: '#333' }} />
                      )}
                    </span>
                  )}
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
<Pencil size={ICON_SIZE.LARGE} />
                    </span>
                  )}
                </div>
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

        {/* 自定义渐变编辑器 */}
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
<Pencil size={ICON_SIZE.MEDIUM} style={{ marginRight: 6 }} />
                {t('gradient.customEditor')}
              </span>
              <Button
                size="small"
                type={showGradientEditor ? 'default' : 'link'}
icon={showGradientEditor ? undefined : <Pencil size={ICON_SIZE.MEDIUM} />}
                onClick={() => setShowGradientEditor(!showGradientEditor)}
              >
                {showGradientEditor ? t('gradient.collapseEditor') : t('gradient.expandEditor')}
              </Button>
            </div>

            <div
              style={{
                height: 32,
                borderRadius: token.borderRadius,
                background: buildGradient(
                  customGradient?.stops ?? [
                    { color: '#667eea', position: 0 },
                    { color: '#764ba2', position: 0.5 },
                    { color: '#f093fb', position: 1 },
                  ],
                  customGradient?.angle ?? 135,
                ),
                marginBottom: showGradientEditor ? 12 : 0,
              }}
            />

            {showGradientEditor && (
              <>
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
icon={<MinusCircle size={ICON_SIZE.MEDIUM} />}
                          onClick={() => {
                            const newStops = customGradient.stops.filter((_, idx) => idx !== i);
                            updateCustomGradient({ stops: newStops });
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {customGradient.stops.length < 6 && (
                  <Button
                    type="dashed"
                    size="small"
                    block
icon={<Plus size={ICON_SIZE.MEDIUM} />}
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

                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
                  <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 8 }}>
                    {t('gradient.darkModeConfig')}
                  </div>
                  <Switch
                    size="small"
                    checked={customGradient.darkStops != null}
                    onChange={(checked) => {
                      if (checked) {
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

      {/* ── 自定义背景图 ── */}
      <Field label={t('bg.imageTitle')} hint={t('bg.imageHint')}>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Input
            placeholder={t('bg.imageUrlPlaceholder')}
            value={settings.backgroundImage?.url ?? ''}
            onChange={(e) => updateBgImage({ url: e.target.value })}
            suffix={
              settings.backgroundImage?.url ? (
                <Button
                  type="text"
                  size="small"
                  danger
icon={<Trash2 size={ICON_SIZE.MEDIUM} />}
                  onClick={() => { void updateSettings({ backgroundImage: undefined }); }}
                />
              ) : (
<Image size={ICON_SIZE.MEDIUM} style={{ color: token.colorTextTertiary }} />
              )
            }
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Upload
              beforeUpload={(file) => {
                handleFileUpload(file);
                return false; // 阻止自动上传
              }}
              showUploadList={false}
              accept="image/*"
            >
<Button size="small" icon={<Image size={ICON_SIZE.MEDIUM} />}>
                {t('bg.uploadImage')}
              </Button>
            </Upload>
            {settings.backgroundImage?.url && (
              <Select
                size="small"
                value={settings.backgroundImage.fit}
                onChange={(v) => updateBgImage({ fit: v })}
                style={{ width: 120 }}
                options={[
                  { value: 'cover', label: t('bg.fitCover') },
                  { value: 'contain', label: t('bg.fitContain') },
                  { value: 'repeat', label: t('bg.fitRepeat') },
                ]}
              />
            )}
          </div>
        </Space>
      </Field>

      {/* ── 背景遮罩层 ── */}
      <Field label={t('bg.overlayTitle')} hint={t('bg.overlayHint')}>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Switch
            size="small"
            checked={settings.backgroundOverlay?.enabled ?? false}
            onChange={(checked) => updateBgOverlay({ enabled: checked })}
          />
          <span style={{ fontSize: 11, marginLeft: 8, color: token.colorTextSecondary }}>
            {t('bg.overlayEnabled')}
          </span>

          {(settings.backgroundOverlay?.enabled) && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: token.colorTextTertiary, flexShrink: 0 }}>
                  {t('bg.overlayColor')}
                </span>
                <ColorPicker
                  size="small"
                  value={isDark
                    ? (settings.backgroundOverlay?.colorDark ?? 'rgba(0,0,0,0.6)')
                    : (settings.backgroundOverlay?.color ?? 'rgba(0,0,0,0.35)')}
                  onChangeComplete={(color) => {
                    const hex = color.toHexString();
                    const rgba = hexToRgba(hex, isDark
                      ? parseAlpha(settings.backgroundOverlay?.colorDark ?? 'rgba(0,0,0,0.6)')
                      : parseAlpha(settings.backgroundOverlay?.color ?? 'rgba(0,0,0,0.35)'));
                    if (isDark) {
                      updateBgOverlay({ colorDark: rgba });
                    } else {
                      updateBgOverlay({ color: rgba });
                    }
                  }}
                />
              </div>
              <div>
                <span style={{ fontSize: 11, color: token.colorTextTertiary }}>
                  {t('bg.overlayBlur')}: {settings.backgroundOverlay?.blur ?? 0}px
                </span>
                <Slider
                  min={0}
                  max={12}
                  value={Math.min(settings.backgroundOverlay?.blur ?? 0, 12)}
                  onChange={(v) => updateBgOverlay({ blur: v })}
                />
              </div>
            </>
          )}
        </Space>
      </Field>

      {/* ══════════════════════════════════════════════════
          布局定制区
          ══════════════════════════════════════════════════ */}
      <Divider style={{ fontSize: 12, color: token.colorTextTertiary, margin: '8px 0' }}>
        {t('layout.sectionTitle')}
      </Divider>

      {/* ── 布局密度 ── */}
      <Field label={t('layout.density')} hint={t('layout.densityHint')}>
        <Select
          value={settings.layoutDensity ?? 'default'}
          onChange={(v) => { void updateSettings({ layoutDensity: v }); }}
          style={{ width: '100%' }}
          options={[
            { value: 'compact', label: t('layout.densityCompact') },
            { value: 'default', label: t('layout.densityDefault') },
            { value: 'comfortable', label: t('layout.densityComfortable') },
          ]}
        />
      </Field>

      {/* ── 内容区最大宽度 ── */}
      <Field label={t('layout.maxWidth')} hint={t('layout.maxWidthHint')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <InputNumber
            min={0}
            max={3000}
            step={40}
            value={settings.contentMaxWidth ?? 1360}
            onChange={(v) => { void updateSettings({ contentMaxWidth: v ?? 0 }); }}
            style={{ width: 120 }}
          />
          <span style={{ fontSize: 11, color: token.colorTextTertiary }}>px</span>
          <span style={{ fontSize: 10, color: token.colorTextQuaternary }}>
            ({t('layout.maxWidthZero')})
          </span>
        </div>
      </Field>

      {/* ══════════════════════════════════════════════════
          动效与无障碍
          ══════════════════════════════════════════════════ */}
      <Divider style={{ fontSize: 12, color: token.colorTextTertiary, margin: '8px 0' }}>
        {t('a11y.sectionTitle')}
      </Divider>

      {/* ── 减弱动效 ── */}
      <Field label={t('a11y.reducedMotion')} hint={t('a11y.reducedMotionHint')}>
        <Select
          value={settings.reducedMotion ?? 'auto'}
          onChange={(v) => { void updateSettings({ reducedMotion: v }); }}
          style={{ width: '100%' }}
          options={[
            { value: 'auto', label: t('a11y.reducedMotionAuto') },
            { value: 'on', label: t('a11y.reducedMotionOn') },
            { value: 'off', label: t('a11y.reducedMotionOff') },
          ]}
        />
      </Field>

      {/* ── 点击动效（v1.2） ──
          5 套预设：涟漪 / 星光 / 彩纸 / 樱花 / 关闭；
          按需 chunk，默认 'off' 不会拉取 canvas 代码。 */}
      <Field label={t('effects.clickEffect')} hint={t('effects.clickEffectHint')}>
        <Select
          value={settings.clickEffect ?? 'off'}
          onChange={(v) => { void updateSettings({ clickEffect: v }); }}
          style={{ width: '100%' }}
          options={[
            { value: 'off', label: t('effects.clickOff') },
            { value: 'ripple', label: t('effects.clickRipple') },
            { value: 'sparkle', label: t('effects.clickSparkle') },
            { value: 'confetti', label: t('effects.clickConfetti') },
            { value: 'petal', label: t('effects.clickPetal') },
          ]}
        />
      </Field>

      {/* ── 视频背景（v1.2） ──
          支持 URL 或本地文件（IndexedDB 持久化）；速率可调；
          提示视频会占用更多内存/电量，用户按需开启。 */}
      <Field label={t('effects.videoBg')} hint={t('effects.videoBgHint')}>
        <Select
          value={settings.videoBackground?.type ?? 'none'}
          onChange={(v) => {
            void (async () => {
              if (v === 'none') {
                // 同时清掉已存的文件，避免 IndexedDB 残留
                const old = settings.videoBackground?.fileKey;
                if (typeof old === 'string' && old !== '') {
                  const { removeVideoFile } = await import('@/features/effects');
                  await removeVideoFile(old).catch(() => undefined);
                }
                void updateSettings({ videoBackground: { type: 'none' } });
                return;
              }
              void updateSettings({
                videoBackground: { ...(settings.videoBackground ?? {}), type: v },
              });
            })();
          }}
          style={{ width: '100%' }}
          options={[
            { value: 'none', label: t('effects.videoBgNone') },
            { value: 'url', label: t('effects.videoBgUrl') },
            { value: 'file', label: t('effects.videoBgFile') },
          ]}
        />
      </Field>

      {settings.videoBackground?.type === 'url' && (
        <Field label={t('effects.videoBgUrlLabel')} hint={t('effects.videoBgUrlHint')}>
          <Input
            placeholder="https://example.com/bg.mp4"
            value={settings.videoBackground.src ?? ''}
            onChange={(e) =>
              void updateSettings({
                videoBackground: {
                  ...(settings.videoBackground ?? {}),
                  type: 'url',
                  src: e.target.value,
                },
              })
            }
          />
        </Field>
      )}

      {settings.videoBackground?.type === 'file' && (
        <Field label={t('effects.videoBgFileLabel')} hint={t('effects.videoBgFileHint')}>
          <Upload
            accept="video/mp4,video/webm"
            showUploadList={false}
            beforeUpload={(file) => {
              void (async () => {
                if (file.size > MAX_VIDEO_BACKGROUND_FILE_BYTES) {
                  void message.warning('视频不能超过 50MB');
                  return;
                }
                if (file.type !== '' && !['video/mp4', 'video/webm'].includes(file.type)) {
                  void message.warning('请选择 MP4 或 WebM 视频');
                  return;
                }
                const { saveVideoFile, removeVideoFile } = await import('@/features/effects');
                // 先清掉旧文件（若有），避免 IndexedDB 里积灰
                const old = settings.videoBackground?.fileKey;
                if (typeof old === 'string' && old !== '') {
                  await removeVideoFile(old).catch(() => undefined);
                }
                const key = await saveVideoFile(file);
                void updateSettings({
                  videoBackground: {
                    ...(settings.videoBackground ?? {}),
                    type: 'file',
                    fileKey: key,
                  },
                });
              })();
              return false; // 禁止 antd 自己上传
            }}
          >
<Button icon={<Image size={ICON_SIZE.MEDIUM} />}>
              {settings.videoBackground.fileKey !== undefined && settings.videoBackground.fileKey !== ''
                ? t('effects.videoBgFileChange')
                : t('effects.videoBgFileSelect')}
            </Button>
          </Upload>
        </Field>
      )}

      {settings.videoBackground?.type !== undefined && settings.videoBackground.type !== 'none' && (
        <Field label={t('effects.videoBgRate')} hint={t('effects.videoBgRateHint')}>
          <Slider
            min={0.25}
            max={2}
            step={0.25}
            value={settings.videoBackground?.playbackRate ?? 1}
            onChange={(v) =>
              void updateSettings({
                videoBackground: {
                  ...(settings.videoBackground ?? {}),
                  playbackRate: v,
                },
              })
            }
            marks={{ 0.5: '0.5×', 1: '1×', 1.5: '1.5×', 2: '2×' }}
          />
        </Field>
      )}

      {/* ══════════════════════════════════════════════════
          UI 区域显隐
          ══════════════════════════════════════════════════ */}
      <Divider style={{ fontSize: 12, color: token.colorTextTertiary, margin: '8px 0' }}>
        {t('uiVisibility.sectionTitle')}
      </Divider>

      <Field label={t('uiVisibility.sectionTitle')} hint={t('uiVisibility.hint')}>
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          {([
            ['header', t('uiVisibility.header'), t('uiVisibility.headerHint')],
            ['heroLogo', t('uiVisibility.heroLogo'), t('uiVisibility.heroLogoHint')],
            ['heroTitle', t('uiVisibility.heroTitle'), t('uiVisibility.heroTitleHint')],
            ['heroSlogan', t('uiVisibility.heroSlogan'), t('uiVisibility.heroSloganHint')],
            ['heroSearch', t('uiVisibility.heroSearch'), t('uiVisibility.heroSearchHint')],
            ['viewSwitcher', t('uiVisibility.viewSwitcher'), t('uiVisibility.viewSwitcherHint')],
            ['workspaceOverview', t('uiVisibility.workspaceOverview'), t('uiVisibility.workspaceOverviewHint')],
            ['tidySuggestion', t('uiVisibility.tidySuggestion'), t('uiVisibility.tidySuggestionHint')],
          ] as const).map(([key, label, hint]) => (
            <div
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                borderRadius: token.borderRadiusSM,
                background: token.colorFillQuaternary,
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: token.colorText }}>{label}</div>
                <div style={{ fontSize: 10, color: token.colorTextTertiary }}>{hint}</div>
              </div>
              <Switch
                size="small"
                checked={settings.uiVisibility?.[key] !== false}
                onChange={(v) => updateUiVisibility(key, v)}
              />
            </div>
          ))}
        </Space>
      </Field>
    </Space>
  );
}

/**
 * 将 HEX 色值暗化指定比例
 */
function darkenHex(hex: string, ratio: number): string {
  const h = hex.replace('#', '');
  const r = Math.round(parseInt(h.slice(0, 2), 16) * (1 - ratio));
  const g = Math.round(parseInt(h.slice(2, 4), 16) * (1 - ratio));
  const b = Math.round(parseInt(h.slice(4, 6), 16) * (1 - ratio));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * 从 rgba 字符串解析 alpha 值
 */
function parseAlpha(rgba: string): number {
  const match = rgba.match(/[\d.]+(?=\))/);
  return match ? parseFloat(match[0]) : 0.35;
}

/**
 * HEX + alpha → rgba 字符串
 */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
