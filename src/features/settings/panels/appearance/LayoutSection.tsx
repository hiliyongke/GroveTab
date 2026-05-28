/**
 * LayoutSection — 布局定制区
 *
 * 从 AppearancePanel 拆出，负责：
 *   - 布局密度（紧凑 / 默认 / 宽松）
 *   - 内容区最大宽度
 */

import { Select, InputNumber } from "antd";
import { useT } from "@/shared/i18n";
import type { UserSettings } from "@/shared/types";
import { Field } from "@/features/settings/components/Field";
import styles from "../styles/appearance.module.less";

interface LayoutSectionProps {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void | Promise<void>;
}

export function LayoutSection({ settings, updateSettings }: LayoutSectionProps) {
  const { t } = useT();

  return (
    <>
      {/* ── 布局密度 ── */}
      <section className="settings-section">
        <Field
          label={t("布局密度")}
          hint={t("紧凑：信息密度优先 / 默认：舒适平衡 / 宽松：大屏友好")}
        >
          <Select
            value={settings.layoutDensity ?? "default"}
            onChange={(v) => {
              void updateSettings({ layoutDensity: v });
            }}
            className="settings-control-full"
            options={[
              { value: "compact", label: t("紧凑") },
              { value: "default", label: t("默认") },
              { value: "comfortable", label: t("宽松") },
            ]}
          />
        </Field>
      </section>

      {/* ── 内容区最大宽度 ── */}
      <section className="settings-section">
        <Field label={t("内容区最大宽度")} hint={t("控制卡片区域的最大宽度；设为 0 表示不限制")}>
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
            <span className={styles["appearance-width-note"]}>({t("0 = 不限制")})</span>
          </div>
        </Field>
      </section>
    </>
  );
}
