/**
 * AppearancePanel — 外观设置 Tab
 *
 * 包含：
 *   - 语言选择
 *   - 渐变背景预设选择器（3×3 网格色卡）
 *   - 自定义渐变编辑器（色标 / 角度 / 深色模式独立配色）
 */

import { useState, useCallback } from 'react';
import { Select, Button, Slider, ColorPicker, Space, Switch, theme } from 'antd';
import { EditOutlined, PlusOutlined, MinusCircleOutlined, SunOutlined, MoonOutlined } from '@ant-design/icons';
import { useT } from '@/shared/i18n';
import { useResolvedTheme } from '@/shared/hooks';
import { GRADIENT_PRESETS, buildGradient } from '@/shared/theme/gradient-presets';
import type { UserSettings } from '@/shared/types';
import { Field } from '../components/Field';

interface AppearancePanelProps {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void;
}

export function AppearancePanel({ settings, updateSettings }: AppearancePanelProps) {
  const { t } = useT();
  const { token } = theme.useToken();
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
      updateSettings({
        gradientPreset: 'custom',
        customGradient: merged,
      });
    },
    [customGradient, updateSettings],
  );

  return (
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
                        <MoonOutlined />
                      ) : (
                        <SunOutlined style={{ color: '#333' }} />
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
                      <EditOutlined />
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
    </Space>
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
