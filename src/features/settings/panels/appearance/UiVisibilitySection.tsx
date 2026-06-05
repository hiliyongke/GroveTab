/**
 * UiVisibilitySection — UI 区域显隐
 *
 * 从 AppearancePanel 拆出，负责：
 *   - 顶栏 / 搜索框 / 视图切换 / 概览 / 整理建议等区域显隐控制
 *   - 常用站点分组开关、卡片尺寸、网格间距、auto 档位阈值
 *   - 网格视图卡片尺寸
 */

import { useCallback } from "react";
import { Select, Space } from "antd";
import { useT } from "@/shared/i18n";
import type { UserSettings } from "@/shared/types";
import { Field } from "@/features/settings/components/Field";
import { VisibilityRow, SliderField } from "./AppearanceSubComponents";
import styles from "../styles/appearance.module.less";

interface UiVisibilitySectionProps {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void | Promise<void>;
}

export function UiVisibilitySection({ settings, updateSettings }: UiVisibilitySectionProps) {
  const { t } = useT();

  /** 安全更新 uiVisibility */
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

  return (
    <section className="settings-section">
      <Field label={t("区域显隐")} hint={t("隐藏不需要的区域，打造极简界面")}>
        <Space vertical size={10} className="settings-control-full">
          {(
            [
              ["header", t("顶栏"), t("品牌标识 + 归档/主题/设置按钮")],
              ["heroLogo", t("品牌 Logo"), t("Hero 区左侧树形图标")],
              ["heroTitle", t("品牌标题"), t('Hero 区主标题，如"林栖标签页"')],
              ["heroSlogan", t("品牌副标题"), t('Hero 区口号文案，如"你的标签页，找到归属"')],
              ["heroSearch", t("搜索框"), t("居中大号搜索框 + 视图切换")],
              ["viewSwitcher", t("视图切换"), t("域名/时间轴/紧凑等视图标签行")],
              ["tidySuggestion", t("整理建议"), t("重复标签/闲置标签智能整理建议栏")],
              ["quickStart", t("常用站点"), t("首页常用站点快捷入口")],
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
                label={t("显示添加按钮")}
                hint={t("隐藏后可通过设置页添加常用站点")}
                checked={settings.showAddSiteButton ?? true}
                onChange={(v) => void updateSettings({ showAddSiteButton: v })}
              />
              {settings.speedDialGroupEnabled && (
                <VisibilityRow
                  label={t("分组可折叠")}
                  hint={t("点击组头折叠/展开分组内容")}
                  checked={settings.quickStartGroupCollapsible ?? true}
                  onChange={(v) => void updateSettings({ quickStartGroupCollapsible: v })}
                />
              )}
              <VisibilityRow
                label={t("浮动添加按钮")}
                hint={t("在右下角显示悬浮的添加按钮，快捷键 Ctrl+Shift+A / ⌘+Shift+A")}
                checked={settings.quickStartFabAddButton ?? false}
                onChange={(v) => void updateSettings({ quickStartFabAddButton: v })}
              />

              {/* 卡片尺寸 */}
              <div className={styles["appearance-visibility-row"]}>
                <div>
                  <div className={styles["appearance-visibility-title"]}>{t("卡片大小")}</div>
                  <div className={styles["appearance-visibility-hint"]}>
                    {t("选择常用站点卡片的尺寸，自动模式会随屏幕宽度自适应")}
                  </div>
                </div>
                <Select
                  size="small"
                  className={styles["appearance-quickstart-select"]}
                  value={settings.quickStartCardSize ?? "md"}
                  onChange={(v) => void updateSettings({ quickStartCardSize: v })}
                  options={[
                    { value: "sm", label: t("紧凑") },
                    { value: "md", label: t("默认") },
                    { value: "lg", label: t("宽松") },
                    { value: "auto", label: t("自适应") },
                    { value: "custom", label: t("自定义") },
                  ]}
                />
              </div>

              {(settings.quickStartCardSize ?? "md") === "custom" && (
                <SliderField
                  label={t("卡片宽度")}
                  value={settings.quickStartCardExactWidth ?? 160}
                  min={80}
                  max={280}
                  step={8}
                  hint={t("仅在卡片大小选择自定义时生效（80–280px）")}
                  onChange={(value) => {
                    void updateSettings({ quickStartCardExactWidth: value });
                  }}
                />
              )}

              {/* 网格间距 */}
              <SliderField
                label={t("网格间距")}
                value={settings.quickStartGridGap ?? 12}
                min={4}
                max={24}
                step={4}
                suffix="px"
                hint={t("控制卡片之间的水平与垂直间距（4–24px），默认 12px")}
                onChange={(value) => {
                  void updateSettings({ quickStartGridGap: value });
                }}
              />

              {/* auto 档位阈值配置 */}
              {(settings.quickStartCardSize ?? "md") === "auto" && (
                <>
                  <SliderField
                    label={t("auto→lg 阈值")}
                    value={settings.quickStartAutoThresholds?.lgThreshold ?? 6}
                    min={1}
                    max={30}
                    step={1}
                    hint={t("站点数 ≤ 此值时使用 lg 卡片尺寸（默认 6）")}
                    onChange={(value) => {
                      void updateSettings({
                        quickStartAutoThresholds: {
                          ...settings.quickStartAutoThresholds,
                          lgThreshold: value,
                        },
                      });
                    }}
                  />
                  <SliderField
                    label={t("auto→md 阈值")}
                    value={settings.quickStartAutoThresholds?.mdThreshold ?? 14}
                    min={1}
                    max={50}
                    step={1}
                    hint={t("站点数 ≤ 此值时使用 md 卡片尺寸（默认 14），超过则使用 sm")}
                    onChange={(value) => {
                      void updateSettings({
                        quickStartAutoThresholds: {
                          ...settings.quickStartAutoThresholds,
                          mdThreshold: value,
                        },
                      });
                    }}
                  />
                </>
              )}

              {/* 网格视图卡片尺寸 */}
              <div className={styles["appearance-visibility-row"]}>
                <div>
                  <div className={styles["appearance-visibility-title"]}>{t("卡片大小")}</div>
                  <div className={styles["appearance-visibility-hint"]}>
                    {t("选择网格视图卡片的尺寸，自动模式会根据标签页数量自适应")}
                  </div>
                </div>
                <Select
                  size="small"
                  className={styles["appearance-quickstart-select"]}
                  value={settings.gridCardSize ?? "md"}
                  onChange={(v) => void updateSettings({ gridCardSize: v })}
                  options={[
                    { value: "sm", label: t("紧凑") },
                    { value: "md", label: t("默认") },
                    { value: "lg", label: t("宽松") },
                    { value: "auto", label: t("自适应") },
                  ]}
                />
              </div>
            </>
          )}
        </Space>
      </Field>
    </section>
  );
}
