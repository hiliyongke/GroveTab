/**
 * useMemoryGovernance
 *
 * 内存压力感知的智能标签治理 Hook（任务7）。
 *
 * 功能：
 *   1. 定期轮询 chrome.system.memory 获取内存使用率
 *   2. 达到阈值时按策略执行：notify / discard / archive
 *   3. 固定标签、媒体播放中的标签、白名单域名始终豁免
 *   4. 冷却时间防止频繁触发
 */

import { useEffect, useRef, useCallback } from "react";
import { useSettingsStore } from "@/store/settings-slice";
import { useShallow } from "zustand/shallow";
import { useTabsStore } from "@/store/tabs-slice";
import { feedback } from "@/shared/ui/feedback";
import { translate } from "@/shared/i18n/core";
import type { LiveTab } from "@/shared/types";

/** 轮询间隔（ms） */
const POLL_INTERVAL_MS = 30_000;

/** 获取当前内存使用率（0-100），不支持时返回 null */
async function getMemoryUsagePercent(): Promise<number | null> {
  if (typeof chrome === "undefined" || !chrome.system?.memory) return null;
  try {
    const info = await chrome.system.memory.getInfo();
    if (info.capacity === 0) return null;
    const used = info.capacity - info.availableCapacity;
    return Math.round((used / info.capacity) * 100);
  } catch {
    return null;
  }
}

/**
 * 按「最久未访问」排序，过滤掉豁免标签，返回候选 discard 列表。
 *
 * 豁免条件（任意满足即豁免）：
 *   - pinned（固定标签）
 *   - audible（正在播放音频/视频）
 *   - discarded（已经休眠）
 *   - hostname 在白名单中
 *   - 当前活跃窗口的最近访问标签（lastAccessed 最大的那个）
 */
function getCandidateTabs(tabs: LiveTab[], allowlist: string[], maxTabs: number): LiveTab[] {
  const allowSet = new Set(allowlist.map((h) => h.toLowerCase()));

  // 找出每个窗口最近访问的 tab（豁免）
  const latestByWindow = new Map<number, number>();
  for (const tab of tabs) {
    const cur = latestByWindow.get(tab.windowId) ?? 0;
    if ((tab.lastAccessed ?? 0) > cur) {
      latestByWindow.set(tab.windowId, tab.lastAccessed ?? 0);
    }
  }

  const candidates = tabs.filter((tab) => {
    if (tab.pinned) return false;
    if (tab.audible) return false;
    if (tab.discarded) return false;
    if (allowSet.has(tab.hostname.toLowerCase())) return false;
    // 豁免每个窗口最近访问的标签
    if ((tab.lastAccessed ?? 0) === latestByWindow.get(tab.windowId)) return false;
    return true;
  });

  // 按最久未访问排序（lastAccessed 小的排前面）
  candidates.sort((a, b) => (a.lastAccessed ?? 0) - (b.lastAccessed ?? 0));
  return candidates.slice(0, maxTabs);
}

export function useMemoryGovernance() {
  const settings = useSettingsStore((s) => s.settings);
  const tabs = useTabsStore(useShallow((s) => s.tabs));
  const discardMultipleTabs = useTabsStore((s) => s.discardMultipleTabs);
  const lastActionAt = useRef<number>(0);

  // 用 ref 持有最新值，避免 runGovernance 依赖频繁变化的对象引用
  const settingsRef = useRef(settings);
  const tabsRef = useRef(tabs);
  const discardMultipleTabsRef = useRef(discardMultipleTabs);

  useEffect(() => {
    settingsRef.current = settings;
  });
  useEffect(() => {
    tabsRef.current = tabs;
  });
  useEffect(() => {
    discardMultipleTabsRef.current = discardMultipleTabs;
  });

  // 依赖数组为空：定时器只建立一次，始终读取 ref 中的最新值
  const runGovernance = useCallback(async () => {
    const {
      memoryGovernanceEnabled,
      memoryPressureThreshold = 80,
      memoryPressureAction = "notify",
      memoryGovernanceAllowlist = [],
      memoryGovernanceMaxTabs = 5,
      memoryGovernanceCooldownMinutes = 10,
    } = settingsRef.current;

    if (!memoryGovernanceEnabled) return;

    const usagePercent = await getMemoryUsagePercent();
    if (usagePercent === null || usagePercent < memoryPressureThreshold) return;

    // 冷却时间检查
    const cooldownMs = memoryGovernanceCooldownMinutes * 60_000;
    if (Date.now() - lastActionAt.current < cooldownMs) return;

    lastActionAt.current = Date.now();

    const candidates = getCandidateTabs(
      tabsRef.current,
      memoryGovernanceAllowlist,
      memoryGovernanceMaxTabs,
    );
    if (candidates.length === 0) return;

    if (memoryPressureAction === "notify") {
      feedback.warning(
        translate("内存使用率已达 {pct}%，建议关闭或休眠部分标签页以释放内存。", {
          pct: usagePercent,
        }),
      );
    } else if (memoryPressureAction === "discard") {
      const tabIds = candidates.map((t) => t.id);
      try {
        await discardMultipleTabsRef.current(tabIds);
        feedback.info(
          translate("内存压力（{pct}%）：已自动休眠 {count} 个标签页。", {
            pct: usagePercent,
            count: tabIds.length,
          }),
        );
      } catch {
        // discardMultipleTabs 内部已有 feedback，此处静默
      }
    } else if (memoryPressureAction === "archive") {
      // archive 策略：通知用户，由用户手动确认归档（避免无感数据丢失）
      feedback.warning(
        translate("内存压力（{pct}%）：建议将 {count} 个闲置标签页归档以释放内存。", {
          pct: usagePercent,
          count: candidates.length,
        }),
      );
    }
  }, []);

  const enabled = settings.memoryGovernanceEnabled;
  useEffect(() => {
    if (!enabled) return;

    // 立即执行一次，然后定时轮询
    void runGovernance();
    const timer = setInterval(() => void runGovernance(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [enabled, runGovernance]);
}
