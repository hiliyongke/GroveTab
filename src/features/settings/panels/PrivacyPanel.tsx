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

import { useMemo, useState } from "react";
import { Switch, Select, Slider, Button, Popconfirm, Space, Typography, Flex } from "antd";
import styles from "./PrivacyPanel.module.less";
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

export function PrivacyPanel({ settings, updateSettings }: PrivacyPanelProps) {
  const { t } = useT();
  const [clearing, setClearing] = useState(false);

  const ttlOptions = useMemo(
    () => [
      { value: 24, label: t("1 天") },
      { value: 72, label: t("3 天") },
      { value: 168, label: t("7 天") },
      { value: 720, label: t("30 天") },
      { value: 0, label: t("永久") },
    ],
    [t],
  );

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
      feedback.success(t("已清空历史记录"));
    } catch (err) {
      feedback.error(t("清空历史记录失败"));
    } finally {
      setClearing(false);
    }
  };

  /** 子项是否禁用：主开关关闭时整体禁用 */
  const disabled = !enabled;

  return (
    <Flex vertical className="settings-panel-stack">
      {/* ── 主开关 ───────────────────────────────────── */}
      <section className="settings-section">
        <Typography.Title level={3} className="settings-section__title">
          {t("总开关")}
        </Typography.Title>
        <Flex vertical className="settings-section__body">
          <Field
            label={t("启用历史记录")}
            hint={t("关闭后将不再记录新的「最近关闭」与操作时间线，已有数据保留可随时清空。")}
          >
            <Switch
              checked={enabled}
              onChange={(v) => {
                void updateSettings({ historyEnabled: v });
              }}
            />
          </Field>
          <Field
            label={t("记录操作时间线")}
            hint={t("关闭后只保留「最近关闭」标签快照，不记录搜索 / 归档 / 打标签等事件。")}
          >
            <Switch
              checked={recordEvents}
              disabled={disabled}
              onChange={(v) => {
                void updateSettings({ historyRecordEvents: v });
              }}
            />
          </Field>
        </Flex>
      </section>

      {/* ── 容量与过期 ────────────────────────────────── */}
      <section className={`settings-section${disabled ? " is-disabled" : ""}`}>
        <Typography.Title level={3} className="settings-section__title">
          {t("容量与过期")}
        </Typography.Title>
        <Flex vertical className="settings-section__body">
          <Field
            label={t("最近关闭最多保留")}
            hint={t("当前 {value} 条；超出后按时间顺序自动淘汰最早记录。", { value: maxClosed })}
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
            label={t("操作时间线最多保留")}
            hint={t("当前 {value} 条；超出后按时间顺序自动淘汰最早记录。", { value: maxEvents })}
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

          <Field
            label={t("最近关闭自动过期")}
            hint={t("超过保留时间的记录将在下次访问时自动清理。")}
          >
            <Select
              value={ttlHours}
              disabled={disabled}
              className={styles["privacy-select-wide"]}
              onChange={(v) => {
                void updateSettings({ historyClosedTabsTtlHours: v });
              }}
              options={ttlOptions.map((opt) => ({
                value: opt.value,
                label: opt.label,
              }))}
            />
          </Field>
        </Flex>
      </section>

      {/* ── URL 黑名单 ────────────────────────────────── */}
      <section className={`settings-section${disabled ? " is-disabled" : ""}`}>
        <Typography.Title level={3} className="settings-section__title">
          {t("URL 黑名单")}
        </Typography.Title>
        <Flex vertical className="settings-section__body">
          <Field
            label={t("不记录的域名")}
            hint={t(
              "命中名单的域名（含子域）不会出现在任何历史记录中。例如：mail.google.com、localhost。",
            )}
          >
            <Select
              mode="tags"
              value={blocklist}
              disabled={disabled}
              className={styles["privacy-select-full"]}
              placeholder={t("输入 hostname 后回车，例如 mail.google.com")}
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
        </Flex>
      </section>

      {/* ── 危险区 ────────────────────────────────────── */}
      <section className="settings-section">
        <Typography.Title level={3} className="settings-section__title">
          {t("危险区")}
        </Typography.Title>
        <Flex vertical className="settings-section__body">
          <Field
            label={t("清空所有历史数据")}
            hint={t("将立即删除全部「最近关闭」「整窗快照」和「操作时间线」，此操作不可撤销。")}
          >
            <Space>
              <Popconfirm
                title={t("确定要清空全部历史记录吗？此操作不可撤销。")}
                onConfirm={() => {
                  void handleClearAll();
                }}
                okButtonProps={{ danger: true }}
              >
                <Button danger loading={clearing} icon={<Trash2 size={ICON_SIZE.SMALL} />}>
                  {t("立即清空")}
                </Button>
              </Popconfirm>
              <Popconfirm
                title={t("将隐私 / 历史相关的所有设置恢复为默认值？")}
                onConfirm={() => {
                  void updateSettings({
                    historyEnabled: true,
                    historyRecordEvents: true,
                    historyMaxClosedTabs: 50,
                    historyMaxEvents: 500,
                    historyClosedTabsTtlHours: 168,
                    historyUrlBlocklist: [],
                  });
                  feedback.success(t("已恢复默认设置"));
                }}
              >
                <Button icon={<Eraser size={ICON_SIZE.SMALL} />}>{t("恢复默认设置")}</Button>
              </Popconfirm>
            </Space>
          </Field>
        </Flex>
      </section>
    </Flex>
  );
}
