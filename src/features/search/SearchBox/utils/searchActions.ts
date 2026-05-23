/**
 * 搜索相关操作函数
 *
 * 包含执行搜索、打开历史记录、恢复关闭的标签等操作
 */

import type { SearchEngineId, CustomSearchEngine, ClosedTabRecord } from "@/shared/types";
import type { HistorySearchEntry } from "@/chrome";
import { createTab } from "@/chrome";
import { buildSearchUrl } from "@/shared/config/search-engines";
import { pushRecentSearch } from "@/repositories/storage-repo";
import { deleteClosedTab } from "@/repositories/history-repo";
import { track } from "@/shared/utils/metrics";
import type { UniversalSearchItem } from "../types";

interface SearchActionsOptions {
  customEngines: CustomSearchEngine[];
  close: () => void;
  setRecentSearches: (updater: (prev: string[]) => string[]) => void;
  jumpToTab: (tabId: number, windowId: number) => void;
  setClosedTabRecords: (updater: (prev: ClosedTabRecord[]) => ClosedTabRecord[]) => void;
  onOpenHistory?: () => void;
}

/**
 * 创建搜索相关操作函数
 *
 * @param options - 配置选项
 * @returns 操作函数对象
 */
export function createSearchActions(options: SearchActionsOptions) {
  const { customEngines, close, setRecentSearches, jumpToTab, setClosedTabRecords, onOpenHistory } =
    options;

  /**
   * 执行网页搜索
   * @param searchQuery
   * @param engineId
   * @param active
   */
  const runWebSearch = async (searchQuery: string, engineId: SearchEngineId, active = true) => {
    const trimmed = searchQuery.trim();
    if (trimmed === "") return;

    const url = buildSearchUrl(engineId, trimmed, customEngines);
    // 先记录搜索历史，再关闭浮层
    try {
      const updatedRecent = await pushRecentSearch(trimmed);
      setRecentSearches(() => updatedRecent);
    } catch {
      /* 搜索历史保存失败不影响用户操作 */
    }

    try {
      await createTab({ url, active });
      void track("search_web", { engine: engineId, query: trimmed });
      close();
    } catch (err) {
      // createTab 失败，回退到 window.open
      try {
        window.open(url, "_blank");
        close();
      } catch {
        /* 彻底失败时静默处理 */
      }
      console.error("[SearchBox] runWebSearch failed:", err);
    }
  };

  /**
   * 打开历史记录条目
   * @param entry
   */
  const openHistoryEntry = async (entry: HistorySearchEntry) => {
    try {
      await createTab({ url: entry.url, active: true });
      close();
    } catch (err) {
      try {
        window.open(entry.url, "_blank", "noopener,noreferrer");
        close();
      } catch {
        /* 彻底失败时静默处理 */
      }
      console.error("[SearchBox] openHistoryEntry failed:", err);
    }
  };

  /**
   * 恢复关闭的标签
   * @param record
   */
  const restoreClosedTab = async (record: ClosedTabRecord) => {
    try {
      await createTab({ url: record.url, active: true, pinned: record.pinned });
      await deleteClosedTab(record.id);
      // 同步本地状态
      setClosedTabRecords((prev) => prev.filter((r) => r.id !== record.id));
      close();
    } catch (err) {
      try {
        window.open(record.url, "_blank");
        close();
      } catch {
        /* 彻底失败静默处理 */
      }
      console.error("[SearchBox] restoreClosedTab failed:", err);
    }
  };

  /**
   * 执行快捷命令
   * @param commandId
   */
  const executeCommand = (commandId: string) => {
    if (commandId === "open-history" && onOpenHistory !== undefined) {
      close();
      onOpenHistory();
    }
  };

  /**
   * 激活搜索结果项
   * @param item
   * @param currentEngine
   */
  const handleActivate = (item: UniversalSearchItem, currentEngine: SearchEngineId) => {
    if (item.type === "tab") {
      jumpToTab(item.tab.id, item.tab.windowId);
      close();
      return;
    }
    if (item.type === "history") {
      void openHistoryEntry(item.entry);
      return;
    }
    if (item.type === "closed") {
      void restoreClosedTab(item.record);
      return;
    }
    if (item.type === "suggestion") {
      void runWebSearch(item.keyword, currentEngine);
      return;
    }
    if (item.type === "web") {
      void runWebSearch(item.query, item.engineId);
      return;
    }
    if (item.type === "permission") {
      // 权限请求需要在组件中处理
      return;
    }
    if (item.type === "command") {
      executeCommand(item.commandId);
      return;
    }
  };

  return {
    runWebSearch,
    openHistoryEntry,
    restoreClosedTab,
    executeCommand,
    handleActivate,
  };
}
