/**
 * Zustand Store — Speed Dial Slice（常用站点）
 *
 * 管理用户自定义的常用站点列表：增删改查、拖拽排序。
 * 数据持久化至 chrome.storage.local，通过 storage-repo CRUD。
 *
 * Slice 依赖关系：
 *   - 依赖 settings-slice：读取 settings.speedDialGroupEnabled 决定是否分组显示
 *   - 独立 slice，不依赖 undo/selection/tabs/kanban/stats slice
 *   - 被 QuickStartLayer 和 AppWorkspace 消费
 */

import { create } from 'zustand';
import type { SpeedDialSite } from '@/shared/types';
import {
  getSpeedDialSites,
  addSpeedDialSite as repoAdd,
  batchAddSpeedDialSites as repoBatchAdd,
  updateSpeedDialSite as repoUpdate,
  removeSpeedDialSite as repoRemove,
  reorderSpeedDialSites as repoReorder,
} from '@/repositories';

interface SpeedDialState {
  /** 常用站点列表，按 order 升序 */
  sites: readonly SpeedDialSite[];
  /** 是否已从 storage 加载 */
  loaded: boolean;
  /** 从 storage 加载站点列表 */
  loadSites: () => Promise<void>;
  /** 新增站点 */
  addSite: (site: SpeedDialSite) => Promise<void>;
  /** 更新站点 */
  updateSite: (partial: Partial<SpeedDialSite> & { id: string }) => Promise<void>;
  /** 删除站点 */
  removeSite: (id: string) => Promise<void>;
  /** 拖拽重排 */
  reorderSites: (reorderedIds: string[]) => Promise<void>;
  /** 批量导入站点（自动去重） */
  batchImport: (sites: SpeedDialSite[]) => Promise<void>;
}

export const useSpeedDialStore = create<SpeedDialState>((set) => ({
  sites: [],
  loaded: false,

  loadSites: async () => {
    const sites = await getSpeedDialSites();
    set({ sites, loaded: true });
  },

  addSite: async (site) => {
    try {
      const sites = await repoAdd(site);
      set({ sites });
    } catch (err) {
      console.error('[speed-dial] addSite failed:', err);
    }
  },

  updateSite: async (partial) => {
    try {
      const sites = await repoUpdate(partial);
      set({ sites });
    } catch (err) {
      console.error('[speed-dial] updateSite failed:', err);
    }
  },

  removeSite: async (id) => {
    try {
      const sites = await repoRemove(id);
      set({ sites });
    } catch (err) {
      console.error('[speed-dial] removeSite failed:', err);
    }
  },

  reorderSites: async (reorderedIds) => {
    try {
      const sites = await repoReorder(reorderedIds);
      set({ sites });
    } catch (err) {
      console.error('[speed-dial] reorderSites failed:', err);
    }
  },

  batchImport: async (newSites) => {
    try {
      const sites = await repoBatchAdd(newSites);
      set({ sites });
    } catch (err) {
      console.error('[speed-dial] batchImport failed:', err);
    }
  },
}));
