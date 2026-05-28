/**
 * DuplicatePreviewModal —— 重复合并预览 Modal（需求 6）
 *
 * 功能：
 *   · 按重复分组展示所有组
 *   · 每组内列出全部重复 Tab（title + url + 窗口 + 打开时间）
 *   · 默认勾选"最旧一条"作为保留项
 *   · 支持"全不勾选" / "全部勾选最旧" 快捷操作
 *   · 点击"合并"：批量关闭未勾选 Tab，单条 Undo + Toast
 *
 * 输入：外部传入 dupGroups + onClose 回调。
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { App, Button, Modal, Radio, Space, Tag, Typography, theme, Flex, Image } from "antd";
import type { RadioChangeEvent } from "antd/es/radio/interface";
import type { LiveTab } from "@/shared/types";
import type { DupGroup } from "@/shared/utils/dedupe";
import { useTabsStore, useMetadataStore } from "@/store";
import { nanoid } from "nanoid";
import { useT } from "@/shared/i18n";
import styles from "../styles/views.module.less";

const { Text } = Typography;

interface DuplicatePreviewModalProps {
  open: boolean;
  dupGroups: DupGroup[];
  onClose: () => void;
}

/** 选择最旧（lastAccessed 最小；若相同取 id 最小）作为默认保留项 */
function pickDefaultKeeper(group: DupGroup): number {
  const sorted = [...group.tabs].sort(
    (a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0) || a.id - b.id,
  );
  return sorted[0]?.id ?? group.tabs[0]?.id ?? -1;
}

function formatOpenedAt(ts: number, locale: string): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString(locale, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function DuplicatePreviewModal({ open, dupGroups, onClose }: DuplicatePreviewModalProps) {
  const { t, locale: currentLocale } = useT();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const closeMultipleTabs = useTabsStore((s) => s.closeMultipleTabs);
  const loadAllTabs = useTabsStore((s) => s.loadAllTabs);
  const pushActivity = useMetadataStore((s) => s.pushActivity);

  /** 分组 id → 保留的 tab.id */
  const [keepers, setKeepers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  // 按 canonicalUrl 过滤掉组内只剩 1 条的（需求 6.7：自动从 Modal 中移除零项组）
  const effectiveGroups = useMemo(() => dupGroups.filter((g) => g.tabs.length >= 2), [dupGroups]);

  // 初始化默认保留项
  useEffect(() => {
    if (!open) return;
    const next: Record<string, number> = {};
    for (const group of effectiveGroups) {
      next[group.canonicalUrl] = pickDefaultKeeper(group);
    }
    setKeepers(next);
  }, [open, effectiveGroups]);

  const { closeCount, keepCount } = useMemo(() => {
    let close = 0;
    let keep = 0;
    for (const group of effectiveGroups) {
      const keeperId = keepers[group.canonicalUrl];
      for (const tab of group.tabs) {
        if (tab.id === keeperId) keep += 1;
        else close += 1;
      }
    }
    return { closeCount: close, keepCount: keep };
  }, [effectiveGroups, keepers]);

  const handleKeeperChange = useCallback((canonicalUrl: string, tabId: number) => {
    setKeepers((prev) => ({ ...prev, [canonicalUrl]: tabId }));
  }, []);

  const handleKeepAllOldest = useCallback(() => {
    const next: Record<string, number> = {};
    for (const group of effectiveGroups) {
      next[group.canonicalUrl] = pickDefaultKeeper(group);
    }
    setKeepers(next);
  }, [effectiveGroups]);

  const handleKeepNone = useCallback(() => {
    setKeepers({});
  }, []);

  const handleMerge = useCallback(async () => {
    if (busy) return;
    const toClose: number[] = [];
    for (const group of effectiveGroups) {
      const keeperId = keepers[group.canonicalUrl];
      for (const tab of group.tabs) {
        if (tab.id !== keeperId) toClose.push(tab.id);
      }
    }
    if (toClose.length === 0) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      await closeMultipleTabs(toClose);
      await loadAllTabs();
      message.success(t("已合并 {count} 个重复标签", { count: toClose.length }));
      await pushActivity({
        id: nanoid(6),
        type: "dedup_merge",
        ts: Date.now(),
        summary: t("已合并 {count} 个重复标签", { count: toClose.length }),
      });
      onClose();
    } catch (err) {
      console.warn("[DuplicatePreviewModal] merge failed", err);
      message.error(t("合并失败，部分标签可能仍然存在"));
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    effectiveGroups,
    keepers,
    closeMultipleTabs,
    loadAllTabs,
    message,
    onClose,
    pushActivity,
    t,
  ]);

  return (
    <Modal
      open={open}
      title={t("重复合并预览")}
      width={720}
      onCancel={onClose}
      centered
      destroyOnHidden
      footer={
        <Flex justify="space-between" align="center" className={styles["app-duplicate-footer"]}>
          <Space>
            <Button size="small" onClick={handleKeepAllOldest}>
              {t("全部勾选最旧")}
            </Button>
            <Button size="small" onClick={handleKeepNone}>
              {t("全不勾选")}
            </Button>
          </Space>
          <Space>
            <Text type="secondary" className={styles["app-duplicate-summary"]}>
              {t("将关闭 {close} 个 / 保留 {keep} 个", { close: closeCount, keep: keepCount })}
            </Text>
            <Button onClick={onClose} disabled={busy}>
              {t("忽略本次")}
            </Button>
            <Button
              type="primary"
              onClick={() => void handleMerge()}
              loading={busy}
              disabled={closeCount === 0}
            >
              {t("合并")}
            </Button>
          </Space>
        </Flex>
      }
    >
      <Flex vertical className={styles["app-duplicate-groups"]}>
        {effectiveGroups.length === 0 ? (
          <Text type="secondary">{t("没有需要预览的重复组。")}</Text>
        ) : (
          effectiveGroups.map((group) => (
            <GroupSection
              key={group.canonicalUrl}
              group={group}
              keeperId={keepers[group.canonicalUrl]}
              onChange={(id) => handleKeeperChange(group.canonicalUrl, id)}
              token={token}
              t={t}
              locale={currentLocale}
            />
          ))
        )}
      </Flex>
    </Modal>
  );
}

interface GroupSectionProps {
  group: DupGroup;
  keeperId: number | undefined;
  onChange: (tabId: number) => void;
  token: ReturnType<typeof theme.useToken>["token"];
  t: (key: string, params?: Record<string, string | number>) => string;
  locale: string;
}

function GroupSection({ group, keeperId, onChange, token: _token, t, locale }: GroupSectionProps) {
  const closeCount = keeperId === undefined ? group.tabs.length : group.tabs.length - 1;
  const [radioValue, setRadioValue] = useState<string>(keeperId?.toString() ?? "");

  useEffect(() => {
    setRadioValue(keeperId?.toString() ?? "");
  }, [keeperId]);

  const handleChange = (e: RadioChangeEvent) => {
    const raw = (e.target as HTMLInputElement).value;
    const val = typeof raw === "number" ? String(raw) : String(raw ?? "");
    setRadioValue(val);
    onChange(parseInt(val, 10));
  };

  return (
    <Flex vertical className={styles["app-duplicate-group"]}>
      <Flex
        className={styles["app-duplicate-group__header"]}
        align="center"
        justify="space-between"
      >
        <Text strong className={styles["app-duplicate-group__title"]}>
          {group.canonicalUrl}
        </Text>
        <Tag color="gold" className={styles["app-duplicate-group__tag"]}>
          {t("将关闭 {count}", { count: closeCount })}
        </Tag>
      </Flex>
      <Radio.Group
        value={radioValue}
        onChange={handleChange}
        className={styles["app-duplicate-group__list"]}
      >
        {group.tabs.map((tab: LiveTab) => (
          <Radio
            key={tab.id}
            value={tab.id.toString()}
            className={`${styles["app-duplicate-option"]}${keeperId === tab.id ? ` ${styles["is-selected"]}` : ""}`}
          >
            {tab.favIconUrl !== "" && (
              <Image
                src={tab.favIconUrl}
                alt=""
                preview={false}
                className={styles["app-duplicate-option__favicon"]}
              />
            )}
            <Flex vertical className={styles["app-duplicate-option__content"]}>
              <Typography.Text className={styles["app-duplicate-option__title"]}>
                {tab.title}
              </Typography.Text>
              <Typography.Text className={styles["app-duplicate-option__url"]}>
                {tab.url}
              </Typography.Text>
            </Flex>
            <Flex vertical className={styles["app-duplicate-option__aside"]}>
              <Text type="secondary" className={styles["app-duplicate-option__meta"]}>
                {t("窗口 {id}", { id: tab.windowId })}
              </Text>
              <Text type="secondary" className={styles["app-duplicate-option__meta"]}>
                {formatOpenedAt(tab.lastAccessed, locale)}
              </Text>
            </Flex>
          </Radio>
        ))}
      </Radio.Group>
    </Flex>
  );
}
