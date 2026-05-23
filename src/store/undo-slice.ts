/**
 * Zustand Store — Undo Slice
 *
 * Manages undo records for closed tabs.
 * Records are persisted to chrome.storage.local and synced across new tab pages.
 *
 * Slice 依赖关系：
 *   - 依赖 settings-slice：读取 settings.undoWindowSeconds 决定 TTL
 *   - 被 tabs-slice 依赖：tabs-slice 的关闭操作（closeSingleTab, closeMultipleTabs 等）调用 addRecord
 *
 * 上游被以下模块依赖：
 *   - AppContent：消费 activeToast 进行撤销 toast 展示
 *   - UndoToast 组件：消费 undoRecord, dismissToast
 */

import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { UndoRecord, ClosedTabSnapshot } from '@/shared/types';
import { getData, setData } from '@/repositories';
import { createTab, getCurrentWindow } from '@/chrome';
import { feedback } from '@/shared/ui/feedback';
import { translate } from '@/shared/i18n/core';
import { useSettingsStore } from './settings-slice';
import { filterSafeExternalUrls } from '@/shared/utils/url-safety';
import { BRAND } from '@/shared/config/brand';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';

const UNDO_STORAGE_KEY = STORAGE_KEYS.undo;
const DEFAULT_UNDO_TTL_MS = 5_000;
const MAX_UNDO_RECORDS = 5;

/**
 * 获取撤销 Toast 的 TTL（毫秒）
 *
 * 从 settings store 中读取用户配置的撤销窗口时间（秒），
 * 并 clamp 到 [3, 10] 秒范围，转换为毫秒返回。
 * 若配置无效，返回默认的 5 秒。
 *
 * @returns 撤销 Toast 的 TTL（毫秒）
 */
function getUndoTtlMs(): number {
  const seconds = useSettingsStore.getState().settings.undoWindowSeconds;
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return DEFAULT_UNDO_TTL_MS;
  return Math.min(10, Math.max(3, seconds)) * 1_000;
}

interface UndoState {
  /** 撤销记录列表（最多保留 MAX_UNDO_RECORDS 条） */
  records: UndoRecord[];
  /** 当前活跃的撤销记录（用于 Toast 展示，TTL 后自动清除） */
  activeToast: UndoRecord | null;

  // Actions
  /**
   * 添加一条撤销记录并持久化
   *
   * @param tabs 被关闭的标签页快照数组
   * @param description 操作描述（用于 Toast 展示）
   * @param extra 额外信息（归档会话 ID、子备注等）
   * @returns 新创建的撤销记录
   */
  addRecord: (
    tabs: ClosedTabSnapshot[],
    description: string,
    extra?: { archivedSessionId?: string; subNote?: string },
  ) => Promise<UndoRecord>;
  /** 撤销（恢复）指定记录对应的标签页 */
  undoRecord: (recordId: string) => Promise<void>;
  /** 关闭当前 Toast 但不执行撤销 */
  dismissToast: () => void;
  /** 从 chrome.storage.local 加载撤销记录 */
  loadRecords: () => Promise<void>;
  /** 清理已过期的撤销记录 */
  cleanExpired: () => Promise<void>;
}

export const useUndoStore = create<UndoState>((set, get) => ({
  records: [],
  activeToast: null,

  addRecord: (tabs, description, extra) => {
    const record: UndoRecord = {
      id: nanoid(8),
      createdAt: Date.now(),
      tabs,
      description,
      expired: false,
      archivedSessionId: extra?.archivedSessionId,
      subNote: extra?.subNote,
    };

    const records = [record, ...get().records].slice(0, MAX_UNDO_RECORDS);
    // 关键：同步落 in-memory，再 fire-and-forget 持久化。
    //   历史 Bug：若 `await setData(...)` 因 chrome.storage.local 异常而 hang，
    //   上游 `closeSingleTab` / `closeMultipleTabs` 会被卡在 await，
    //   浏览器 tab 永远不会被 `chrome.tabs.remove` 关闭，UI 一直转圈。
    //   Undo 持久化只是为了跨会话恢复，不该成为关闭流程的硬依赖。
    set({ records, activeToast: record });
    void setData(UNDO_STORAGE_KEY, records).catch((err) => {
      console.warn(`${BRAND.logTag} undo persist failed (record still in memory)`, err);
    });

    // Auto-expire toast after TTL
    setTimeout(() => {
      const current = get();
      if (current.activeToast?.id === record.id) {
        set({ activeToast: null });
      }
      // Mark as expired
      const updated = current.records.map((r) =>
        r.id === record.id ? { ...r, expired: true } : r,
      );
      set({ records: updated });
      void setData(UNDO_STORAGE_KEY, updated).catch(() => {
        /* 过期标记持久化失败无所谓——下次加载会用 createdAt 过滤 */
      });
    }, getUndoTtlMs());

    return Promise.resolve(record);
  },

  undoRecord: async (recordId) => {
    const record = get().records.find((r) => r.id === recordId);
    if (!record || record.expired) return;

    const urls = filterSafeExternalUrls(record.tabs.map((t) => t.url).filter(Boolean));

    /**
     * 撤销恢复策略（用户反馈调整）：
     *   - 全部在**当前窗口**追加打开，而不是新开窗口
     *   - 单个 tab：直接 createTab 走当前窗口即可（chrome 默认行为）
     *   - 多个 tab：显式拿 currentWindow.id，逐个 createTab(windowId)
     *     （不再使用 chrome.windows.create——那样会开一个新窗口，与用户心智模型不符）
     *   - 所有 chrome API 都经 safeCall 封装，失败会统一 toast
     */
    try {
      if (urls.length === 1) {
        await createTab({ url: urls[0], active: false });
      } else if (urls.length > 1) {
        const currentWindow = await getCurrentWindow();
        const windowId = currentWindow?.id;
        // 顺序打开而非 Promise.all：避免 Chrome 对同窗口瞬时并发建 tab 触发限流
        for (const url of urls) {
          await createTab({ url, windowId, active: false });
        }
      }
    } catch (err) {
      feedback.error(translate('undo.restoreFailed'), err);
      // 失败也要把记录清掉，否则用户再点一次还是同一条 record，体验更差
    }

    // Remove the undo record
    const records = get().records.filter((r) => r.id !== recordId);
    set({ records, activeToast: null });
    void setData(UNDO_STORAGE_KEY, records).catch(() => {
      /* 持久化失败无所谓，内存已清 */
    });
  },

  dismissToast: () => {
    set({ activeToast: null });
  },

  loadRecords: async () => {
    const records = await getData<UndoRecord[]>(UNDO_STORAGE_KEY);
    if (records) {
      // Filter out expired records
      const now = Date.now();
      const ttl = getUndoTtlMs();
      const valid = records.filter(
        (r) => !r.expired && now - r.createdAt < ttl,
      );
      set({ records: valid });
    }
  },

  cleanExpired: async () => {
    const now = Date.now();
    const ttl = getUndoTtlMs();
    const records = get().records.filter(
      (r) => !r.expired && now - r.createdAt < ttl,
    );
    set({ records });
    await setData(UNDO_STORAGE_KEY, records);
  },
}));