/**
 * useFocusTime —— 读取标签页今日使用时长
 *
 * 数据由 Service Worker 中的 FocusTimeTracker 采集，按 URL × day 聚合。
 * 本 Hook 在组件挂载时读取一次，并通过 chrome.storage.onChanged 监听更新。
 *
 * 位于 src/chrome/ 目录，允许直接调用 chrome.storage.* API。
 */

import { useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/shared/config/storage-keys";
import type { FocusTimeData } from "@/shared/types";
import { todayStr } from "@/shared/utils/date";

function urlKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString().replace(/\/+$/, "");
  } catch {
    return url;
  }
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return "";
  if (ms < 3600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3600_000).toFixed(1)}h`;
}

export function useFocusTime(url: string): string {
  const [duration, setDuration] = useState("");

  useEffect(() => {
    let cancelled = false;

    const read = async () => {
      try {
        const result = await chrome.storage.local.get(STORAGE_KEYS.focusTime);
        const data = result[STORAGE_KEYS.focusTime] as FocusTimeData | undefined;
        if (!data || cancelled) return;
        const today = todayStr();
        const dayRecord = data.daily.find((r) => r.day === today);
        if (!dayRecord || cancelled) return;
        const key = urlKey(url);
        const ms = dayRecord.byUrl[key] ?? 0;
        if (!cancelled) setDuration(formatDuration(ms));
      } catch {
        // ignore
      }
    };

    void read();

    const onChange = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes[STORAGE_KEYS.focusTime] !== undefined) {
        void read();
      }
    };

    chrome.storage.onChanged.addListener(onChange);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(onChange);
    };
  }, [url]);

  return duration;
}
