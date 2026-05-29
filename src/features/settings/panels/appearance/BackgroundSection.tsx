/**
 * BackgroundSection — 背景定制区
 *
 * 从 AppearancePanel 拆出，负责：
 *   - 渐变背景预设选择 + 自定义渐变编辑器
 *   - 自定义背景图（URL / 文件上传 + 填充模式）
 *   - 背景遮罩层（颜色 + 模糊度）
 */

import { useState, useCallback } from "react";
import { Button, Slider, ColorPicker, Switch, Input, Upload, Select, Space } from "antd";
import { Image, Trash2 } from "lucide-react";
import { cssVars } from "@/shared/utils/css-vars";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import { feedback } from "@/shared/ui/feedback";
import { useResolvedTheme } from "@/shared/hooks";
import { GRADIENT_PRESETS, buildGradient } from "@/shared/theme/gradient-presets";
import { BRAND } from "@/shared/config/brand";
import type { UserSettings } from "@/shared/types";
import { Field } from "@/features/settings/components/Field";
import { ModeBadge, SliderField, Pencil, Plus, MinusCircle } from "./AppearanceSubComponents";
import { optimizeBackgroundImage, darkenHex, parseAlpha, hexToRgba } from "./appearance-utils";
import styles from "../styles/appearance.module.less";

interface BackgroundSectionProps {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void | Promise<void>;
}

export function BackgroundSection({ settings, updateSettings }: BackgroundSectionProps) {
  const { t } = useT();
  const isDark = useResolvedTheme() === "dark";
  const [showGradientEditor, setShowGradientEditor] = useState(false);

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

  /** 处理文件上传：先压缩降采样，再写入背景图配置。 */
  const handleFileUpload = useCallback(
    (file: File) => {
      void optimizeBackgroundImage(file)
        .then((dataUrl) => updateBgImage({ url: dataUrl }))
        .catch((err) => {
          console.warn(`${BRAND.logTag} background image optimize failed`, err);
          const raw = err instanceof Error ? err.message : String(err);
          const msg = raw.startsWith("i18n:") ? t(raw.slice(5)) : raw;
          void feedback.warning(msg);
        });
    },
    [updateBgImage],
  );

  return (
    <>
      {/* ── 渐变背景预设 ── */}
      <section className="settings-section">
        <Field
          label={t("背景主题")}
          hint={t("选择页面背景风格；带 ☀ 标记的适合浅色模式，带 🌙 标记的适合深色模式")}
        >
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
                  key={preset.id}
                  htmlType="button"
                  onClick={() => {
                    void updateSettings({ gradientPreset: preset.id });
                    if (preset.id === "custom") setShowGradientEditor(true);
                  }}
                  className={`${styles["appearance-preset-card"]}${isSelected ? ` ${styles["is-selected"]}` : ""}`}
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
                    className={`${styles["appearance-preset-label-only"]}${isSelected ? ` ${styles["is-selected"]}` : ""}`}
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
                  {t("自定义渐变编辑器")}
                </span>
                <Button
                  size="small"
                  type={showGradientEditor ? "default" : "link"}
                  icon={showGradientEditor ? undefined : <Pencil size={ICON_SIZE.MEDIUM} />}
                  onClick={() => setShowGradientEditor(!showGradientEditor)}
                >
                  {showGradientEditor ? t("收起") : t("编辑")}
                </Button>
              </div>

              <div
                className={`${styles["appearance-editor-preview"]}${showGradientEditor ? "" : ` ${styles["is-collapsed"]}`}`}
                style={customPreviewStyle}
              />

              {showGradientEditor && (
                <>
                  <SliderField
                    label={t("角度")}
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
                      <div
                        key={`${stop.color}-${stop.position}`}
                        className={styles["appearance-editor-stop"]}
                      >
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
                      {t("添加色标")}
                    </Button>
                  )}

                  <div className={styles["appearance-editor-dark"]}>
                    <div className={styles["appearance-editor-note"]}>{t("深色模式配置")}</div>
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
                        {t("独立深色模式配色")}
                      </span>
                    </div>

                    {customGradient.darkStops && (
                      <div className={styles["appearance-editor-toggle-group"]}>
                        {customGradient.darkStops.map((stop, i) => (
                          <div
                            key={`${stop.color}-${stop.position}`}
                            className={styles["appearance-editor-stop-dark"]}
                          >
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
        <Field
          label={t("自定义背景图")}
          hint={t("上传图片或粘贴 URL；背景图叠加在渐变之上，渐变作为 fallback")}
        >
          <Space direction="vertical" size={8} className="settings-control-full">
            <Input
              placeholder={t("粘贴图片 URL（https://... 或 data:image/...）")}
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
                  return false;
                }}
                showUploadList={false}
                accept="image/*"
              >
                <Button size="small" icon={<Image size={ICON_SIZE.MEDIUM} />}>
                  {t("上传图片")}
                </Button>
              </Upload>
              {settings.backgroundImage?.url && (
                <Select
                  size="small"
                  value={settings.backgroundImage.fit}
                  onChange={(v) => updateBgImage({ fit: v })}
                  className={styles["appearance-fit-select"]}
                  options={[
                    { value: "cover", label: t("铺满裁切") },
                    { value: "contain", label: t("完整显示") },
                    { value: "repeat", label: t("平铺") },
                  ]}
                />
              )}
            </div>
          </Space>
        </Field>
      </section>

      {/* ── 背景遮罩层 ── */}
      <section className="settings-section">
        <Field
          label={t("背景遮罩")}
          hint={t("在背景上叠加半透明遮罩层，让文字在复杂背景上保持可读")}
        >
          <Space direction="vertical" size={8} className="settings-control-full">
            <div className={styles["appearance-editor-toggle-row"]}>
              <Switch
                size="small"
                checked={settings.backgroundOverlay?.enabled ?? false}
                onChange={(checked) => updateBgOverlay({ enabled: checked })}
              />
              <span className={styles["appearance-mode-note"]}>{t("启用遮罩层")}</span>
            </div>

            {settings.backgroundOverlay?.enabled && (
              <>
                <div className={styles["appearance-overlay-row"]}>
                  <span className={styles["appearance-color-label"]}>{t("遮罩颜色")}</span>
                  <ColorPicker
                    size="small"
                    value={
                      isDark
                        ? (settings.backgroundOverlay?.colorDark ?? "rgba(0,0,0,0.6)")
                        : (settings.backgroundOverlay?.color ?? "rgba(0,0,0,0.35)")
                    }
                    onChangeComplete={(color) => {
                      const hex = color.toHexString();
                      const rgba = hexToRgba(
                        hex,
                        isDark
                          ? parseAlpha(settings.backgroundOverlay?.colorDark ?? "rgba(0,0,0,0.6)")
                          : parseAlpha(settings.backgroundOverlay?.color ?? "rgba(0,0,0,0.35)"),
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
                  label={t("背景模糊")}
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
    </>
  );
}
