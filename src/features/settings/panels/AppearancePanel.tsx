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

import { useState, useCallback } from "react";
import {
  App,
  Select,
  Button,
  Slider,
  ColorPicker,
  Space,
  Switch,
  InputNumber,
  Input,
  Upload,
  Divider,
} from "antd";
import { Pencil, Plus, MinusCircle, Sun, Moon, Image, Trash2 } from "lucide-react";
import { cssVars } from "@/shared/utils/css-vars";

import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import { useResolvedTheme } from "@/shared/hooks";
import { GRADIENT_PRESETS, buildGradient } from "@/shared/theme/gradient-presets";
import { SKIN_PRESETS } from "@/shared/theme/skin-presets";
import { getSkinCustomBaseValues } from "@/shared/theme/theme-customization";
import type { UserSettings } from "@/shared/types";
import { Field } from "@/features/settings/components/Field";
import { BRAND } from "@/shared/config/brand";
import styles from "./styles/appearance.module.less";

interface AppearancePanelProps {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void | Promise<void>;
}

const MAX_BACKGROUND_IMAGE_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_BACKGROUND_IMAGE_EDGE = 1920;
const BACKGROUND_IMAGE_QUALITY = 0.84;
const MAX_VIDEO_BACKGROUND_FILE_BYTES = 50 * 1024 * 1024;

function ModeBadge({ mode }: { mode: "light" | "dark" }) {
  return (
    <span className={`appearance-mode-badge is-${mode}`}>
      {mode === "dark" ? <Moon size={ICON_SIZE.XS} /> : <Sun size={ICON_SIZE.XS} />}
    </span>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  hint,
  suffix = "px",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  hint: string;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className={styles["appearance-slider-group"]}>
      <div className={styles["appearance-slider-header"]}>
        <span className={styles["appearance-slider-label"]}>{label}</span>
        <span className={styles["appearance-slider-value"]}>
          {value}
          {suffix}
        </span>
      </div>
      <Slider min={min} max={max} step={step} value={value} onChange={onChange} />
      <div className={styles["appearance-slider-hint"]}>{hint}</div>
    </div>
  );
}

function VisibilityRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className={styles["appearance-visibility-row"]}>
      <div>
        <div className={styles["appearance-visibility-title"]}>{label}</div>
        <div className={styles["appearance-visibility-hint"]}>{hint}</div>
      </div>
      <Switch size="small" checked={checked} onChange={onChange} />
    </div>
  );
}

function PresetCard({
  selected,
  preview,
  label,
  description,
  onClick,
}: {
  selected: boolean;
  preview: React.ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
}) {
  return (
    <Button
      htmlType="button"
      onClick={onClick}
      className={`appearance-preset-card${selected ? " is-selected" : ""}`}
    >
      {preview}
      <div className={styles["appearance-preset-meta"]}>
        <div className={`appearance-preset-title${selected ? " is-selected" : ""}`}>{label}</div>
        {description && (
          <div className={styles["appearance-preset-description"]}>{description}</div>
        )}
      </div>
    </Button>
  );
}

/** 将上传背景图压缩为 WebP data URL，避免原图 base64 长期占用 storage 与渲染内存。 */
async function optimizeBackgroundImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("请选择图片文件");
  }
  if (file.size > MAX_BACKGROUND_IMAGE_SOURCE_BYTES) {
    throw new Error("图片不能超过 20MB");
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new window.Image();
  try {
    image.decoding = "async";
    image.src = objectUrl;
    await image.decode();

    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;
    if (sourceWidth <= 0 || sourceHeight <= 0) {
      throw new Error("图片尺寸无效");
    }

    const scale = Math.min(1, MAX_BACKGROUND_IMAGE_EDGE / Math.max(sourceWidth, sourceHeight));
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (ctx === null) throw new Error("无法处理图片");
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    const dataUrl = canvas.toDataURL("image/webp", BACKGROUND_IMAGE_QUALITY);
    canvas.width = 1;
    canvas.height = 1;
    return dataUrl;
  } finally {
    image.src = "";
    URL.revokeObjectURL(objectUrl);
  }
}

export function AppearancePanel({ settings, updateSettings }: AppearancePanelProps) {
  const { t } = useT();
  const { message } = App.useApp();
  const isDark = useResolvedTheme() === "dark";
  const [showGradientEditor, setShowGradientEditor] = useState(false);
  const skinCustomBase = getSkinCustomBaseValues(settings.skinPreset ?? "minimal");

  const customGradient = settings.customGradient ?? {
    stops: [
      { color: "#667eea", position: 0 },
      { color: "#764ba2", position: 0.5 },
      { color: "#f093fb", position: 1 },
    ],
    angle: 135,
  };
  const customPreviewStyle: React.CSSProperties = cssVars({
    "--appearance-preview-bg": buildGradient(
      customGradient?.stops ?? [
        { color: "#667eea", position: 0 },
        { color: "#764ba2", position: 0.5 },
        { color: "#f093fb", position: 1 },
      ],
      customGradient?.angle ?? 135,
    ),
  });

  const updateCustomGradient = useCallback(
    (patch: Partial<UserSettings["customGradient"]>) => {
      const merged = { ...customGradient, ...patch };
      void updateSettings({
        gradientPreset: "custom",
        customGradient: merged,
      });
    },
    [customGradient, updateSettings],
  );

  /** 安全更新 backgroundImage */
  const updateBgImage = useCallback(
    (patch: Partial<NonNullable<UserSettings["backgroundImage"]>>) => {
      const current = settings.backgroundImage ?? { url: "", fit: "cover" as const };
      void updateSettings({ backgroundImage: { ...current, ...patch } });
    },
    [settings.backgroundImage, updateSettings],
  );

  /** 安全更新 backgroundOverlay */
  const updateBgOverlay = useCallback(
    (patch: Partial<NonNullable<UserSettings["backgroundOverlay"]>>) => {
      const current = settings.backgroundOverlay ?? {
        enabled: false,
        color: "rgba(0,0,0,0.35)",
        colorDark: "rgba(0,0,0,0.6)",
        blur: 0,
      };
      void updateSettings({ backgroundOverlay: { ...current, ...patch } });
    },
    [settings.backgroundOverlay, updateSettings],
  );

  /** 安全更新 uiVisibility（内联 fallback 确保所有属性有默认值） */
  const updateUiVisibility = useCallback(
    (key: keyof NonNullable<UserSettings["uiVisibility"]>, value: boolean) => {
      const current = settings.uiVisibility ?? {
        header: true,
        heroLogo: true,
        heroTitle: true,
        heroSlogan: true,
        heroSearch: true,
        viewSwitcher: true,
        tidySuggestion: true,
        quickStart: true,
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
          void message.warning(err instanceof Error ? err.message : "图片处理失败");
        });
    },
    [message, updateBgImage],
  );

  return (
    <div className="settings-panel-stack appearance-panel">
      {/* ── 皮肤预设选择器 ── */}
      <section className="settings-section">
        <Field label={t("skin.title")} hint={t("skin.hint")}>
          <div className={styles["appearance-grid"]}>
            {SKIN_PRESETS.map((skin) => {
              const isSelected =
                settings.skinPreset === skin.id ||
                (!settings.skinPreset && skin.id === "glassmorphism");
              const gradientBg = `linear-gradient(135deg, ${skin.previewColors[0]}, ${skin.previewColors[1]}, ${skin.previewColors[2] ?? skin.previewColors[1]})`;
              const skinPreviewStyle: React.CSSProperties = cssVars({
                "--appearance-preview-bg": gradientBg,
              });
              return (
                <PresetCard
                  key={skin.id}
                  selected={isSelected}
                  onClick={() => {
                    void updateSettings({ skinPreset: skin.id });
                  }}
                  label={t(skin.labelKey)}
                  description={t(skin.descriptionKey)}
                  preview={
                    <div
                      className={`${styles["appearance-preset-preview"]} ${styles["appearance-preset-preview--skin"]}`}
                      style={skinPreviewStyle}
                    >
                      {skin.compatibleMode !== "both" && <ModeBadge mode={skin.compatibleMode} />}
                    </div>
                  }
                />
              );
            })}
          </div>
        </Field>
      </section>

      {/* ── 极客模式：单 token 精细化定制 ── */}
      <section className="settings-section">
        <Field label={t("skin.customTitle")} hint={t("skin.customHint")}>
          <div className={styles["appearance-toggle-group"]}>
            <div className={styles["appearance-toggle-row"]}>
              <span className={styles["appearance-toggle-label"]}>{t("skin.customEnable")}</span>
              <Switch
                checked={settings.skinCustom !== undefined}
                onChange={(on) => {
                  void updateSettings({
                    skinCustom: on ? skinCustomBase : undefined,
                  });
                }}
              />
            </div>

            {settings.skinCustom !== undefined && (
              <div className={styles["appearance-custom-box"]}>
                <SliderField
                  label={t("skin.customRadius")}
                  value={settings.skinCustom.borderRadius ?? skinCustomBase.borderRadius}
                  min={0}
                  max={24}
                  step={1}
                  hint={t("skin.customRadiusHint")}
                  onChange={(value) => {
                    void updateSettings({
                      skinCustom: { ...settings.skinCustom, borderRadius: value },
                    });
                  }}
                />

                <SliderField
                  label={t("skin.customFontSize")}
                  value={settings.skinCustom.fontSize ?? skinCustomBase.fontSize}
                  min={12}
                  max={16}
                  step={1}
                  hint={t("skin.customFontSizeHint")}
                  onChange={(value) => {
                    void updateSettings({
                      skinCustom: { ...settings.skinCustom, fontSize: value },
                    });
                  }}
                />

                <SliderField
                  label={t("skin.customControlHeight")}
                  value={settings.skinCustom.controlHeight ?? skinCustomBase.controlHeight}
                  min={24}
                  max={40}
                  step={2}
                  hint={t("skin.customControlHeightHint")}
                  onChange={(value) => {
                    void updateSettings({
                      skinCustom: { ...settings.skinCustom, controlHeight: value },
                    });
                  }}
                />

                <SliderField
                  label={t("skin.customBorderWidth")}
                  value={settings.skinCustom.borderWidth ?? skinCustomBase.borderWidth}
                  min={0.5}
                  max={2}
                  step={0.5}
                  hint={t("skin.customBorderWidthHint")}
                  onChange={(value) => {
                    void updateSettings({
                      skinCustom: { ...settings.skinCustom, borderWidth: value },
                    });
                  }}
                />

                <div className={styles["appearance-slider-group"]}>
                  <div className={styles["appearance-toggle-row"]}>
                    <span className={styles["appearance-slider-label"]}>
                      {t("skin.customColorPrimary")}
                    </span>
                    <ColorPicker
                      value={settings.skinCustom.colorPrimary ?? skinCustomBase.colorPrimary}
                      size="small"
                      showText
                      onChange={(c) => {
                        void updateSettings({
                          skinCustom: { ...settings.skinCustom, colorPrimary: c.toHexString() },
                        });
                      }}
                    />
                  </div>
                  <div className={styles["appearance-slider-hint"]}>
                    {t("skin.customColorPrimaryHint")}
                  </div>
                </div>

                <Button
                  size="small"
                  onClick={() => {
                    void updateSettings({ skinCustom: undefined });
                  }}
                >
                  {t("skin.customReset")}
                </Button>
              </div>
            )}
          </div>
        </Field>
      </section>

      {/* ── 语言选择 ── */}
      <section className="settings-section">
        <Field label={t("settings.language")}>
          <Select
            value={settings.language}
            onChange={(v) => {
              void updateSettings({ language: v });
            }}
            className="settings-control-full"
            options={[
              { value: "zh-CN", label: "中文" },
              { value: "en", label: "English" },
            ]}
          />
        </Field>
      </section>

      {/* ══════════════════════════════════════════
          背景定制区
          ══════════════════════════════════════════ */}
      <Divider className={styles["appearance-divider"]}>{t("bg.sectionTitle")}</Divider>

      {/* ── 渐变背景预设 ── */}
      <section className="settings-section">
        <Field label={t("gradient.title")} hint={t("gradient.hint")}>
          <div className={styles["appearance-gradient-grid"]}>
            {GRADIENT_PRESETS.map((preset) => {
              const isSelected = settings.gradientPreset === preset.id;
              const previewBg =
                preset.id === "custom" && settings.customGradient
                  ? isDark && settings.customGradient.darkStops
                    ? buildGradient(
                        settings.customGradient.darkStops,
                        settings.customGradient.darkAngle ?? settings.customGradient.angle,
                      )
                    : buildGradient(settings.customGradient.stops, settings.customGradient.angle)
                  : isDark
                    ? preset.dark
                    : preset.light;
              const gradientPreviewStyle: React.CSSProperties = cssVars({
                "--appearance-preview-bg": previewBg,
                "--appearance-edit-icon": isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.4)",
              });
              return (
                <Button
                  htmlType="button"
                  onClick={() => {
                    void updateSettings({ gradientPreset: preset.id });
                    if (preset.id === "custom") setShowGradientEditor(true);
                  }}
                  className={`appearance-preset-card${isSelected ? " is-selected" : ""}`}
                >
                  <div
                    className={`${styles["appearance-preset-preview"]} ${styles["appearance-preset-preview--gradient"]} ${styles["appearance-preview-editable"]}`}
                    style={gradientPreviewStyle}
                  >
                    {preset.compatibleMode !== "both" && <ModeBadge mode={preset.compatibleMode} />}
                    {preset.id === "custom" && (
                      <Pencil
                        size={ICON_SIZE.LARGE}
                        className={styles["appearance-preset-edit-icon"]}
                      />
                    )}
                  </div>
                  <div
                    className={`appearance-preset-label-only${isSelected ? " is-selected" : ""}`}
                  >
                    {t(preset.labelKey)}
                  </div>
                </Button>
              );
            })}
          </div>

          {/* 自定义渐变编辑器 */}
          {settings.gradientPreset === "custom" && (
            <div className={styles["appearance-editor-shell"]}>
              <div className={styles["appearance-editor-header"]}>
                <span className={styles["appearance-editor-title"]}>
                  <Pencil size={ICON_SIZE.MEDIUM} className={styles["appearance-editor-icon"]} />
                  {t("gradient.customEditor")}
                </span>
                <Button
                  size="small"
                  type={showGradientEditor ? "default" : "link"}
                  icon={showGradientEditor ? undefined : <Pencil size={ICON_SIZE.MEDIUM} />}
                  onClick={() => setShowGradientEditor(!showGradientEditor)}
                >
                  {showGradientEditor ? t("gradient.collapseEditor") : t("gradient.expandEditor")}
                </Button>
              </div>

              <div
                className={`appearance-editor-preview${showGradientEditor ? "" : " is-collapsed"}`}
                style={customPreviewStyle}
              />

              {showGradientEditor && (
                <>
                  <SliderField
                    label={t("gradient.angle")}
                    value={customGradient.angle}
                    min={0}
                    max={360}
                    step={1}
                    suffix="°"
                    hint=""
                    onChange={(value) => updateCustomGradient({ angle: value })}
                  />

                  <div className={styles["appearance-editor-stops"]}>
                    {customGradient.stops.map((stop, i) => (
                      <div key={i} className={styles["appearance-editor-stop"]}>
                        <ColorPicker
                          size="small"
                          value={stop.color}
                          onChangeComplete={(color) => {
                            const newStops = [...customGradient.stops];
                            const target = newStops[i];
                            if (!target) return;
                            newStops[i] = { ...target, color: color.toHexString() };
                            updateCustomGradient({ stops: newStops });
                          }}
                        />
                        <Slider
                          min={0}
                          max={100}
                          value={Math.round(stop.position * 100)}
                          onChange={(v) => {
                            const newStops = [...customGradient.stops];
                            const target = newStops[i];
                            if (!target) return;
                            newStops[i] = { ...target, position: v / 100 };
                            updateCustomGradient({ stops: newStops });
                          }}
                          className={styles["appearance-editor-slider"]}
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
                      onClick={() => {
                        const lastPos =
                          customGradient.stops[customGradient.stops.length - 1]?.position ?? 0.5;
                        const newPos = Math.min(1, lastPos + 0.15);
                        updateCustomGradient({
                          stops: [...customGradient.stops, { color: "#888888", position: newPos }],
                        });
                      }}
                    >
                      {t("gradient.addStop")}
                    </Button>
                  )}

                  <div className={styles["appearance-editor-dark"]}>
                    <div className={styles["appearance-editor-note"]}>
                      {t("gradient.darkModeConfig")}
                    </div>
                    <div className={styles["appearance-editor-toggle-row"]}>
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
                      <span className={styles["appearance-mode-note"]}>
                        {t("gradient.independentDark")}
                      </span>
                    </div>

                    {customGradient.darkStops && (
                      <div className={styles["appearance-editor-toggle-group"]}>
                        {customGradient.darkStops.map((stop, i) => (
                          <div key={i} className={styles["appearance-editor-stop-dark"]}>
                            <ColorPicker
                              size="small"
                              value={stop.color}
                              onChangeComplete={(color) => {
                                const newStops = [...(customGradient.darkStops ?? [])];
                                const target = newStops[i];
                                if (!target) return;
                                newStops[i] = { ...target, color: color.toHexString() };
                                updateCustomGradient({ darkStops: newStops });
                              }}
                            />
                            <Slider
                              min={0}
                              max={100}
                              value={Math.round(stop.position * 100)}
                              onChange={(v) => {
                                const newStops = [...(customGradient.darkStops ?? [])];
                                const target = newStops[i];
                                if (!target) return;
                                newStops[i] = { ...target, position: v / 100 };
                                updateCustomGradient({ darkStops: newStops });
                              }}
                              className={styles["appearance-editor-slider"]}
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
      </section>

      {/* ── 自定义背景图 ── */}
      <section className="settings-section">
        <Field label={t("bg.imageTitle")} hint={t("bg.imageHint")}>
          <Space direction="vertical" size={8} className="settings-control-full">
            <Input
              placeholder={t("bg.imageUrlPlaceholder")}
              value={settings.backgroundImage?.url ?? ""}
              onChange={(e) => updateBgImage({ url: e.target.value })}
              suffix={
                settings.backgroundImage?.url ? (
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<Trash2 size={ICON_SIZE.MEDIUM} />}
                    onClick={() => {
                      void updateSettings({ backgroundImage: undefined });
                    }}
                  />
                ) : (
                  <Image size={ICON_SIZE.MEDIUM} className={styles["appearance-muted-icon"]} />
                )
              }
            />
            <div className={styles["appearance-fit-row"]}>
              <Upload
                beforeUpload={(file) => {
                  handleFileUpload(file);
                  return false; // 阻止自动上传
                }}
                showUploadList={false}
                accept="image/*"
              >
                <Button size="small" icon={<Image size={ICON_SIZE.MEDIUM} />}>
                  {t("bg.uploadImage")}
                </Button>
              </Upload>
              {settings.backgroundImage?.url && (
                <Select
                  size="small"
                  value={settings.backgroundImage.fit}
                  onChange={(v) => updateBgImage({ fit: v })}
                  className={styles["appearance-fit-select"]}
                  options={[
                    { value: "cover", label: t("bg.fitCover") },
                    { value: "contain", label: t("bg.fitContain") },
                    { value: "repeat", label: t("bg.fitRepeat") },
                  ]}
                />
              )}
            </div>
          </Space>
        </Field>
      </section>

      {/* ── 背景遮罩层 ── */}
      <section className="settings-section">
        <Field label={t("bg.overlayTitle")} hint={t("bg.overlayHint")}>
          <Space direction="vertical" size={8} className="settings-control-full">
            <div className={styles["appearance-editor-toggle-row"]}>
              <Switch
                size="small"
                checked={settings.backgroundOverlay?.enabled ?? false}
                onChange={(checked) => updateBgOverlay({ enabled: checked })}
              />
              <span className={styles["appearance-mode-note"]}>{t("bg.overlayEnabled")}</span>
            </div>

            {settings.backgroundOverlay?.enabled && (
              <>
                <div className={styles["appearance-overlay-row"]}>
                  <span className={styles["appearance-color-label"]}>{t("bg.overlayColor")}</span>
                  <ColorPicker
                    size="small"
                    value={
                      isDark
                        ? (settings.backgroundOverlay?.colorDark ?? "rgba(0,0,0,0.6)")
                        : (settings.backgroundOverlay?.color ?? "rgba(0,0,0,0,0.35)")
                    }
                    onChangeComplete={(color) => {
                      const hex = color.toHexString();
                      const rgba = hexToRgba(
                        hex,
                        isDark
                          ? parseAlpha(settings.backgroundOverlay?.colorDark ?? "rgba(0,0,0,0.6)")
                          : parseAlpha(settings.backgroundOverlay?.color ?? "rgba(0,0,0,0,0.35)"),
                      );
                      if (isDark) {
                        updateBgOverlay({ colorDark: rgba });
                      } else {
                        updateBgOverlay({ color: rgba });
                      }
                    }}
                  />
                </div>
                <SliderField
                  label={t("bg.overlayBlur")}
                  value={Math.min(settings.backgroundOverlay?.blur ?? 0, 12)}
                  min={0}
                  max={12}
                  step={1}
                  hint=""
                  onChange={(value) => updateBgOverlay({ blur: value })}
                />
              </>
            )}
          </Space>
        </Field>
      </section>

      {/* ══════════════════════════════════════════
          布局定制区
          ══════════════════════════════════════════ */}
      <Divider className={styles["appearance-divider"]}>{t("layout.sectionTitle")}</Divider>

      {/* ── 布局密度 ── */}
      <section className="settings-section">
        <Field label={t("layout.density")} hint={t("layout.densityHint")}>
          <Select
            value={settings.layoutDensity ?? "default"}
            onChange={(v) => {
              void updateSettings({ layoutDensity: v });
            }}
            className="settings-control-full"
            options={[
              { value: "compact", label: t("layout.densityCompact") },
              { value: "default", label: t("layout.densityDefault") },
              { value: "comfortable", label: t("layout.densityComfortable") },
            ]}
          />
        </Field>
      </section>

      {/* ── 内容区最大宽度 ── */}
      <section className="settings-section">
        <Field label={t("layout.maxWidth")} hint={t("layout.maxWidthHint")}>
          <div className={styles["appearance-width-row"]}>
            <InputNumber
              min={0}
              max={3000}
              step={40}
              value={settings.contentMaxWidth ?? 0}
              onChange={(v) => {
                void updateSettings({ contentMaxWidth: v ?? 0 });
              }}
              className={styles["appearance-width-input"]}
            />
            <span className={styles["appearance-width-unit"]}>px</span>
            <span className={styles["appearance-width-note"]}>({t("layout.maxWidthZero")})</span>
          </div>
        </Field>
      </section>

      {/* ══════════════════════════════════════════
          动效与无障碍
          ══════════════════════════════════════════ */}
      <Divider className={styles["appearance-divider"]}>{t("a11y.sectionTitle")}</Divider>

      {/* ── 减弱动效 ── */}
      <section className="settings-section">
        <Field label={t("a11y.reducedMotion")} hint={t("a11y.reducedMotionHint")}>
          <Select
            value={settings.reducedMotion ?? "auto"}
            onChange={(v) => {
              void updateSettings({ reducedMotion: v });
            }}
            className="settings-control-full"
            options={[
              { value: "auto", label: t("a11y.reducedMotionAuto") },
              { value: "on", label: t("a11y.reducedMotionOn") },
              { value: "off", label: t("a11y.reducedMotionOff") },
            ]}
          />
        </Field>
      </section>

      {/* ── 点击动效（v1.2） ──
          5 套预设：涟漪 / 星光 / 彩纸 / 樱花 / 关闭；
          按需 chunk，默认 'off' 不会拉取 canvas 代码。 */}
      <section className="settings-section">
        <Field label={t("effects.clickEffect")} hint={t("effects.clickEffectHint")}>
          <Select
            value={settings.clickEffect ?? "off"}
            onChange={(v) => {
              void updateSettings({ clickEffect: v });
            }}
            className="settings-control-full"
            options={[
              { value: "off", label: t("effects.clickOff") },
              { value: "ripple", label: t("effects.clickRipple") },
              { value: "sparkle", label: t("effects.clickSparkle") },
              { value: "confetti", label: t("effects.clickConfetti") },
              { value: "petal", label: t("effects.clickPetal") },
            ]}
          />
        </Field>
      </section>

      {/* ── 视频背景（v1.2） ──
          支持 URL 或本地文件（IndexedDB 持久化）；速率可调；
          提示视频会占用更多内存/电量，用户按需开启。 */}
      <section className="settings-section">
        <Field label={t("effects.videoBg")} hint={t("effects.videoBgHint")}>
          <Select
            value={settings.videoBackground?.type ?? "none"}
            onChange={(v) => {
              void (async () => {
                if (v === "none") {
                  // 同时清掉已存的文件，避免 IndexedDB 残留
                  const old = settings.videoBackground?.fileKey;
                  if (typeof old === "string" && old !== "") {
                    const { removeVideoFile } = await import("@/features/effects");
                    await removeVideoFile(old).catch(() => undefined);
                  }
                  void updateSettings({ videoBackground: { type: "none" } });
                  return;
                }
                void updateSettings({
                  videoBackground: { ...(settings.videoBackground ?? {}), type: v },
                });
              })();
            }}
            className="settings-control-full"
            options={[
              { value: "none", label: t("effects.videoBgNone") },
              { value: "url", label: t("effects.videoBgUrl") },
              { value: "file", label: t("effects.videoBgFile") },
            ]}
          />
        </Field>
      </section>

      {settings.videoBackground?.type === "url" && (
        <section className="settings-section">
          <Field label={t("effects.videoBgUrlLabel")} hint={t("effects.videoBgUrlHint")}>
            <Input
              placeholder="https://example.com/bg.mp4"
              value={settings.videoBackground.src ?? ""}
              onChange={(e) =>
                void updateSettings({
                  videoBackground: {
                    ...(settings.videoBackground ?? {}),
                    type: "url",
                    src: e.target.value,
                  },
                })
              }
            />
          </Field>
        </section>
      )}

      {settings.videoBackground?.type === "file" && (
        <section className="settings-section">
          <Field label={t("effects.videoBgFileLabel")} hint={t("effects.videoBgFileHint")}>
            <Upload
              accept="video/mp4,video/webm"
              showUploadList={false}
              beforeUpload={(file) => {
                void (async () => {
                  if (file.size > MAX_VIDEO_BACKGROUND_FILE_BYTES) {
                    void message.warning("视频不能超过 50MB");
                    return;
                  }
                  if (file.type !== "" && !["video/mp4", "video/webm"].includes(file.type)) {
                    void message.warning("请选择 MP4 或 WebM 视频");
                    return;
                  }
                  const { saveVideoFile, removeVideoFile } = await import("@/features/effects");
                  // 先清掉旧文件（若有），避免 IndexedDB 里积灰
                  const old = settings.videoBackground?.fileKey;
                  if (typeof old === "string" && old !== "") {
                    await removeVideoFile(old).catch(() => undefined);
                  }
                  const key = await saveVideoFile(file);
                  void updateSettings({
                    videoBackground: {
                      ...(settings.videoBackground ?? {}),
                      type: "file",
                      fileKey: key,
                    },
                  });
                })();
                return false; // 禁止 antd 自己上传
              }}
            >
              <Button icon={<Image size={ICON_SIZE.MEDIUM} />}>
                {settings.videoBackground.fileKey !== undefined &&
                settings.videoBackground.fileKey !== ""
                  ? t("effects.videoBgFileChange")
                  : t("effects.videoBgFileSelect")}
              </Button>
            </Upload>
          </Field>
        </section>
      )}

      {settings.videoBackground?.type !== undefined && settings.videoBackground.type !== "none" && (
        <section className="settings-section">
          <Field label={t("effects.videoBgRate")} hint={t("effects.videoBgRateHint")}>
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
              marks={{ 0.5: "0.5×", 1: "1×", 1.5: "1.5×", 2: "2×" }}
            />
          </Field>
        </section>
      )}

      {/* ══════════════════════════════════════════
          UI 区域显隐
          ══════════════════════════════════════════ */}
      <Divider className={styles["appearance-divider"]}>{t("uiVisibility.sectionTitle")}</Divider>

      <section className="settings-section">
        <Field label={t("uiVisibility.sectionTitle")} hint={t("uiVisibility.hint")}>
          <Space direction="vertical" size={10} className="settings-control-full">
            {(
              [
                ["header", t("uiVisibility.header"), t("uiVisibility.headerHint")],
                ["heroLogo", t("uiVisibility.heroLogo"), t("uiVisibility.heroLogoHint")],
                ["heroTitle", t("uiVisibility.heroTitle"), t("uiVisibility.heroTitleHint")],
                ["heroSlogan", t("uiVisibility.heroSlogan"), t("uiVisibility.heroSloganHint")],
                ["heroSearch", t("uiVisibility.heroSearch"), t("uiVisibility.heroSearchHint")],
                [
                  "viewSwitcher",
                  t("uiVisibility.viewSwitcher"),
                  t("uiVisibility.viewSwitcherHint"),
                ],
                [
                  "tidySuggestion",
                  t("uiVisibility.tidySuggestion"),
                  t("uiVisibility.tidySuggestionHint"),
                ],
                ["quickStart", t("uiVisibility.quickStart"), t("uiVisibility.quickStartHint")],
              ] as const
            ).map(([key, label, hint]) => (
              <VisibilityRow
                key={key}
                label={label}
                hint={hint}
                checked={settings.uiVisibility?.[key] !== false}
                onChange={(v) => updateUiVisibility(key, v)}
              />
            ))}
            {/* 常用站点分组开关 — 仅在 quickStart 可见时展示 */}
            {settings.uiVisibility?.quickStart !== false && (
              <>
                <VisibilityRow
                  label={t("speedDialGroupEnabled")}
                  hint={t("speedDialGroupEnabledHint")}
                  checked={settings.speedDialGroupEnabled ?? false}
                  onChange={(v) => void updateSettings({ speedDialGroupEnabled: v })}
                />
                <VisibilityRow
                  label={t("quickStart.showAddButton")}
                  hint={t("quickStart.showAddButtonHint")}
                  checked={settings.showAddSiteButton ?? true}
                  onChange={(v) => void updateSettings({ showAddSiteButton: v })}
                />
                {/* 卡片尺寸：sm / md / lg / auto，便于适应不同站点数量与屏幕宽度 */}
                <div className={styles["appearance-visibility-row"]}>
                  <div>
                    <div className={styles["appearance-visibility-title"]}>
                      {t("quickStart.cardSize")}
                    </div>
                    <div className={styles["appearance-visibility-hint"]}>
                      {t("quickStart.cardSizeHint")}
                    </div>
                  </div>
                  <Select
                    size="small"
                    className={styles["appearance-quickstart-select"]}
                    value={settings.quickStartCardSize ?? "md"}
                    onChange={(v) => void updateSettings({ quickStartCardSize: v })}
                    options={[
                      { value: "sm", label: t("quickStart.cardSizeSm") },
                      { value: "md", label: t("quickStart.cardSizeMd") },
                      { value: "lg", label: t("quickStart.cardSizeLg") },
                      { value: "auto", label: t("quickStart.cardSizeAuto") },
                    ]}
                  />
                </div>
              </>
            )}
          </Space>
        </Field>
      </section>
    </div>
  );
}

/**
 * 将 HEX 色值暗化指定比例
 * 支持 3 位简写（#fff）、6 位（#ffffff）、8位（#ffffffaa，忽略 alpha）
 */
function darkenHex(hex: string, ratio: number): string {
  // 移除 # 前缀
  let h = hex.replace("#", "");

  // 处理 3 位简写（如 #fff → #ffffff）
  if (h.length === 3) {
    h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
  }

  // 处理 8 位 hex（带 alpha），忽略 alpha 部分
  if (h.length === 8) {
    h = h.slice(0, 6);
  }

  // 校验长度，无法解析时返回原值
  if (h.length !== 6) {
    return hex;
  }

  const r = Math.round(parseInt(h.slice(0, 2), 16) * (1 - ratio));
  const g = Math.round(parseInt(h.slice(2, 4), 16) * (1 - ratio));
  const b = Math.round(parseInt(h.slice(4, 6), 16) * (1 - ratio));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * 从 rgba 字符串解析 alpha 值
 */
function parseAlpha(rgba: string): number {
  const match = /[\d.]+(?=\))/.exec(rgba);
  return match ? parseFloat(match[0]) : 0.35;
}

/**
 * HEX + alpha → rgba 字符串
 */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
