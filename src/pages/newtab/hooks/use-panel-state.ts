import { useState, useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import { useSettingsStore } from "@/store";
import { track } from "@/shared/utils/metrics";
import type { NewtabPageMode } from "@/shared/types";

export interface PanelState {
  showSearch: boolean;
  showSettings: boolean;
  showInsights: boolean;
  showHistory: boolean;
  /** 支持函数式更新，如 setShowSearch(v => !v) */
  setShowSearch: Dispatch<SetStateAction<boolean>>;
  setShowSettings: Dispatch<SetStateAction<boolean>>;
  setShowInsights: Dispatch<SetStateAction<boolean>>;
  setShowHistory: Dispatch<SetStateAction<boolean>>;
  handleOpenSearch: () => void;
  handleOpenSettings: () => void;
  handleOpenInsights: () => void;
  handleOpenHistory: () => void;
  handlePageModeChange: (mode: NewtabPageMode) => void;
  handleOpenArchive: () => void;
}

/**
 * usePanelState —— 管理所有浮层面板（搜索、设置、洞察、历史）的开关状态。
 *
 * 面板之间互斥：打开任意一个时，其余面板自动关闭。
 */
export function usePanelState(options: {
  /** hash 路由触发的初始设置面板打开标志 */
  openSettingsFromHash: boolean;
  /** hash 路由触发的初始设置 Tab */
  initialSettingsTab: "appearance" | "about";
  /** searchFromHash 触发搜索框显示 */
  searchFromHash: boolean;
// 明确标注返回类型，防止 TypeScript 将 useCallback 推断为 error 类型
}): PanelState {
  const { openSettingsFromHash, initialSettingsTab, searchFromHash } = options;

  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // hash 路由触发设置面板
  useEffect(() => {
    if (initialSettingsTab === "about" || openSettingsFromHash) {
      setShowSettings(true);
    }
  }, [initialSettingsTab, openSettingsFromHash]);

  // hash 路由触发搜索框
  useEffect(() => {
    if (searchFromHash) {
      setShowSearch(true);
    }
  }, [searchFromHash]);

  const handleOpenSearch = useCallback(() => {
    setShowSearch(true);
    setShowSettings(false);
    setShowInsights(false);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setShowSettings(true);
    setShowSearch(false);
    setShowInsights(false);
  }, []);

  const handleOpenInsights = useCallback(() => {
    setShowInsights(true);
    setShowSearch(false);
    setShowSettings(false);
  }, []);

  const handleOpenHistory = useCallback(() => {
    setShowHistory(true);
    setShowSearch(false);
    setShowSettings(false);
    setShowInsights(false);
  }, []);

  const handlePageModeChange = useCallback((mode: NewtabPageMode) => {
    const prev = useSettingsStore.getState().settings.newtabPageMode ?? "workspace";
    void useSettingsStore.getState().updateSettings({ newtabPageMode: mode });
    setShowSearch(false);
    setShowSettings(false);
    setShowInsights(false);
    void track("newtab_page_mode_switch", { from: prev, to: mode });
  }, []);

  const handleOpenArchive = useCallback(() => {
    const currentMode = useSettingsStore.getState().settings.newtabPageMode;
    if (currentMode !== "workspace") {
      void useSettingsStore.getState().updateSettings({ newtabPageMode: "workspace" });
    }
    void useSettingsStore.getState().updateSettings({ defaultView: "archive" });
    setShowSearch(false);
    setShowSettings(false);
    setShowInsights(false);
  }, []);

  return {
    showSearch,
    showSettings,
    showInsights,
    showHistory,
    setShowSearch,
    setShowSettings,
    setShowInsights,
    setShowHistory,
    handleOpenSearch,
    handleOpenSettings,
    handleOpenInsights,
    handleOpenHistory,
    handlePageModeChange,
    handleOpenArchive,
  };
}
