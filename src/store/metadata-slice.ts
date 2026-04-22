/**
 * Zustand Store — Metadata Slice (tags, notes, pins)
 */

import { create } from 'zustand';
import { getData, setData } from '@/repositories';

const TAGS_KEY = 'canopy_tags';
const NOTES_KEY = 'canopy_notes';
const PINS_KEY = 'canopy_pins';

/**
 * 稳定的空数组引用。
 *
 * 注意：selector 在无匹配时必须返回同一个引用，否则 zustand 会误判 snapshot 变化，
 * 在 React 18/19 的 useSyncExternalStore 机制下触发无限重渲染（React error #185）。
 */
const EMPTY_TAGS: readonly string[] = Object.freeze([]);

interface MetadataState {
  tags: Record<string, string[]>;
  notes: Record<string, string>;
  pinnedUrls: Set<string>;

  loadMetadata: () => Promise<void>;
  addTag: (url: string, tag: string) => Promise<void>;
  removeTag: (url: string, tag: string) => Promise<void>;
  setNote: (url: string, note: string) => Promise<void>;
  removeNote: (url: string) => Promise<void>;
  togglePin: (url: string) => Promise<void>;
  isPinned: (url: string) => boolean;
  getTags: (url: string) => string[];
  getNote: (url: string) => string;
}

export const useMetadataStore = create<MetadataState>((set, get) => ({
  tags: {},
  notes: {},
  pinnedUrls: new Set<string>(),

  loadMetadata: async () => {
    const [tags, notes, pins] = await Promise.all([
      getData<Record<string, string[]>>(TAGS_KEY),
      getData<Record<string, string>>(NOTES_KEY),
      getData<string[]>(PINS_KEY),
    ]);
    set({
      tags: tags || {},
      notes: notes || {},
      pinnedUrls: new Set(pins || []),
    });
  },

  addTag: async (url, tag) => {
    const tags = { ...get().tags };
    const key = normalizeKey(url);
    const existing = tags[key] || [];
    if (!existing.includes(tag)) {
      tags[key] = [...existing, tag];
      set({ tags });
      await setData(TAGS_KEY, tags);
    }
  },

  removeTag: async (url, tag) => {
    const tags = { ...get().tags };
    const key = normalizeKey(url);
    tags[key] = (tags[key] || []).filter((t) => t !== tag);
    if (tags[key].length === 0) delete tags[key];
    set({ tags });
    await setData(TAGS_KEY, tags);
  },

  setNote: async (url, note) => {
    const notes = { ...get().notes };
    const key = normalizeKey(url);
    if (note.trim()) {
      notes[key] = note.trim();
    } else {
      delete notes[key];
    }
    set({ notes });
    await setData(NOTES_KEY, notes);
  },

  removeNote: async (url) => {
    const notes = { ...get().notes };
    const key = normalizeKey(url);
    delete notes[key];
    set({ notes });
    await setData(NOTES_KEY, notes);
  },

  togglePin: async (url) => {
    const key = normalizeKey(url);
    const pinnedUrls = new Set(get().pinnedUrls);
    if (pinnedUrls.has(key)) {
      pinnedUrls.delete(key);
    } else {
      pinnedUrls.add(key);
    }
    set({ pinnedUrls });
    await setData(PINS_KEY, Array.from(pinnedUrls));
  },

  isPinned: (url) => get().pinnedUrls.has(normalizeKey(url)),
  getTags: (url) => get().tags[normalizeKey(url)] ?? (EMPTY_TAGS as string[]),
  getNote: (url) => get().notes[normalizeKey(url)] ?? '',
}));

/** Normalize URL for consistent keying (strip hash + trailing slash) */
function normalizeKey(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return url;
  }
}
