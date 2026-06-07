/**
 * Popup 排序工具：类型 + 排序函数 + Tab 操作。
 */

import { activateTab, createTab } from "@/chrome";
import { translate } from "@/shared/i18n/core";

export interface RecentTab {
  id: number;
  windowId: number;
  title: string;
  url: string;
  favIconUrl: string;
  hostname: string;
  lastAccessed: number;
}

export type SortMode = "recent" | "title" | "domain" | "urlLength";

export const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "recent", label: translate("最近") },
  { value: "title", label: translate("标题") },
  { value: "domain", label: translate("域名") },
  { value: "urlLength", label: translate("长度") },
];

export function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function sortTabs(tabs: RecentTab[], mode: SortMode, asc: boolean): RecentTab[] {
  const sorted = [...tabs];
  switch (mode) {
    case "recent":
      sorted.sort((a, b) => b.lastAccessed - a.lastAccessed);
      break;
    case "title":
      sorted.sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));
      break;
    case "domain":
      sorted.sort(
        (a, b) =>
          a.hostname.localeCompare(b.hostname, "zh-CN") ||
          a.title.localeCompare(b.title, "zh-CN"),
      );
      break;
    case "urlLength":
      sorted.sort((a, b) => a.url.length - b.url.length);
      break;
  }
  if (asc) sorted.reverse();
  return sorted;
}

/** 打开一个 Tab：激活该 Tab 并聚焦其窗口 */
export async function focusTab(tab: RecentTab): Promise<void> {
  try {
    await activateTab(tab.id, tab.windowId);
  } catch {
    if (
      tab.url &&
      !tab.url.startsWith("chrome://") &&
      !tab.url.startsWith("chrome-extension://")
    ) {
      try {
        await createTab({ url: tab.url, active: true });
      } catch (err) {
        console.warn("[Popup] focusTab: createTab failed", err);
      }
    }
  }
}
