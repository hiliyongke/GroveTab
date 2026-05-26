/**
 * MemoryGovernanceSettings —— 内存治理策略配置面板（任务7）
 *
 * 包含：
 * 1. 内存治理主开关
 * 2. 内存压力触发阈值
 * 3. 治理动作策略（notify / discard / archive）
 * 4. 例外白名单（hostname 列表）
 * 5. 单次最大操作标签数
 * 6. 冷却时间
 */

import { Flex, InputNumber, Select, Slider, Switch, Tag, Input, Space, Button } from "antd";
import { useState } from "react";
import type { UserSettings } from "@/shared/types";
import { useT } from "@/shared/i18n";
import { Field } from "@/features/settings/components/Field";

interface MemoryGovernanceSettingsProps {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void | Promise<void>;
}

export function MemoryGovernanceSettings({
  settings,
  updateSettings,
}: MemoryGovernanceSettingsProps) {
  const { t } = useT();
  const [allowlistInput, setAllowlistInput] = useState("");

  const enabled = settings.memoryGovernanceEnabled ?? false;
  const threshold = settings.memoryPressureThreshold ?? 80;
  const action = settings.memoryPressureAction ?? "notify";
  const allowlist = settings.memoryGovernanceAllowlist ?? [];
  const maxTabs = settings.memoryGovernanceMaxTabs ?? 5;
  const cooldown = settings.memoryGovernanceCooldownMinutes ?? 10;

  const handle = (patch: Partial<UserSettings>) => void updateSettings(patch);

  const addAllowlistHost = () => {
    const host = allowlistInput
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");
    if (!host || allowlist.includes(host)) {
      setAllowlistInput("");
      return;
    }
    handle({ memoryGovernanceAllowlist: [...allowlist, host] });
    setAllowlistInput("");
  };

  const removeAllowlistHost = (host: string) => {
    handle({ memoryGovernanceAllowlist: allowlist.filter((h) => h !== host) });
  };

  return (
    <Flex vertical className="settings-panel-stack settings-panel-stack--compact">
      {/* ── 主开关 ── */}
      <Field
        label={t("启用内存治理")}
        hint={t("开启后定期检测内存压力，在达到阈值时自动执行治理动作。需要 system.memory 权限。")}
      >
        <Switch checked={enabled} onChange={(v) => handle({ memoryGovernanceEnabled: v })} />
      </Field>

      {/* ── 触发阈值 ── */}
      <Field
        label={t("内存压力阈值（%）")}
        hint={t("已用内存占总内存的比例达到此值时触发治理动作，默认 80%。")}
      >
        <Flex align="center" gap={12} style={{ width: "100%" }}>
          <Slider
            min={50}
            max={95}
            step={5}
            value={threshold}
            onChange={(v) => handle({ memoryPressureThreshold: v })}
            disabled={!enabled}
            style={{ flex: 1 }}
          />
          <span style={{ minWidth: 36, textAlign: "right" }}>{threshold}%</span>
        </Flex>
      </Field>

      {/* ── 治理动作 ── */}
      <Field
        label={t("治理动作")}
        hint={t("达到阈值时执行的操作：仅通知 / 自动休眠最久未访问的标签 / 提示归档。")}
      >
        <Select
          value={action}
          disabled={!enabled}
          onChange={(v) => handle({ memoryPressureAction: v })}
          className="settings-control-full"
          options={[
            { value: "notify", label: t("仅通知（默认）") },
            { value: "discard", label: t("自动休眠标签页") },
            { value: "archive", label: t("提示归档标签页") },
          ]}
        />
      </Field>

      {/* ── 单次最大操作数 ── */}
      <Field
        label={t("单次最多操作标签数")}
        hint={t("每次触发治理时最多操作的标签页数量，默认 5，避免一次性操作过多。")}
      >
        <InputNumber
          min={1}
          max={20}
          value={maxTabs}
          disabled={!enabled}
          onChange={(v) => v !== null && handle({ memoryGovernanceMaxTabs: v })}
          style={{ width: 80 }}
        />
      </Field>

      {/* ── 冷却时间 ── */}
      <Field
        label={t("冷却时间（分钟）")}
        hint={t("两次治理动作之间的最小间隔，防止内存抖动时频繁触发，默认 10 分钟。")}
      >
        <Select
          value={cooldown}
          disabled={!enabled}
          onChange={(v) => handle({ memoryGovernanceCooldownMinutes: v })}
          className="settings-control-full"
          options={[5, 10, 15, 30, 60].map((n) => ({
            value: n,
            label: t("{n} 分钟", { n }),
          }))}
        />
      </Field>

      {/* ── 例外白名单 ── */}
      <Field
        label={t("例外白名单（域名）")}
        hint={t("白名单内的域名不会被自动休眠或归档。固定标签和正在播放媒体的标签始终豁免。")}
      >
        <Flex vertical gap={8} style={{ width: "100%" }}>
          <Space.Compact style={{ width: "100%" }}>
            <Input
              placeholder="mail.google.com"
              value={allowlistInput}
              disabled={!enabled}
              onChange={(e) => setAllowlistInput(e.target.value)}
              onPressEnter={addAllowlistHost}
              style={{ flex: 1 }}
            />
            <Button disabled={!enabled || !allowlistInput.trim()} onClick={addAllowlistHost}>
              {t("添加")}
            </Button>
          </Space.Compact>
          {allowlist.length > 0 && (
            <Flex wrap="wrap" gap={4}>
              {allowlist.map((host) => (
                <Tag key={host} closable={enabled} onClose={() => removeAllowlistHost(host)}>
                  {host}
                </Tag>
              ))}
            </Flex>
          )}
        </Flex>
      </Field>
    </Flex>
  );
}
