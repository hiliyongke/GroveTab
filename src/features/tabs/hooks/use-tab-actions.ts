/**
 * useTabActions —— Tab 操作统一 Hook
 *
 * 提取 CompactView / FrequencyView / TimelineView / GridView 中
 * 重复的 Tab 操作逻辑。
 *
 * 设计原则：
 *   1. 稳定引用 —— 依赖 zustand store 的 selector，避免子组件重渲染
 *   2. 完整 API   —— 暴露视图组件需要的全部 Tab 操作方法
 *   3. 类型安全   —— Tab ID 为 number，Window ID 为 number
 *   4. 单一职责 —— 仅包含 Tab 本身操作，元数据操作由独立 Hook 负责
 *
 * 使用示例：
 *   const { handleJump, handleClose, handlePin, handleDiscard } = useTabActions();
 */

import { useCallback } from 'react';
import { useTabsStore, useMetadataStore, useSpeedDialStore } from '@/store';
import { splitTabToSide } from '@/chrome';

/**
 * Tab 操作 Hook 返回值
 */
export interface TabActions {
  /** 跳转至指定 Tab */
  handleJump: (id: number, wid: number) => void;
  /** 关闭单个 Tab */
  handleClose: (id: number) => void;
  /** 批量关闭 Tab */
  handleBatchClose: (ids: number[]) => void;
  /** 切换 Pin 状态 */
  handlePin: (url: string) => void;
  /** 休眠单个 Tab（discard） */
  handleDiscard: (id: number) => Promise<void>;
  /** 将 Tab 移至新窗口（分屏） */
  handleSplitToSide: (id: number) => Promise<void>;
  /** 添加标签 */
  handleAddTag: (url: string, tag: string) => void;
  /** 移除标签 */
  handleRemoveTag: (url: string, tag: string) => void;
  /** 设置备注 */
  handleSetNote: (url: string, note: string) => void;
  /** 添加到常用站点（Speed Dial） */
  handleAddToSpeedDial: (site: { id: string; url: string; title: string; favIconUrl?: string; order: number; createdAt: number }) => Promise<void>;
}

/**
 * Tab 操作统一 Hook
 *
 * 组合 tabs store 与 metadata store 的操作方法，
 * 为视图组件提供统一的 Tab 操作接口。
 *
 * @returns Tab 操作方法集合
 */
export function useTabActions(): TabActions {
  // Tabs Store
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const closeSingleTab = useTabsStore((s) => s.closeSingleTab);
  const closeTabs = useTabsStore((s) => s.closeMultipleTabs);
  const discardTab = useTabsStore((s) => s.discardTab);

  // Metadata Store
  const togglePin = useMetadataStore((s) => s.togglePin);
  const addTag = useMetadataStore((s) => s.addTag);
  const removeTag = useMetadataStore((s) => s.removeTag);
  const setNote = useMetadataStore((s) => s.setNote);

  // Speed Dial Store
  const addSite = useSpeedDialStore((s) => s.addSite);

  // ── 基础操作 ──

  const handleJump = useCallback(
    (id: number, wid: number) => {
      void jumpToTab(id, wid);
    },
    [jumpToTab],
  );

  const handleClose = useCallback(
    (id: number) => {
      void closeSingleTab(id);
    },
    [closeSingleTab],
  );

  const handleBatchClose = useCallback(
    (ids: number[]) => {
      void closeTabs(ids);
    },
    [closeTabs],
  );

  // ── Pin 操作 ──

  const handlePin = useCallback(
    (url: string) => {
      togglePin(url);
    },
    [togglePin],
  );

  // ── 休眠操作 ──

  const handleDiscard = useCallback(
    async (id: number) => {
      try {
        await discardTab(id);
      } catch {
        /* store 已 toast */
      }
    },
    [discardTab],
  );

  // ── 分屏操作 ──

  const handleSplitToSide = useCallback(
    async (id: number) => {
      try {
        await splitTabToSide(id);
      } catch {
        /* splitTabToSide 内部已 safeCall */
      }
    },
    [],
  );

  // ── 标签操作 ──

  const handleAddTag = useCallback(
    (url: string, tag: string) => {
      const v = tag.trim();
      if (v) {
        addTag(url, v);
      }
    },
    [addTag],
  );

  const handleRemoveTag = useCallback(
    (url: string, tag: string) => {
      removeTag(url, tag);
    },
    [removeTag],
  );

  // ── 备注操作 ──

  const handleSetNote = useCallback(
    (url: string, note: string) => {
      setNote(url, note);
    },
    [setNote],
  );

  // ── 常用站点操作 ──

  const handleAddToSpeedDial = useCallback(
    async (site: { id: string; url: string; title: string; favIconUrl?: string; order: number; createdAt: number }) => {
      try {
        await addSite(site);
      } catch {
        /* store 已处理 */
      }
    },
    [addSite],
  );

  return {
    handleJump,
    handleClose,
    handleBatchClose,
    handlePin,
    handleDiscard,
    handleSplitToSide,
    handleAddTag,
    handleRemoveTag,
    handleSetNote,
    handleAddToSpeedDial,
  };
}
