/**
 * FrequencyView — 按使用频率排序（F-11 升级版）
 *
 * 升级：优先使用 SW StatsCollector 写入的统计数据（近 7 天激活次数），
 * 数据缺失时回退到 lastAccessed 近似并显示"数据重建中"提示。
 */

import { useEffect, useMemo, useCallback } from "react";
import { useTabsStore, useStatsStore, useSettingsStore } from "@/store";
import { useTabActions } from "@/shared/hooks/use-tab-actions";
import { useT } from "@/shared/i18n";
import { findAmbiguousTitleIds } from "@/shared/utils/url-display";
import { TabItem } from "../components/TabItem";
import { Flame } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { Tag, Flex, Typography, Tooltip } from "antd";
import { CONFIG } from "@/shared/config";
import { STORAGE_KEYS } from "@/shared/config/storage-keys";
import { storageOnChanged } from "@/chrome";
import { calcTabHealth } from "@/shared/utils/tab-health";
import styles from "../styles/views.module.less";

const MAX_DISPLAY = CONFIG.ui.maxDisplay;

export function FrequencyView() {
  const tabs = useTabsStore((s) => s.tabs);
  const { jumpToTab, closeSingleTab } = useTabActions();
  const handleJump = useCallback((id: number, wid: number) => { void jumpToTab(id, wid); }, [jumpToTab]);
  const handleClose = useCallback((id: number) => { void closeSingleTab(id); }, [closeSingleTab]);
  const loadStats = useStatsStore((s) => s.loadStats);
  const isFallback = useStatsStore((s) => s.isFallback);
  const getCountRecent = useStatsStore((s) => s.getCountRecent);
  const statsLoaded = useStatsStore((s) => s.loaded);
  const statsData = useStatsStore((s) => s.data);
  const dedupStrictness = useSettingsStore((s) => s.settings.dedupStrictness ?? "loose");
  const { t } = useT();

  // 首次进入视图时加载统计数据
  useEffect(() => {
    if (!statsLoaded) {
      void loadStats();
    }
  }, [statsLoaded, loadStats]);

  useEffect(() => {
    const unsubscribe = storageOnChanged((changes, areaName) => {
      if (areaName === "local" && changes[STORAGE_KEYS.stats] !== undefined) {
        void loadStats();
      }
    });
    return unsubscribe;
  }, [loadStats]);

  const sortedTabs = useMemo(() => {
    const withScore = tabs.map((tab) => {
      const preciseCount = getCountRecent(tab.url, 7);
      // 精确为 0 时回落 lastAccessed，保证 UI 仍然按"最近活跃"排序
      const score =
        preciseCount > 0 ? preciseCount * 1_000_000_000 + tab.lastAccessed : tab.lastAccessed;
      const health = calcTabHealth(tab, tabs, statsData, dedupStrictness);
      return { tab, score, count: preciseCount, health };
    });
    return withScore.sort((a, b) => b.score - a.score).slice(0, MAX_DISPLAY);
  }, [tabs, getCountRecent, statsData, dedupStrictness]);

  const ambiguousIds = useMemo(
    () => findAmbiguousTitleIds(sortedTabs.map((x) => x.tab)),
    [sortedTabs],
  );

  if (tabs.length === 0) return null;

  return (
    <Flex vertical>
      <Flex className={styles["app-frequency-header"]} align="center" gap="small">
        <Flame size={ICON_SIZE.MEDIUM} className={styles["app-frequency-header-icon"]} />
        <Typography.Text className={styles["app-frequency-header-copy"]}>
          {t("最常使用的 {count} 个标签页", { count: sortedTabs.length })}
        </Typography.Text>
        {isFallback && (
          <Tag color="default" className={styles["app-frequency-rebuild-tag"]}>
            {t("数据重建中")}
          </Tag>
        )}
      </Flex>

      <Flex vertical className={styles["app-frequency-list"]}>
        {sortedTabs.map((entry, i) => (
          <TabItem
            key={entry.tab.id}
            tab={entry.tab}
            onJump={handleJump}
            onClose={handleClose}
            showHostname
            showUrlHint={ambiguousIds.has(entry.tab.id)}
            leading={
              <Flex align="center" gap={4}>
                <Typography.Text
                  className={`${styles["app-frequency-rank"]}${i < 3 ? " is-top-rank" : ""}`}
                >
                  {i + 1}
                </Typography.Text>
                <Tooltip title={t("健康度 {score} 分", { score: entry.health.total })}>
                  <span className={`${styles["app-health-dot"]} ${styles[`app-health-dot--${entry.health.level}`]}`} />
                </Tooltip>
              </Flex>
            }
          />
        ))}
      </Flex>
    </Flex>
  );
}
