/**
 * Zustand Store — Metadata Slice (tags, notes, pins, recent activity, workspaces)
 */

import { create } from 'zustand';
import type { ActivityRecord, Workspace } from '@/shared/types';
import {
  getData,
  setData,
  getRecentActivity,
  pushActivity as repoPushActivity,
  clearActivity as repoClearActivity,
  getWorkspaces,
  saveWorkspaces,
} from '@/repositories';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';

const TAGS_KEY = STORAGE_KEYS.tags;
const NOTES_KEY = STORAGE_KEYS.notes;
const PINS_KEY = STORAGE_KEYS.pins;

/**
 * 稳定的空数组引用。
 *
 * 注意：selector 在无匹配时必须返回同一个引用，否则 zustand 会误判 snapshot 变化，
 * 在 React 18/19 的 useSyncExternalStore 机制下触发无限重渲染（React error #185）。
 */
const EMPTY_TAGS: readonly string[] = Object.freeze([]);
const EMPTY_ACTIVITY: readonly ActivityRecord[] = Object.freeze([]);
const EMPTY_WORKSPACES: readonly Workspace[] = Object.freeze([]);

interface MetadataState {
  tags: Record<string, string[]>;
  notes: Record<string, string>;
  pinnedUrls: Set<string>;
  /** 最近操作 ring buffer（由 repositories 持久化；最多 20 条，72h 过期） */
  recentActivity: readonly ActivityRecord[];
  /** 用户自定义工作区（最多 3 个） */
  workspaces: readonly Workspace[];

  loadMetadata: () => Promise<void>;
  addTag: (url: string, tag: string) => Promise<void>;
  removeTag: (url: string, tag: string) => Promise<void>;
  setNote: (url: string, note: string) => Promise<void>;
  removeNote: (url: string) => Promise<void>;
  togglePin: (url: string) => Promise<void>;
  isPinned: (url: string) => boolean;
  getTags: (url: string) => string[];
  getNote: (url: string) => string;

  // ── v1.0 封板新增 ──
  pushActivity: (record: ActivityRecord) => Promise<void>;
  clearActivity: () => Promise<void>;
  setWorkspaces: (list: Workspace[]) => Promise<void>;
  upsertWorkspace: (workspace: Workspace) => Promise<void>;
  removeWorkspace: (id: string) => Promise<void>;
}

export const useMetadataStore = create<MetadataState>((set, get) => ({
  tags: {},
  notes: {},
  pinnedUrls: new Set<string>(),
  recentActivity: EMPTY_ACTIVITY,
  workspaces: EMPTY_WORKSPACES,

  loadMetadata: async () => {
    const [tags, notes, pins, activity, workspaces] = await Promise.all([
      getData<Record<string, string[]>>(TAGS_KEY),
      getData<Record<string, string>>(NOTES_KEY),
      getData<string[]>(PINS_KEY),
      getRecentActivity(),
      getWorkspaces(),
    ]);
    set({
      tags: tags ?? {},
      notes: notes ?? {},
      pinnedUrls: new Set(pins ?? []),
      recentActivity: activity.length > 0 ? activity : EMPTY_ACTIVITY,
      workspaces: workspaces.length > 0 ? workspaces : EMPTY_WORKSPACES,
    });
  },

  addTag: async (url, tag) => {
    const tags = { ...get().tags };
    const key = normalizeKey(url);
    const existing = tags[key] ?? [];
    if (!existing.includes(tag)) {
      tags[key] = [...existing, tag];
      set({ tags });
      await setData(TAGS_KEY, tags);
    }
  },

  removeTag: async (url, tag) => {
    const tags = { ...get().tags };
    const key = normalizeKey(url);
    tags[key] = (tags[key] ?? []).filter((t) => t !== tag);
    if (tags[key].length === 0) delete tags[key];
    set({ tags });
    await setData(TAGS_KEY, tags);
  },

  setNote: async (url, note) => {
    const notes = { ...get().notes };
    const key = normalizeKey(url);
    if (note.trim() !== '') {
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

  // ── v1.0 封板新增：Activity Strip / Workspace ──

  pushActivity: async (record) => {
    const next = await repoPushActivity(record);
    set({ recentActivity: next.length > 0 ? next : EMPTY_ACTIVITY });
  },

  clearActivity: async () => {
    await repoClearActivity();
    set({ recentActivity: EMPTY_ACTIVITY });
  },

  setWorkspaces: async (list) => {
    const trimmed = list.slice(0, 3);
    await saveWorkspaces(trimmed);
    set({ workspaces: trimmed.length > 0 ? trimmed : EMPTY_WORKSPACES });
  },

  upsertWorkspace: async (workspace) => {
    const current = [...get().workspaces];
    const idx = current.findIndex((w) => w.id === workspace.id);
    if (idx >= 0) {
      current[idx] = workspace;
    } else {
      if (current.length >= 3) {
        // 超过免费额度，静默拒绝；UI 侧应在调用前校验
        return;
      }
      current.push(workspace);
    }
    await saveWorkspaces(current);
    set({ workspaces: current });
  },

  removeWorkspace: async (id) => {
    const next = get().workspaces.filter((w) => w.id !== id);
    await saveWorkspaces([...next]);
    set({ workspaces: next.length > 0 ? next : EMPTY_WORKSPACES });
  },
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
