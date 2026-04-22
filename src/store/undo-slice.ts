/**
 * Zustand Store — Undo Slice
 *
 * Manages undo records for closed tabs.
 * Records are persisted to chrome.storage.local and synced across new tab pages.
 */

import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { UndoRecord, ClosedTabSnapshot } from '@/shared/types';
import { getData, setData } from '@/repositories';

const UNDO_STORAGE_KEY = 'canopy_undo';
const UNDO_TTL = 30_000; // 30 seconds to undo
const MAX_UNDO_RECORDS = 5;

interface UndoState {
  records: UndoRecord[];
  /** Active (most recent) undo record for toast display */
  activeToast: UndoRecord | null;

  /** Add an undo record and persist it */
  addRecord: (tabs: ClosedTabSnapshot[], description: string) => Promise<UndoRecord>;
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

  addRecord: async (tabs, description) => {
    const record: UndoRecord = {
      id: nanoid(8),
      createdAt: Date.now(),
      tabs,
      description,
      expired: false,
    };

    const records = [record, ...get().records].slice(0, MAX_UNDO_RECORDS);
    set({ records, activeToast: record });
    await setData(UNDO_STORAGE_KEY, records);

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
      setData(UNDO_STORAGE_KEY, updated);
    }, UNDO_TTL);

    return record;
  },

  undoRecord: async (recordId) => {
    const record = get().records.find((r) => r.id === recordId);
    if (!record || record.expired) return;

    // Restore tabs by opening them in a new window or current window
    const urls = record.tabs.map((t) => t.url);
    if (urls.length > 0) {
      if (urls.length === 1) {
        // Single tab: open in current window
        chrome.tabs.create({ url: urls[0] });
      } else {
        // Multiple tabs: open in a new window
        chrome.windows.create({ url: urls });
      }
    }

    // Remove the undo record
    const records = get().records.filter((r) => r.id !== recordId);
    set({ records, activeToast: null });
    await setData(UNDO_STORAGE_KEY, records);
  },

  dismissToast: () => {
    set({ activeToast: null });
  },

  loadRecords: async () => {
    const records = await getData<UndoRecord[]>(UNDO_STORAGE_KEY);
    if (records) {
      // Filter out expired records
      const now = Date.now();
      const valid = records.filter(
        (r) => !r.expired && now - r.createdAt < UNDO_TTL,
      );
      set({ records: valid });
    }
  },

  cleanExpired: async () => {
    const now = Date.now();
    const records = get().records.filter(
      (r) => !r.expired && now - r.createdAt < UNDO_TTL,
    );
    set({ records });
    await setData(UNDO_STORAGE_KEY, records);
  },
}));
