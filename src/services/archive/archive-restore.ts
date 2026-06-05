/**
 * 归档服务 - 恢复操作
 *
 * 负责归档会话的恢复，支持多种恢复策略（新窗口、当前窗口、部分恢复），
 * 以及分批恢复机制以减少 Chrome 限流与卡顿。
 */

import { createTab, getCurrentWindow, groupTabs, updateTabGroup, createWindow } from "@/chrome";
import type { ChromeTabGroupColor } from "@/chrome/tabGroups";
import { filterSafeExternalUrls } from "@/shared/utils/url-safety";
import type { ArchivedSession, ArchivedTab } from "@/shared/types";
import { getArchivedSessions } from "./archive-storage";

/** 恢复策略（F-14 扩展） */
export type RestoreStrategy = "new_window" | "current_window" | "partial";

/** 恢复选项 */
export interface RestoreOptions {
  strategy?: RestoreStrategy;
  /** partial 策略下仅恢复这些 URL；其它策略忽略 */
  urls?: string[];
  /** 进度回调 */
  onProgress?: (done: number, total: number) => void;
  /** 取消信号：置为 true 时停止后续批次 */
  shouldCancel?: () => boolean;
  /** 单批大小（默认 10） */
  batchSize?: number;
  /** 批间隔 ms（默认 100） */
  batchInterval?: number;
  /**
   * 是否恢复 TabGroup 结构（任务4：高保真恢复）。
   * 默认 true，仅在 new_window 策略下生效。
   */
  restoreTabGroups?: boolean;
}

/** 恢复结果 */
export interface RestoreOutcome {
  restored: number;
  batches: number;
  cancelled: boolean;
  /** TabGroup 恢复失败的组数量 */
  failedGroups?: number;
}

/**
 * 恢复一个归档会话。
 *
 * 恢复策略：
 * - new_window（默认，新窗口打开全部）
 * - current_window（追加到当前窗口末尾）
 * - partial（由调用方先过滤 tabs，再传 urls 子集）
 *
 * > 30 Tab 分批恢复（10 / 批，100ms 间隔），减少 Chrome 限流与卡顿。
 */
export async function restoreSession(
  sessionId: string,
  options: RestoreOptions = {},
): Promise<RestoreOutcome> {
  const sessions = await getArchivedSessions();
  const session = sessions.find((s) => s.id === sessionId);
  if (session === undefined) throw new Error("Session not found");

  const strategy: RestoreStrategy = options.strategy ?? "new_window";
  const restoreTabGroups = options.restoreTabGroups !== false;

  // partial 策略：按 URL 子集过滤
  let targetTabs: ArchivedTab[];
  if (strategy === "partial" && options.urls !== undefined) {
    const urlSet = new Set(options.urls);
    targetTabs = session.tabs.filter((t) => urlSet.has(t.url));
  } else {
    targetTabs = session.tabs;
  }

  // 按 index 排序，保证恢复顺序与原始一致
  targetTabs = [...targetTabs].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  const safeUrls = filterSafeExternalUrls(targetTabs.map((t) => t.url).filter(Boolean));
  if (safeUrls.length === 0) return { restored: 0, batches: 0, cancelled: false };

  const batchSize = options.batchSize ?? 10;
  const batchInterval = options.batchInterval ?? 100;

  /** 确定 targetWindowId：new_window 开新窗、current_window 用当前 */
  let targetWindowId: number | undefined;

  if (strategy === "new_window") {
    if (safeUrls.length === 1) {
      await createTab({ url: safeUrls[0] });
      options.onProgress?.(1, 1);
      return { restored: 1, batches: 1, cancelled: false };
    }
    try {
      const w = await createWindow({ url: safeUrls[0], focused: true });
      targetWindowId = w?.id;
      if (targetWindowId === undefined) {
        throw new Error("Failed to create window — no window id returned");
      }
      options.onProgress?.(1, safeUrls.length);
      const restUrls = safeUrls.slice(1);
      const outcome = await batchCreateTabs(
        restUrls,
        targetWindowId,
        batchSize,
        batchInterval,
        options,
        1,
      );

      // 任务4：恢复 TabGroup 结构
      if (
        restoreTabGroups &&
        targetWindowId !== undefined &&
        session.tabGroups &&
        session.tabGroups.length > 0
      ) {
        const failedGroups = await restoreTabGroupStructure(session, targetWindowId);
        outcome.failedGroups = failedGroups;
      }

      return outcome;
    } catch (err) {
      console.warn("[archive] new_window failed, fallback to current window", err);
    }
  }

  // current_window 或 new_window 失败回落：拿当前窗口
  if (targetWindowId === undefined) {
    const currentWindow = await getCurrentWindow();
    targetWindowId = currentWindow?.id;
  }
  return batchCreateTabs(safeUrls, targetWindowId, batchSize, batchInterval, options, 0);
}

/**
 * 任务4：按归档时的 TabGroup 快照重建 Tab Group 结构。
 *
 * 流程：
 *   1. 查询目标窗口中刚恢复的标签页（按 URL 匹配）
 *   2. 按原始 groupId 分组，调用 chrome.tabs.group 创建新 group
 *   3. 调用 chrome.tabGroups.update 恢复标题和颜色
 *
 * @returns 失败的 group 数量（供 UI 展示部分恢复状态）
 */
async function restoreTabGroupStructure(
  session: ArchivedSession,
  windowId: number,
): Promise<number> {
  let failedCount = 0;
  if (!session.tabGroups || session.tabGroups.length === 0) return 0;

  try {
    // 等待标签页完全创建（短暂延迟）
    await new Promise((r) => setTimeout(r, 300));

    // 查询窗口中所有标签页，按 URL 建立一对多映射（同一 URL 可能对应多个 tab）
    const windowTabs = await chrome.tabs.query({ windowId });
    // 按 index 升序排列，与归档时的顺序对齐
    windowTabs.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const urlToTabIds = new Map<string, number[]>();
    for (const tab of windowTabs) {
      if (tab.url && tab.id !== undefined) {
        const list = urlToTabIds.get(tab.url) ?? [];
        list.push(tab.id);
        urlToTabIds.set(tab.url, list);
      }
    }
    // 消费游标：每个 URL 被匹配一次后从队列头部移除，避免重复 URL 映射到同一 tabId
    const urlConsumeIndex = new Map<string, number>();

    // 按原始 groupId 聚合 tabId
    const groupIdToTabIds = new Map<number, number[]>();
    for (const archivedTab of session.tabs) {
      if (archivedTab.groupId === undefined || archivedTab.groupId < 0) continue;
      const candidates = urlToTabIds.get(archivedTab.url);
      if (!candidates || candidates.length === 0) continue;
      const consumeIdx = urlConsumeIndex.get(archivedTab.url) ?? 0;
      if (consumeIdx >= candidates.length) continue;
      const tabId = candidates[consumeIdx];
      if (tabId === undefined) continue;
      urlConsumeIndex.set(archivedTab.url, consumeIdx + 1);
      const list = groupIdToTabIds.get(archivedTab.groupId) ?? [];
      list.push(tabId);
      groupIdToTabIds.set(archivedTab.groupId, list);
    }

    // 为每个原始 group 创建新 group 并恢复元数据
    for (const archivedGroup of session.tabGroups) {
      const tabIds = groupIdToTabIds.get(archivedGroup.groupId);
      if (!tabIds || tabIds.length === 0) continue;

      try {
        const newGroupId = await groupTabs({ tabIds, createProperties: { windowId } });
        await updateTabGroup(newGroupId, {
          title: archivedGroup.title || undefined,
          color: archivedGroup.color as ChromeTabGroupColor,
          collapsed: archivedGroup.collapsed,
        });
      } catch (err) {
        failedCount++;
        console.warn("[archive] restoreTabGroup failed for group", archivedGroup.groupId, err);
      }
    }
  } catch (err) {
    console.warn("[archive] restoreTabGroupStructure failed", err);
    failedCount = session.tabGroups.length; // 整体失败，全部算失败
  }
  return failedCount;
}

/** 分批创建标签页 */
async function batchCreateTabs(
  urls: string[],
  windowId: number | undefined,
  batchSize: number,
  batchInterval: number,
  options: RestoreOptions,
  startDone: number,
): Promise<RestoreOutcome> {
  let done = startDone;
  let batches = 0;
  const total = urls.length + startDone;
  for (let i = 0; i < urls.length; i += batchSize) {
    if (options.shouldCancel?.() === true) {
      return { restored: done, batches, cancelled: true };
    }
    const slice = urls.slice(i, i + batchSize);
    for (const url of slice) {
      if (options.shouldCancel?.() === true) {
        return { restored: done, batches, cancelled: true };
      }
      try {
        await createTab({ url, windowId, active: false });
        done += 1;
        options.onProgress?.(done, total);
      } catch (err) {
        console.warn("[archive] createTab failed", err);
      }
    }
    batches += 1;
    if (i + batchSize < urls.length) {
      await new Promise((r) => setTimeout(r, batchInterval));
    }
  }
  return { restored: done, batches, cancelled: false };
}
