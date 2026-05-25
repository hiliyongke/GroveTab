/**
 * TidySuggestionBar —— 智能整理建议栏（antd 版）
 *
 * 整合原 DedupInfoBar + 闲置检测，统一呈现"你的标签可以整理"的提示。
 *
 * 设计：
 *   - 同时检测"重复标签"和"闲置标签"
 *   - 用 antd Alert（type="info"）展示总体建议
 *   - 展开后分为两个区域：重复分组 + 闲置列表
 *   - 每个区域有独立操作按钮（合并/关闭/休眠）
 *   - 一键整理：合并所有重复 + 休眠所有闲置
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { Alert, App, Button, Card, List, Space, Tag, Tooltip, Typography, Flex } from "antd";
import { ChevronDown, X, Merge, Moon, Zap } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useTabsStore, useSettingsStore } from "@/store";
import { findDuplicates, type DupGroup } from "@/shared/utils/dedupe";
import { detectIdleTabs, formatIdleTime, type IdleTabInfo } from "@/shared/utils/idle-detect";
import { DuplicatePreviewModal } from "./DuplicatePreviewModal";
import { useT } from "@/shared/i18n";
import { LOCAL_CACHE_KEYS } from "@/shared/config/storage-keys";
import styles from "./styles/tidy-suggestion.module.less";

const DISMISSED_KEY = LOCAL_CACHE_KEYS.tidyDismissed;

interface TidySuggestionBarProps {
  expandSignal?: number;
}

export function TidySuggestionBar({ expandSignal = 0 }: TidySuggestionBarProps) {
  const tabs = useTabsStore((s) => s.tabs);
  const closeMultipleTabs = useTabsStore((s) => s.closeMultipleTabs);
  const discardMultipleTabs = useTabsStore((s) => s.discardMultipleTabs);
  const loadAllTabs = useTabsStore((s) => s.loadAllTabs);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISSED_KEY) === "1");
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const { t } = useT();
  const { message } = App.useApp();

  const dedupStrictness = useSettingsStore((s) => s.settings.dedupStrictness ?? "loose");
  const idleThresholdMinutes = useSettingsStore((s) => s.settings.idleThresholdMinutes ?? 1440);

  const dupGroups = useMemo(() => findDuplicates(tabs, dedupStrictness), [tabs, dedupStrictness]);
  const idleTabs = useMemo(
    () => detectIdleTabs(tabs, idleThresholdMinutes),
    [tabs, idleThresholdMinutes],
  );

  const totalDupTabs = dupGroups.reduce((sum, group) => sum + group.tabs.length - 1, 0);
  const staleCount = idleTabs.filter((item) => item.level === "stale").length;
  const idleOnlyCount = idleTabs.filter((item) => item.level === "idle").length;
  const hasSuggestions = dupGroups.length > 0 || idleTabs.length > 0;

  useEffect(() => {
    if (expandSignal <= 0 || !hasSuggestions) return;
    const timer = window.setTimeout(() => {
      sessionStorage.removeItem(DISMISSED_KEY);
      setDismissed(false);
      setExpanded(true);
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [expandSignal, hasSuggestions]);

  const runAction = useCallback(
    async (action: () => Promise<void>, successMsg: string) => {
      if (busy) return;
      setBusy(true);
      try {
        await action();
        await loadAllTabs({ silent: true });
        message.success(successMsg);
      } catch {
        // store 已 toast
      } finally {
        setBusy(false);
      }
    },
    [busy, loadAllTabs, message],
  );

  const handleMergeGroup = useCallback(
    (group: DupGroup) => {
      const toClose = group.tabs.slice(1).map((tab) => tab.id);
      void runAction(
        () => closeMultipleTabs(toClose),
        t('已合并 {count} 个重复标签页', { count: toClose.length }),
      );
    },
    [closeMultipleTabs, runAction, t],
  );

  const handleMergeAll = useCallback(() => {
    const toClose = dupGroups.flatMap((group) => group.tabs.slice(1).map((tab) => tab.id));
    void runAction(
      () => closeMultipleTabs(toClose),
      t('已合并全部 {count} 个重复标签页', { count: toClose.length }),
    );
  }, [closeMultipleTabs, dupGroups, runAction, t]);

  const handleDiscardIdle = useCallback(
    async (items: IdleTabInfo[]) => {
      if (busy) return;
      setBusy(true);
      try {
        const ids = items.map((item) => item.tab.id);
        await discardMultipleTabs(ids);
        await loadAllTabs({ silent: true });
        message.success(t('已休眠 {count} 个闲置标签', { count: ids.length }));
      } catch {
        // store 已 toast
      } finally {
        setBusy(false);
      }
    },
    [busy, discardMultipleTabs, loadAllTabs, message, t],
  );

  const handleTidyAll = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    let mergedCount = 0;
    let discardedCount = 0;

    if (dupGroups.length > 0) {
      const toClose = dupGroups.flatMap((group) => group.tabs.slice(1).map((tab) => tab.id));
      try {
        await closeMultipleTabs(toClose);
        mergedCount = toClose.length;
      } catch {
        // store 已 toast
      }
    }

    if (idleTabs.length > 0) {
      try {
        const idleIds = idleTabs.map((item) => item.tab.id);
        await discardMultipleTabs(idleIds);
        discardedCount = idleIds.length;
      } catch {
        // store 已 toast
      }
    }

    await loadAllTabs({ silent: true });
    setBusy(false);
    if (mergedCount > 0 || discardedCount > 0) {
      message.success(t('已合并 {merged} 个重复标签，休眠 {discarded} 个闲置标签', { merged: mergedCount, discarded: discardedCount }));
    }
  }, [busy, closeMultipleTabs, discardMultipleTabs, dupGroups, idleTabs, loadAllTabs, message, t]);

  if (dismissed || !hasSuggestions) return null;

  const summaryParts: string[] = [];
  if (totalDupTabs > 0) {
    summaryParts.push(t('{count} 组重复标签（{tabs} 个可合并）', { count: dupGroups.length, tabs: totalDupTabs }));
  }
  if (staleCount > 0) {
    summaryParts.push(t('{count} 个长期未用标签', { count: staleCount }));
  } else if (idleOnlyCount > 0) {
    summaryParts.push(t('{count} 个闲置标签', { count: idleOnlyCount }));
  }

  return (
    <Card
      className={`${styles["tidy-suggestion"]}${expanded ? ` ${styles["is-expanded"]}` : ""}`}
      size="small"
    >
      <Alert
        type="info"
        showIcon
        icon={<Zap size={ICON_SIZE.MEDIUM} className={styles["tidy-suggestion__alert-icon"]} />}
        message={
          <Flex className={styles["tidy-suggestion__summary"]}>
            <Typography.Text className={styles["tidy-suggestion__summary-text"]}>
              {summaryParts.join("；")}
            </Typography.Text>
            <Space size={4} className={styles["tidy-suggestion__summary-actions"]}>
              <Button
                size="small"
                loading={busy}
                onClick={() => {
                  void handleTidyAll();
                }}
                className={styles["tidy-suggestion__solid-action"]}
              >
                {t('一键整理')}
              </Button>
              <Tooltip title={expanded ? t('折叠') : t('展开')}>
                <Button
                  type="text"
                  size="small"
                  icon={
                    <ChevronDown
                      size={ICON_SIZE.SMALL}
                      className={styles["tidy-suggestion__chevron"]}
                    />
                  }
                  onClick={() => setExpanded(!expanded)}
                />
              </Tooltip>
              <Tooltip title={t('忽略')}>
                <Button
                  type="text"
                  size="small"
                  icon={
                    <X size={ICON_SIZE.SMALL} className={styles["tidy-suggestion__dismiss-icon"]} />
                  }
                  onClick={() => {
                    sessionStorage.setItem(DISMISSED_KEY, "1");
                    setDismissed(true);
                  }}
                />
              </Tooltip>
            </Space>
          </Flex>
        }
        className={styles["tidy-suggestion__alert"]}
      />

      {expanded && (
        <Card
          className={`${styles["tidy-suggestion__panel"]} app-accordion-panel`}
          size="small"
          classNames={{ body: styles["tidy-suggestion__panel-body"] }}
        >
          {dupGroups.length > 0 && (
            <>
              <Flex className={styles["tidy-suggestion__section-header"]}>
                <Merge
                  size={ICON_SIZE.DEFAULT}
                  className={`${styles["tidy-suggestion__section-icon"]} ${styles["tidy-suggestion__section-icon--dup"]}`}
                />
                <Typography.Text className={styles["tidy-suggestion__section-title"]}>
                  {t('重复标签')}
                </Typography.Text>
                <Button
                  size="small"
                  type="link"
                  onClick={() => setPreviewOpen(true)}
                  className={styles["tidy-suggestion__link-action"]}
                >
                  {t('预览')}
                </Button>
                <Button
                  size="small"
                  type="link"
                  loading={busy}
                  onClick={handleMergeAll}
                  className={styles["tidy-suggestion__link-action"]}
                >
                  {t('全部合并')}
                </Button>
              </Flex>
              <List
                size="small"
                dataSource={dupGroups}
                className={styles["tidy-suggestion__list"]}
                renderItem={(group) => (
                  <List.Item
                    key={group.canonicalUrl}
                    className={styles["tidy-suggestion__list-item"]}
                    actions={[
                      <Button
                        key="merge"
                        size="small"
                        loading={busy}
                        onClick={() => handleMergeGroup(group)}
                      >
                        {t('合并')}
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Typography.Text className={styles["tidy-suggestion__item-title"]}>
                          {group.tabs[0]?.title ?? group.canonicalUrl}
                        </Typography.Text>
                      }
                      description={
                        <Typography.Text className={styles["tidy-suggestion__item-desc"]}>
                          {group.tabs.length}x
                        </Typography.Text>
                      }
                    />
                  </List.Item>
                )}
              />
            </>
          )}

          {idleTabs.length > 0 && (
            <>
              <Flex
                className={`${styles["tidy-suggestion__section-header"]}${dupGroups.length > 0 ? ` ${styles["has-offset"]}` : ""}`}
              >
                <Moon
                  size={ICON_SIZE.DEFAULT}
                  className={`${styles["tidy-suggestion__section-icon"]} ${styles["tidy-suggestion__section-icon--idle"]}`}
                />
                <Typography.Text className={styles["tidy-suggestion__section-title"]}>
                  {t('闲置标签')}
                </Typography.Text>
                <Button
                  size="small"
                  type="link"
                  loading={busy}
                  onClick={() => {
                    void handleDiscardIdle(idleTabs);
                  }}
                  className={styles["tidy-suggestion__link-action"]}
                >
                  {t('全部休眠')}
                </Button>
              </Flex>
              <List
                size="small"
                dataSource={idleTabs}
                className={styles["tidy-suggestion__list"]}
                renderItem={(item) => (
                  <List.Item
                    key={item.tab.id}
                    className={styles["tidy-suggestion__list-item"]}
                    actions={[
                      <Tag
                        key="level"
                        color={item.level === "stale" ? "volcano" : "default"}
                        className={styles["tidy-suggestion__level-tag"]}
                      >
                        {item.level === "stale" ? t('长期未用') : t('闲置')}
                      </Tag>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Typography.Text className={styles["tidy-suggestion__item-title"]}>
                          {item.tab.title}
                        </Typography.Text>
                      }
                      description={
                        <Typography.Text className={styles["tidy-suggestion__item-desc"]}>
                          {t('{time}未访问', { time: formatIdleTime(item.hoursSinceAccess) })}
                        </Typography.Text>
                      }
                    />
                  </List.Item>
                )}
              />{" "}
            </>
          )}
        </Card>
      )}

      <DuplicatePreviewModal
        open={previewOpen}
        dupGroups={dupGroups}
        onClose={() => setPreviewOpen(false)}
      />
    </Card>
  );
}
