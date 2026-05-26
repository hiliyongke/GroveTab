/**
 * useSettingsDraft — 设置预演草稿 Hook（任务8）
 *
 * 工作流：
 *   1. 进入预演模式：将当前设置快照到内存
 *   2. 用户调整设置时只更新内存草稿，不落 storage.local
 *   3. 确认：将草稿 merge 到 storage.local（调用 updateSettings）
 *   4. 取消：从内存快照恢复原始设置，丢弃草稿
 *
 * 使用方：
 *   const { draft, isDrafting, startDraft, updateDraft, commitDraft, cancelDraft } = useSettingsDraft();
 */

import { useState, useCallback } from "react";
import type { UserSettings } from "@/shared/types";
import { useSettingsStore } from "@/store";

export interface UseSettingsDraftReturn {
  /** 当前草稿（预演模式下有效，否则为 null） */
  draft: UserSettings | null;
  /** 是否处于预演模式 */
  isDrafting: boolean;
  /** 进入预演模式，快照当前设置 */
  startDraft: () => void;
  /** 更新草稿（仅内存，不落盘） */
  updateDraft: (patch: Partial<UserSettings>) => void;
  /** 确认：将草稿落盘到 storage.local */
  commitDraft: () => Promise<void>;
  /** 取消：恢复原始快照，退出预演模式 */
  cancelDraft: () => Promise<void>;
}

export function useSettingsDraft(): UseSettingsDraftReturn {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const [draft, setDraft] = useState<UserSettings | null>(null);
  const [snapshot, setSnapshot] = useState<UserSettings | null>(null);

  const startDraft = useCallback(() => {
    const current = settings;
    setSnapshot(current);
    setDraft({ ...current });
  }, [settings]);

  const updateDraft = useCallback((patch: Partial<UserSettings>) => {
    setDraft((prev) => (prev === null ? null : { ...prev, ...patch }));
  }, []);

  const commitDraft = useCallback(async () => {
    if (draft === null) return;
    await updateSettings(draft);
    setDraft(null);
    setSnapshot(null);
  }, [draft, updateSettings]);

  const cancelDraft = useCallback(async () => {
    if (snapshot !== null) {
      // 恢复原始快照到 store（乐观更新，不等待落盘）
      await updateSettings(snapshot);
    }
    setDraft(null);
    setSnapshot(null);
  }, [snapshot, updateSettings]);

  return {
    draft,
    isDrafting: draft !== null,
    startDraft,
    updateDraft,
    commitDraft,
    cancelDraft,
  };
}
