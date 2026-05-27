/**
 * useAutoCleanup — 存储自动清理策略
 *
 * 当 chrome.storage.local 使用率超过阈值时，自动清理非核心数据。
 * 清理优先级（从低到高）：
 *   1. metrics（指标数据，可丢弃）
 *   2. activity（活动记录，超过 72h 的）
 *   3. historyEvents（历史事件，超过 30 天的）
 *   4. ogIndex（OG 索引，超过 10000 条时 LRU）
 *   5. searchHistory（搜索历史）
 */

import { useEffect } from "react";
import { getQuotaStatus } from "@/shared/utils/quota";
import { clearMetrics } from "@/repositories/storage-repo";
import { pruneTrash } from "@/repositories/trash-repo";
import { feedback } from "@/shared/ui/feedback";
import { useT } from "@/shared/i18n";

const CLEANUP_THRESHOLD_PERCENT = 80; // 使用率超过 80% 触发清理

/** 获取并清理 activity 中过期的记录 */
async function cleanupActivity(): Promise<number> {
  const { getData, setData } = await import("@/repositories/storage-repo");
  const { STORAGE_KEYS } = await import("@/shared/config/storage-keys");
  const activity = (await getData<{ ts: number }[]>(STORAGE_KEYS.activity)) ?? [];
  const cutoff = Date.now() - 72 * 3600 * 1000;
  const valid = activity.filter((r) => r.ts >= cutoff);
  if (valid.length < activity.length) {
    await setData(STORAGE_KEYS.activity, valid);
  }
  return activity.length - valid.length;
}

/** 获取并清理 historyEvents 中过期的记录 */
async function cleanupHistoryEvents(): Promise<number> {
  const { getData, setData } = await import("@/repositories/storage-repo");
  const { STORAGE_KEYS } = await import("@/shared/config/storage-keys");
  const events = (await getData<{ ts?: number }[]>(STORAGE_KEYS.historyEvents)) ?? [];
  const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
  const valid = events.filter((e) => (e.ts ?? 0) >= cutoff);
  if (valid.length < events.length) {
    await setData(STORAGE_KEYS.historyEvents, valid);
  }
  return events.length - valid.length;
}

/** 获取并清理 searchHistory */
async function cleanupSearchHistory(): Promise<number> {
  const { getData, setData } = await import("@/repositories/storage-repo");
  const { STORAGE_KEYS } = await import("@/shared/config/storage-keys");
  const history = (await getData<{ ts?: number }[]>(STORAGE_KEYS.searchHistory)) ?? [];
  const maxKeep = 10;
  if (history.length > maxKeep) {
    const trimmed = history.slice(0, maxKeep);
    await setData(STORAGE_KEYS.searchHistory, trimmed);
    return history.length - trimmed.length;
  }
  return 0;
}

export function useAutoCleanup() {
  const { t } = useT();

  useEffect(() => {
    let cancelled = false;

    async function runCleanup() {
      const quota = await getQuotaStatus();
      if (!quota.isWarning || quota.percentage < CLEANUP_THRESHOLD_PERCENT) return;

      const results: string[] = [];

      // 按优先级逐个清理
      const trashPruned = await pruneTrash();
      if (trashPruned > 0) results.push(t("autoCleanup.trash", { count: trashPruned }));

      await clearMetrics();
      results.push(t("autoCleanup.metrics"));

      const activityPruned = await cleanupActivity();
      if (activityPruned > 0) results.push(t("autoCleanup.activity", { count: activityPruned }));

      const historyPruned = await cleanupHistoryEvents();
      if (historyPruned > 0) results.push(t("autoCleanup.history", { count: historyPruned }));

      const searchPruned = await cleanupSearchHistory();
      if (searchPruned > 0) results.push(t("autoCleanup.searchHistory", { count: searchPruned }));

      if (!cancelled && results.length > 0) {
        feedback.info(t("autoCleanup.summary", { items: results.join("、") }));
      }
    }

    // 页面加载后延迟 3 秒执行，避免阻塞首屏
    const timer = setTimeout(() => {
      void runCleanup();
    }, 3000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [t]);
}
