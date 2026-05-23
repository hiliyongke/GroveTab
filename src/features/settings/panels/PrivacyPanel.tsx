/**
 * PrivacyPanel —— 「隐私 / 历史」设置 Tab
 *
 * 受控于 UserSettings 中的 history* 字段 + 提供"立即清空"的危险区按钮。
 *
 * 关键设计：
 *   - 主开关一旦关闭，下方所有子项全部禁用，UI 给出明显视觉降级（opacity）
 *   - URL 黑名单使用 antd Select mode='tags' 接收 hostname 列表；
 *     用户输入 `mail.google.com` → 该 hostname 及其子域将不被记录
 *   - 危险操作（清空/恢复默认）走 Popconfirm 二次确认；
 *     操作后会用 `feedback` 给出 toast 反馈
 */

import { useState } from "react";
import { Switch, Select, Slider, Button, Popconfirm, Space, Typography } from "antd";
import { Trash2, Eraser } from "lucide-react";

import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import { feedback } from "@/shared/ui/feedback";
import { Field } from "@/features/settings/components/Field";
import { clearAllNativeHistory } from "@/repositories";
import type { UserSettings } from "@/shared/types";

interface PrivacyPanelProps {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void | Promise<void>;
}

/** TTL 候选选项（小时） */
const TTL_OPTIONS: Array<{ value: number; labelKey: string }> = [
  { value: 24, labelKey: "privacy.ttl1d" },
  { value: 72, labelKey: "privacy.ttl3d" },
  { value: 168, labelKey: "privacy.ttl7d" },
  { value: 720, labelKey: "privacy.ttl30d" },
  { value: 0, labelKey: "privacy.ttlForever" },
];

export function PrivacyPanel({ settings, updateSettings }: PrivacyPanelProps) {
  const { t } = useT();
  const [clearing, setClearing] = useState(false);

  const enabled = settings.historyEnabled !== false;
  const recordEvents = settings.historyRecordEvents !== false;
  const maxClosed = settings.historyMaxClosedTabs ?? 50;
  const maxEvents = settings.historyMaxEvents ?? 500;
  const ttlHours = settings.historyClosedTabsTtlHours ?? 168;
  const blocklist = settings.historyUrlBlocklist ?? [];

  const handleClearAll = async () => {
    setClearing(true);
    try {
      await clearAllNativeHistory();
      feedback.success(t("history.cleared"));
    } catch (err) {
      feedback.error(t("history.cleared"), err);
    } finally {
      setClearing(false);
    }
  };

  /** 子项是否禁用：主开关关闭时整体禁用 */
  const disabled = !enabled;

  return (
    <div className="settings-panel-stack">
      {/* ── 主开关 ───────────────────────────────────── */}
      <section className="settings-section">
        <Typography.Title level={3} className="settings-section__title">
          {t("privacy.sectionMaster")}
        </Typography.Title>
        <div className="settings-section__body">
          <Field label={t("privacy.enableHistory")} hint={t("privacy.enableHistoryHint")}>
            <Switch
              checked={enabled}
              onChange={(v) => {
                void updateSettings({ historyEnabled: v });
              }}
            />
          </Field>
          <Field label={t("privacy.recordEvents")} hint={t("privacy.recordEventsHint")}>
            <Switch
              checked={recordEvents}
              disabled={disabled}
              onChange={(v) => {
                void updateSettings({ historyRecordEvents: v });
              }}
            />
          </Field>
        </div>
      </section>

      {/* ── 容量与过期 ────────────────────────────────── */}
      <section className="settings-section" style={{ opacity: disabled ? 0.55 : 1 }}>
        <Typography.Title level={3} className="settings-section__title">
          {t("privacy.sectionCapacity")}
        </Typography.Title>
        <div className="settings-section__body">
          <Field
            label={t("privacy.maxClosedTabs")}
            hint={t("privacy.maxClosedTabsHint", { value: maxClosed })}
          >
            <Slider
              min={10}
              max={500}
              step={10}
              value={maxClosed}
              disabled={disabled}
              onChange={(v) => {
                void updateSettings({ historyMaxClosedTabs: v });
              }}
              marks={{ 10: "10", 50: "50", 200: "200", 500: "500" }}
            />
          </Field>

          <Field
            label={t("privacy.maxEvents")}
            hint={t("privacy.maxEventsHint", { value: maxEvents })}
          >
            <Slider
              min={50}
              max={5000}
              step={50}
              value={maxEvents}
              disabled={disabled || !recordEvents}
              onChange={(v) => {
                void updateSettings({ historyMaxEvents: v });
              }}
              marks={{ 50: "50", 500: "500", 2000: "2k", 5000: "5k" }}
            />
          </Field>

          <Field label={t("privacy.closedTabTtl")} hint={t("privacy.closedTabTtlHint")}>
            <Select
              value={ttlHours}
              disabled={disabled}
              style={{ width: "100%", maxWidth: 280 }}
              onChange={(v) => {
                void updateSettings({ historyClosedTabsTtlHours: v });
              }}
              options={TTL_OPTIONS.map((opt) => ({
                value: opt.value,
                label: t(opt.labelKey),
              }))}
            />
          </Field>
        </div>
      </section>

      {/* ── URL 黑名单 ────────────────────────────────── */}
      <section className="settings-section" style={{ opacity: disabled ? 0.55 : 1 }}>
        <Typography.Title level={3} className="settings-section__title">
          {t("privacy.sectionBlocklist")}
        </Typography.Title>
        <div className="settings-section__body">
          <Field label={t("privacy.urlBlocklist")} hint={t("privacy.urlBlocklistHint")}>
            <Select
              mode="tags"
              value={blocklist}
              disabled={disabled}
              style={{ width: "100%" }}
              placeholder={t("privacy.urlBlocklistPlaceholder")}
              tokenSeparators={[",", " ", "\n"]}
              onChange={(v: string[]) => {
                // 规整：转小写 / 去重 / 去前缀
                const cleaned = Array.from(
                  new Set(
                    v
                      .map((s) =>
                        s
                          .trim()
                          .toLowerCase()
                          .replace(/^https?:\/\//, "")
                          .replace(/\/.*$/, ""),
                      )
                      .filter((s) => s !== ""),
                  ),
                );
                void updateSettings({ historyUrlBlocklist: cleaned });
              }}
            />
          </Field>
        </div>
      </section>

      {/* ── 危险区 ────────────────────────────────────── */}
      <section className="settings-section">
        <Typography.Title level={3} className="settings-section__title">
          {t("privacy.sectionDanger")}
        </Typography.Title>
        <div className="settings-section__body">
          <Field label={t("privacy.clearAll")} hint={t("privacy.clearAllHint")}>
            <Space>
              <Popconfirm
                title={t("history.clearAllConfirm")}
                onConfirm={() => {
                  void handleClearAll();
                }}
                okButtonProps={{ danger: true }}
              >
                <Button danger loading={clearing} icon={<Trash2 size={ICON_SIZE.SMALL} />}>
                  {t("privacy.clearAllButton")}
                </Button>
              </Popconfirm>
              <Popconfirm
                title={t("privacy.resetDefaultsConfirm")}
                onConfirm={() => {
                  void updateSettings({
                    historyEnabled: true,
                    historyRecordEvents: true,
                    historyMaxClosedTabs: 50,
                    historyMaxEvents: 500,
                    historyClosedTabsTtlHours: 168,
                    historyUrlBlocklist: [],
                  });
                  feedback.success(t("privacy.resetDefaultsDone"));
                }}
              >
                <Button icon={<Eraser size={ICON_SIZE.SMALL} />}>
                  {t("privacy.resetDefaults")}
                </Button>
              </Popconfirm>
            </Space>
          </Field>
        </div>
      </section>
    </div>
  );
}

export default PrivacyPanel;
