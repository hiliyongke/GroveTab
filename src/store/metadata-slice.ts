/**
 * Zustand Store — Metadata Slice (tags, notes, pins, recent activity, workspaces)
 *
 * Slice 依赖关系：
 *   - 依赖 settings-slice：无直接依赖（设置变更不影响 metadata）
 *   - 被 tabs-slice 间接关联：pin/unpin 操作影响 tabs 列表的显示（如排序固定标签）
 *   - 不依赖 undo-slice、selection-slice、kanban-slice、stats-slice、speed-dial-slice
 *
 * 上游被以下模块依赖：
 *   - AppWorkspace：消费 pinnedUrls, tags, notes 等
 *   - HeroBar：消费 isPinned
 *   - ActivityStrip：消费 recentActivity
 *   - WorkspaceSwitcher：消费 workspaces
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
  appendHistoryEvent,
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
  /** 标签映射表（URL → 标签数组），持久化到 chrome.storage.local */
  tags: Record<string, string[]>;
  /** 备注映射表（URL → 备注文本），持久化到 chrome.storage.local */
  notes: Record<string, string>;
  /** 固定 URL 集合（快速访问固定标签页） */
  pinnedUrls: Set<string>;
  /** 最近操作 ring buffer（由 repositories 持久化；最多 20 条，72h 过期） */
  recentActivity: readonly ActivityRecord[];
  /** 用户自定义工作区列表（最多 3 个） */
  workspaces: readonly Workspace[];

  // Actions
  /** 从 chrome.storage.local 加载所有元数据（tags, notes, pins, activity, workspaces） */
  loadMetadata: () => Promise<void>;
  /** 为指定 URL 添加标签（自动去重，附加可撤销的历史事件） */
  addTag: (url: string, tag: string) => Promise<void>;
  /** 移除指定 URL 的指定标签 */
  removeTag: (url: string, tag: string) => Promise<void>;
  /** 为指定 URL 设置备注（空字符串时删除备注） */
  setNote: (url: string, note: string) => Promise<void>;
  /** 删除指定 URL 的备注 */
  removeNote: (url: string) => Promise<void>;
  /** 切换指定 URL 的固定状态（固定↔取消固定） */
  togglePin: (url: string) => Promise<void>;
  /** 检查指定 URL 是否已固定 */
  isPinned: (url: string) => boolean;
  /** 获取指定 URL 的标签列表（无标签时返回空数组） */
  getTags: (url: string) => readonly string[];
  /** 获取指定 URL 的备注（无备注时返回空字符串） */
  getNote: (url: string) => string;

  // ── v1.0 封板新增 ──
  /** 推送一条最近操作记录（会写入 ring buffer 并持久化） */
  pushActivity: (record: ActivityRecord) => Promise<void>;
  /** 清空所有最近操作记录 */
  clearActivity: () => Promise<void>;
  /** 设置工作区列表（外部已截断到最多 3 个） */
  setWorkspaces: (list: Workspace[]) => Promise<void>;
  /** 新增或更新工作区（已存在则更新，否则追加；超过 3 个时静默拒绝） */
  upsertWorkspace: (workspace: Workspace) => Promise<void>;
  /** 根据 id 删除工作区 */
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
      // 同步写一条 undoable 的「tab_tagged」事件，让「插件历史」有入口可反悔
      void appendHistoryEvent({
        type: 'tab_tagged',
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
  getTags: (url) => get().tags[normalizeKey(url)] ?? EMPTY_TAGS,
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

/**
 * 规范化 URL，作为存储键
 *
 * 移除 hash 部分和末尾斜杠，确保同一 URL 的不同表示形式
 * （如 https://example.com#top 和 https://example.com/）使用相同的键。
 *
 * @param url 原始 URL 字符串
 * @returns 规范化后的 URL 字符串；解析失败则返回原值
 */
function normalizeKey(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return url;
  }
}
