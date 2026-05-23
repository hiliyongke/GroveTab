/**
 * 键盘导航 Hook
 *
 * 处理 SearchBox 中的所有键盘导航逻辑：
 * - Escape: 有输入 → 清空；无输入 → 关闭 Modal
 * - Cmd/Ctrl+K: 关闭 Modal（与打开对称）
 * - Enter: 激活当前高亮项
 * - Cmd/Ctrl+Enter: 始终以 web 搜索跳转
 * - Alt+Enter: web 搜索并后台打开
 * - Cmd+1..9: 直接用第 N 个已启用引擎搜索
 * - Tab: 跳到第一个 web 搜索项
 * - ↑/↓: 上下选择
 */

import { useCallback } from "react";
import type { UniversalSearchItem, SearchEngineId } from "../types";
import { useT } from "@/shared/i18n";

interface NavState {
  activeIndex: number;
  flatItems: UniversalSearchItem[];
  firstWebItemIndex: number;
  normalizedQuery: string;
  currentEngine: SearchEngineId;
  enabledEngines: SearchEngineId[];
}

interface UseKeyboardNavigationProps {
  navStateRef: React.RefObject<NavState | null>;
  setActiveIndex: (index: number | ((prev: number) => number)) => void;
  setQuery: (query: string) => void;
  setDebouncedQuery: (query: string) => void;
  close: () => void;
  handleActivate: (item: UniversalSearchItem) => void;
  runWebSearch: (query: string, engineId?: SearchEngineId, active?: boolean) => void;
  updateNavStateRef: () => void;
}

/**
 * 键盘导航 Hook
 *
 * @param props - Hook 配置
 * @param props.navStateRef
 * @param props.setActiveIndex
 * @param props.setQuery
 * @param props.setDebouncedQuery
 * @param props.close
 * @param props.handleActivate
 * @param props.runWebSearch
 * @param props.updateNavStateRef
 * @returns 键盘事件处理函
 */
export function useKeyboardNavigation({
  navStateRef,
  setActiveIndex,
  setQuery,
  setDebouncedQuery,
  close,
  handleActivate,
  runWebSearch: runWebSearchFn,
  updateNavStateRef,
}: UseKeyboardNavigationProps) {
  const { t } = useT();

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // 执行前更新 ref，确保使用最新状态
      updateNavStateRef();

      const {
        activeIndex: idx,
        flatItems: items,
        firstWebItemIndex: webIdx,
        normalizedQuery: nq = "",
        currentEngine: engine = "bing" as SearchEngineId,
        enabledEngines: engines = [],
      } = navStateRef.current ?? {};

      if (items === undefined || idx === undefined) return;

      // Cmd/Ctrl + K：再按一次关闭 Modal（与打开快捷键对称）
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        close();
        return;
      }

      if (e.key === "Escape") {
        if (nq !== "") {
          e.preventDefault();
          e.stopPropagation();
          setQuery("");
          setDebouncedQuery("");
          setActiveIndex(0);
          return;
        }
        // 空输入时 Escape 关闭 Modal
        e.preventDefault();
        close();
        return;
      }

      // Cmd/Ctrl + 1..9：直接用第 N 个启用引擎进行 web 搜索
      if ((e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key) && nq !== "") {
        const engineIdx = Number.parseInt(e.key, 10) - 1;
        const target = engines?.[engineIdx];
        if (target !== undefined) {
          e.preventDefault();
          runWebSearchFn(nq, target);
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && nq !== "" && engine !== undefined) {
        e.preventDefault();
        runWebSearchFn(nq, engine);
        return;
      }

      if (e.altKey && e.key === "Enter" && nq !== "" && engine !== undefined) {
        // Alt+Enter：后台打开（不切换到新 Tab）
        e.preventDefault();
        runWebSearchFn(nq, engine, false);
        return;
      }

      if (e.key === "Tab" && webIdx !== undefined && webIdx >= 0) {
        e.preventDefault();
        setActiveIndex(webIdx);
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((index) => (items.length === 0 ? 0 : (index + 1) % items.length));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((index) =>
          items.length === 0 ? 0 : (index - 1 + items.length) % items.length,
        );
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const activeItem = items[idx];
        if (activeItem !== undefined) {
          handleActivate(activeItem);
          return;
        }
        if (nq !== "" && engine !== undefined) {
          runWebSearchFn(nq, engine);
        }
      }
    },
    [
      navStateRef,
      setActiveIndex,
      setQuery,
      setDebouncedQuery,
      close,
      handleActivate,
      runWebSearchFn,
      updateNavStateRef,
      t,
    ],
  );

  return { handleKeyDown };
}
