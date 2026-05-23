/**
 * 归档服务 - 恢复操作
 *
 * 负责归档会话的恢复，支持多种恢复策略（新窗口、当前窗口、部分恢复），
 * 以及分批恢复机制以减少 Chrome 限流与卡顿。
 */

import { createTab, getCurrentWindow } from '@/chrome';
import { filterSafeExternalUrls } from '@/shared/utils/url-safety';
import { getArchivedSessions } from './archive-storage';

/** 恢复策略（F-14 扩展） */
export type RestoreStrategy = 'new_window' | 'current_window' | 'partial';

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
}

/** 恢复结果 */
export interface RestoreOutcome {
  restored: number;
  batches: number;
  cancelled: boolean;
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
 *
 * @param sessionId 要恢复的会话 ID
 * @param options 恢复选项（策略、进度回调、取消信号等）
 * @returns 恢复结果（恢复数量、批次数、是否取消）
 */
export async function restoreSession(
  sessionId: string,
  options: RestoreOptions = {},
): Promise<RestoreOutcome> {
  const sessions = await getArchivedSessions();
  const session = sessions.find((s) => s.id === sessionId);
  if (session === undefined) throw new Error('Session not found');

  const sessionUrls = filterSafeExternalUrls(session.tabs.map((tab) => tab.url).filter((url): url is string => url !== ''));
  const strategy: RestoreStrategy = options.strategy ?? 'new_window';
  const targetUrls = filterSafeExternalUrls(strategy === 'partial' ? (options.urls ?? sessionUrls) : sessionUrls);
  if (targetUrls.length === 0) return { restored: 0, batches: 0, cancelled: false };

  const batchSize = options.batchSize ?? 10;
  const batchInterval = options.batchInterval ?? 100;

  /** 确定 targetWindowId：new_window 开新窗、current_window 用当前 */
  let targetWindowId: number | undefined;
  if (strategy === 'new_window') {
    // 单 tab 走 createTab({url})，默认在当前窗口；其余情况新窗口承载
    if (targetUrls.length === 1) {
      await createTab({ url: targetUrls[0] });
      options.onProgress?.(1, 1);
      return { restored: 1, batches: 1, cancelled: false };
    }
    if (typeof chrome !== 'undefined' && chrome.windows !== undefined) {
      try {
        const w = await chrome.windows.create({ url: targetUrls[0], focused: true });
        targetWindowId = w?.id;
        options.onProgress?.(1, targetUrls.length);
        // 第一个已在 chrome.windows.create 中创建，下面从 index 1 开始
        const restUrls = targetUrls.slice(1);
        return await batchCreateTabs(restUrls, targetWindowId, batchSize, batchInterval, options, 1);
      } catch (err) {
        console.warn('[archive] new_window failed, fallback current window', err);
      }
    }
  }

  // current_window 或 new_window 失败回落：拿当前窗口
  if (targetWindowId === undefined) {
    const currentWindow = await getCurrentWindow();
    targetWindowId = currentWindow?.id;
  }
  return batchCreateTabs(targetUrls, targetWindowId, batchSize, batchInterval, options, 0);
}

/**
 * 分批创建标签页。
 *
 * 按 `batchSize` 拆分 URL 列表，批次间插入 `batchInterval` 延迟，
 * 减少 Chrome 限流与 UI 卡顿。支持取消信号。
 *
 * @param urls 要创建的 URL 列表
 * @param windowId 目标窗口 ID（可能未定义）
 * @param batchSize 单批大小（默认 10）
 * @param batchInterval 批间隔 ms（默认 100）
 * @param options 恢复选项（含进度回调、取消信号）
 * @param startDone 已完成数量（用于追加恢复场景）
 * @returns 恢复结果（恢复数量、批次数、是否取消）
 */
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
        console.warn('[archive] createTab failed', err);
      }
    }
    batches += 1;
    if (i + batchSize < urls.length) {
      await new Promise((r) => setTimeout(r, batchInterval));
    }
  }
  return { restored: done, batches, cancelled: false };
}
