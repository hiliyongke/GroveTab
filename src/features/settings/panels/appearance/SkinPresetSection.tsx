/**
 * SkinPresetSection — 皮肤预设选择器 + 极客模式精细定制
 *
 * 从 AppearancePanel 拆出，负责：
 *   - 4 套高级皮肤预设选择
 *   - 极客模式：单 token 精细化定制（圆角/字号/字重/控件高度/边框粗细/品牌主色）
 */

import { Button, ColorPicker, Switch, Flex, Typography } from "antd";
import { cssVars } from "@/shared/utils/css-vars";
import { useT } from "@/shared/i18n";
import { SKIN_PRESETS, DEFAULT_SKIN_PRESET_ID } from "@/shared/theme/skin-presets";
import { getSkinCustomBaseValues } from "@/shared/theme/theme-customization";
import type { UserSettings } from "@/shared/types";
import { Field } from "@/features/settings/components/Field";
import { PresetCard, ModeBadge, SliderField } from "./AppearanceSubComponents";
import styles from "../styles/appearance.module.less";

interface SkinPresetSectionProps {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void | Promise<void>;
}

export function SkinPresetSection({ settings, updateSettings }: SkinPresetSectionProps) {
  const { t } = useT();
  const skinCustomBase = getSkinCustomBaseValues(settings.skinPreset ?? "minimal");

  return (
    <>
      {/* ── 皮肤预设选择器 ── */}
      <section className="settings-section">
        <Field
          label={t("皮肤风格")}
          hint={t("选择一套视觉风格；不同皮肤改变圆角、阴影、色彩、毛玻璃等整体观感")}
        >
          <div className={styles["appearance-grid"]}>
            {SKIN_PRESETS.map((skin) => {
              const isSelected =
                settings.skinPreset === skin.id ||
                (!settings.skinPreset && skin.id === DEFAULT_SKIN_PRESET_ID);
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
        <Field
          label={t("精细定制（极客模式）")}
          hint={t("在当前皮肤基础上覆盖单项 token；关闭开关即可恢复预设")}
        >
          <Flex vertical className={styles["appearance-toggle-group"]}>
            <Flex
              align="center"
              justify="space-between"
              className={styles["appearance-toggle-row"]}
            >
              <Typography.Text className={styles["appearance-toggle-label"]}>
                {t("启用定制")}
              </Typography.Text>
              <Switch
                checked={settings.skinCustom !== undefined}
                onChange={(on) => {
                  void updateSettings({
                    skinCustom: on ? skinCustomBase : undefined,
                  });
                }}
              />
            </Flex>

            {settings.skinCustom !== undefined && (
              <Flex vertical className={styles["appearance-custom-box"]}>
                <SliderField
                  label={t("圆角")}
                  value={settings.skinCustom.borderRadius ?? skinCustomBase.borderRadius}
                  min={0}
                  max={24}
                  step={1}
                  hint={t("控制卡片/按钮/输入框基础圆角，0 为尖角")}
                  onChange={(value) => {
                    void updateSettings({
                      skinCustom: { ...settings.skinCustom, borderRadius: value },
                    });
                  }}
                />

                <SliderField
                  label={t("基础字号")}
                  value={settings.skinCustom.fontSize ?? skinCustomBase.fontSize}
                  min={12}
                  max={16}
                  step={1}
                  hint={t("正文基础字号，影响整站文本密度")}
                  onChange={(value) => {
                    void updateSettings({
                      skinCustom: { ...settings.skinCustom, fontSize: value },
                    });
                  }}
                />

                <SliderField
                  label={t("正文字重")}
                  value={settings.skinCustom.fontWeightBody ?? 400}
                  min={300}
                  max={700}
                  step={100}
                  hint={t("正文字体粗细，300-700 范围")}
                  onChange={(value) => {
                    void updateSettings({
                      skinCustom: { ...settings.skinCustom, fontWeightBody: value },
                    });
                  }}
                />

                <SliderField
                  label={t("标题字重")}
                  value={settings.skinCustom.fontWeightHeading ?? 600}
                  min={400}
                  max={800}
                  step={100}
                  hint={t("标题字体粗细，较高更有视觉层级感")}
                  onChange={(value) => {
                    void updateSettings({
                      skinCustom: { ...settings.skinCustom, fontWeightHeading: value },
                    });
                  }}
                />

                <SliderField
                  label={t("控件高度")}
                  value={settings.skinCustom.controlHeight ?? skinCustomBase.controlHeight}
                  min={24}
                  max={40}
                  step={2}
                  hint={t("较矮更紧凑，较高更舒适")}
                  onChange={(value) => {
                    void updateSettings({
                      skinCustom: { ...settings.skinCustom, controlHeight: value },
                    });
                  }}
                />

                <SliderField
                  label={t("边框粗细")}
                  value={settings.skinCustom.borderWidth ?? skinCustomBase.borderWidth}
                  min={0.5}
                  max={2}
                  step={0.5}
                  hint={t("线条粗细，0.5 / 1 / 1.5 / 2px")}
                  onChange={(value) => {
                    void updateSettings({
                      skinCustom: { ...settings.skinCustom, borderWidth: value },
                    });
                  }}
                />

                <div className={styles["appearance-slider-group"]}>
                  <div className={styles["appearance-toggle-row"]}>
                    <span className={styles["appearance-slider-label"]}>{t("品牌主色")}</span>
                    <ColorPicker
                      value={settings.skinCustom.colorPrimary ?? skinCustomBase.colorPrimary}
                      showText
                      onChange={(c) => {
                        void updateSettings({
                          skinCustom: { ...settings.skinCustom, colorPrimary: c.toHexString() },
                        });
                      }}
                    />
                  </div>
                  <div className={styles["appearance-slider-hint"]}>
                    {t("覆盖皮肤预设的主色；用于按钮、链接、选中态")}
                  </div>
                </div>

                <Button
                  onClick={() => {
                    void updateSettings({ skinCustom: undefined });
                  }}
                >
                  {t("恢复默认")}
                </Button>
              </Flex>
            )}
          </Flex>
        </Field>
      </section>
    </>
  );
}
