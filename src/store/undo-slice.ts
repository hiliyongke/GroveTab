/**
 * Zustand Store — Undo Slice
 *
 * 管理关闭标签页的撤销记录，持久化到 chrome.storage.local。
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

function getUndoTtlMs(): number {
  const seconds = useSettingsStore.getState().settings.undoWindowSeconds;
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return DEFAULT_UNDO_TTL_MS;
  return Math.min(10, Math.max(3, seconds)) * 1_000;
}

interface UndoState {
  records: UndoRecord[];
  /** Active (most recent) undo record for toast display */
  activeToast: UndoRecord | null;

  /** Add an undo record and persist it */
  addRecord: (
    tabs: ClosedTabSnapshot[],
    description: string,
    extra?: { archivedSessionId?: string; subNote?: string },
  ) => Promise<UndoRecord>;
  /** Undo (restore) a record */
  undoRecord: (recordId: string) => Promise<void>;
  /** Dismiss the active toast without undoing */
  dismissToast: () => void;
  /** Load records from storage */
  loadRecords: () => Promise<void>;
  /** Clean expired records */
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
    // 先同步写内存，再异步持久化。持久化失败不阻塞关闭流程。
    set({ records, activeToast: record });
    void setData(UNDO_STORAGE_KEY, records).catch((err) => {
      console.warn(`${BRAND.logTag} undo persist failed (record still in memory)`, err);
    });

    // TTL 到时自动过期
    setTimeout(() => {
      const current = get();
      if (current.activeToast?.id === record.id) {
        set({ activeToast: null });
      }
      const updated = current.records.map((r) =>
        r.id === record.id ? { ...r, expired: true } : r,
      );
      set({ records: updated });
      void setData(UNDO_STORAGE_KEY, updated).catch(() => {});
    }, getUndoTtlMs());
    // TTL 在 addRecord 时固化，后续修改设置不影响已有记录。

    return Promise.resolve(record);
  },

  undoRecord: async (recordId) => {
    const record = get().records.find((r) => r.id === recordId);
    if (!record || record.expired) return;

    const urls = filterSafeExternalUrls(record.tabs.map((t) => t.url).filter(Boolean));

    /** 在当前窗口顺序恢复标签页，避免并发建 tab 触发限流。 */
    try {
      if (urls.length === 1) {
        await createTab({ url: urls[0], active: false });
      } else if (urls.length > 1) {
        const currentWindow = await getCurrentWindow();
        const windowId = currentWindow?.id;
        for (const url of urls) {
          await createTab({ url, windowId, active: false });
        }
      }
    } catch (err) {
      feedback.error(translate('恢复失败，请重试'), err);
    }

    const records = get().records.filter((r) => r.id !== recordId);
    set({ records, activeToast: null });
    void setData(UNDO_STORAGE_KEY, records).catch(() => {});
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