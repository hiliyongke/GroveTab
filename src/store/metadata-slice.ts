/**
 * Zustand Store — Metadata Slice
 *
 * 管理标签、备注、固定、最近活动、工作区等元数据。
 */

import { create } from "zustand";
import type { ActivityRecord, Workspace } from "@/shared/types";
import {
  getData,
  setData,
  getRecentActivity,
  pushActivity as repoPushActivity,
  clearActivity as repoClearActivity,
  getWorkspaces,
  saveWorkspaces,
  getWindowAliases,
  saveWindowAliases,
  appendHistoryEvent,
} from "@/repositories";
import { STORAGE_KEYS } from "@/shared/config/storage-keys";
import { normalizeMetadataKey as normalizeKey } from "@/shared/utils/metadata-key";

const TAGS_KEY = STORAGE_KEYS.tags;
const NOTES_KEY = STORAGE_KEYS.notes;
const PINS_KEY = STORAGE_KEYS.pins;

/** 稳定的空数组引用，避免 selector 触发无限重渲染。 */
const EMPTY_TAGS: readonly string[] = Object.freeze([]);
const EMPTY_ACTIVITY: readonly ActivityRecord[] = Object.freeze([]);
const EMPTY_WORKSPACES: readonly Workspace[] = Object.freeze([]);

interface MetadataState {
  tags: Record<string, string[]>;
  notes: Record<string, string>;
  pinnedUrls: Set<string>;
  recentActivity: readonly ActivityRecord[];
  workspaces: readonly Workspace[];
  windowAliases: Record<number, string>;
  windowColors: Record<number, string>;

  loadMetadata: () => Promise<void>;
  addTag: (url: string, tag: string) => Promise<void>;
  removeTag: (url: string, tag: string) => Promise<void>;
  setNote: (url: string, note: string) => Promise<void>;
  removeNote: (url: string) => Promise<void>;
  togglePin: (url: string) => Promise<void>;
  isPinned: (url: string) => boolean;
  getTags: (url: string) => readonly string[];
  getNote: (url: string) => string;

  pushActivity: (record: ActivityRecord) => Promise<void>;
  clearActivity: () => Promise<void>;
  setWorkspaces: (list: Workspace[]) => Promise<void>;
  upsertWorkspace: (workspace: Workspace) => Promise<void>;
  removeWorkspace: (id: string) => Promise<void>;
  setWindowAlias: (windowId: number, alias: string) => Promise<void>;
  setWindowColor: (windowId: number, color: string) => Promise<void>;
  gcWindowAliases: (activeWindowIds: readonly number[]) => Promise<void>;
}

export const useMetadataStore = create<MetadataState>((set, get) => ({
  tags: {},
  notes: {},
  pinnedUrls: new Set<string>(),
  recentActivity: EMPTY_ACTIVITY,
  workspaces: EMPTY_WORKSPACES,
  windowAliases: {},
  windowColors: {},

  loadMetadata: async () => {
    const [tags, notes, pins, activity, workspaces, windowAliases, windowColors] =
      await Promise.all([
        getData<Record<string, string[]>>(TAGS_KEY),
        getData<Record<string, string>>(NOTES_KEY),
        getData<string[]>(PINS_KEY),
        getRecentActivity(),
        getWorkspaces(),
        getWindowAliases(),
        getData<Record<number, string>>("grove_window_colors"),
      ]);
    set({
      tags: tags ?? {},
      notes: notes ?? {},
      pinnedUrls: new Set(pins ?? []),
      recentActivity: activity.length > 0 ? activity : EMPTY_ACTIVITY,
      workspaces: workspaces.length > 0 ? workspaces : EMPTY_WORKSPACES,
      windowAliases,
      windowColors: windowColors ?? {},
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
      void appendHistoryEvent({
        type: "tab_tagged",
        url,
        title: tag,
        extra: { tag },
        undoable: true,
        // url+tag 是必需上下文，undo handler 调用 removeTag(url, tag)
        undoContext: { url, tag },
      });
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
    if (note.trim() !== "") {
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
  getTags: (url) => get().tags[normalizeKey(url)] ?? EMPTY_TAGS,
  getNote: (url) => get().notes[normalizeKey(url)] ?? "",

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

  setWindowAlias: async (windowId, alias) => {
    const trimmed = alias.trim();
    const windowAliases = { ...get().windowAliases };
    if (trimmed === "") {
      delete windowAliases[windowId];
    } else {
      windowAliases[windowId] = trimmed;
    }
    set({ windowAliases });
    await saveWindowAliases(windowAliases);
  },

  setWindowColor: async (windowId, color) => {
    const windowColors = { ...get().windowColors };
    if (color === "") {
      delete windowColors[windowId];
    } else {
      windowColors[windowId] = color;
    }
    set({ windowColors });
    await setData("grove_window_colors", windowColors);
  },

  gcWindowAliases: async (activeWindowIds) => {
    const active = new Set(activeWindowIds);
    const entries = Object.entries(get().windowAliases).filter(([windowId]) =>
      active.has(Number(windowId)),
    );
    const next = Object.fromEntries(entries) as Record<number, string>;
    if (entries.length === Object.keys(get().windowAliases).length) return;
    set({ windowAliases: next });
    await saveWindowAliases(next);
  },
}));
