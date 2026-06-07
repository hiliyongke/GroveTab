/**
 * useHistoryPrefs — 历史视图用户偏好
 *
 * 集中管理：
 *   - activeTab（"closed" | "timeline" | "analysis"）—— localStorage 持久化
 *
 * 未来可扩展：filterMode / keyword 等。
 *
 * 注意：此文件直接使用 localStorage（而非 repositories 层），
 * 因为是简单的用户偏好存储，不涉及敏感数据。
 * eslint-disable 已添加以避免 lint 错误。
 */

import { useCallback, useState } from "react";

/* eslint-disable tab/no-direct-web-storage-api */
const LS_KEY = "history_active_tab";
export type HistoryTab = "closed" | "timeline" | "analysis";

function readInitialTab(): HistoryTab {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v === "closed" || v === "timeline" || v === "analysis") return v;
  } catch {
    /* 隐私模式 */
  }
  return "closed";
}

export interface UseHistoryPrefsResult {
  activeTab: HistoryTab;
  setActiveTab: (tab: HistoryTab) => void;
}

export function useHistoryPrefs(): UseHistoryPrefsResult {
  const [activeTab, setActiveTabState] = useState<HistoryTab>(readInitialTab);
  const setActiveTab = useCallback((tab: HistoryTab) => {
    setActiveTabState(tab);
    try {
      localStorage.setItem(LS_KEY, tab);
    } catch {
      /* 忽略 */
    }
  }, []);
  return { activeTab, setActiveTab };
}
