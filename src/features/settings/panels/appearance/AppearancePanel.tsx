/**
 * AppearancePanel — 外观设置 Tab（主入口）
 *
 * 重构后仅负责编排各子 Section：
 *   - SkinPresetSection：皮肤预设 + 极客模式
 *   - LayoutSection：布局密度 + 内容区宽度
 *   - AnimationSection：动效 + 视频背景
 *   - UiVisibilitySection：区域显隐
 */

import { Select, Divider, Flex } from "antd";
import { useT } from "@/shared/i18n";
import type { UserSettings } from "@/shared/types";
import { Field } from "@/features/settings/components/Field";
import { SkinPresetSection } from "./SkinPresetSection";
import { LayoutSection } from "./LayoutSection";
import { AnimationSection } from "./AnimationSection";
import { UiVisibilitySection } from "./UiVisibilitySection";
import styles from "../styles/appearance.module.less";

interface AppearancePanelProps {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void | Promise<void>;
}

export function AppearancePanel({ settings, updateSettings }: AppearancePanelProps) {
  const { t } = useT();

  return (
    <Flex vertical className={`settings-panel-stack ${styles["appearance-panel"]}`}>
      {/* ── 皮肤 + 极客模式 ── */}
      <SkinPresetSection settings={settings} updateSettings={updateSettings} />

      {/* ── 语言选择 ── */}
      <section className="settings-section">
        <Field label={t("语言")}>
          <Select
            value={settings.language}
            onChange={(v) => {
              void updateSettings({ language: v });
            }}
            className="settings-control-full"
            options={[
              { value: "zh-CN", label: t("中文") },
              { value: "en", label: "English" },
            ]}
          />
        </Field>
      </section>

      {/* ── 布局定制区 ── */}
      <Divider className={styles["appearance-divider"]}>{t("布局定制")}</Divider>
      <LayoutSection settings={settings} updateSettings={updateSettings} />

      {/* ── 动效与无障碍 ── */}
      <Divider className={styles["appearance-divider"]}>{t("动效与无障碍")}</Divider>
      <AnimationSection settings={settings} updateSettings={updateSettings} />

      {/* ── 区域显隐 ── */}
      <Divider className={styles["appearance-divider"]}>{t("区域显隐")}</Divider>
      <UiVisibilitySection settings={settings} updateSettings={updateSettings} />
    </Flex>
  );
}
