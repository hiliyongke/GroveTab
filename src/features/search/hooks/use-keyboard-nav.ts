import { useRef, useCallback } from "react";
import type { SearchEngineId } from "@/shared/types";
import type { UniversalSearchItem } from "../types";

type SetActiveIndex = React.Dispatch<React.SetStateAction<number>>;
type SetQuery = React.Dispatch<React.SetStateAction<string>>;
type SetDebouncedQuery = React.Dispatch<React.SetStateAction<string>>;

export interface KeyboardNavOptions {
  activeIndex: number;
  flatItems: UniversalSearchItem[];
  firstWebItemIndex: number;
  normalizedQuery: string;
  currentEngine: SearchEngineId;
  enabledEngines: SearchEngineId[];
  setActiveIndex: SetActiveIndex;
  setQuery: SetQuery;
  setDebouncedQuery: SetDebouncedQuery;
  close: () => void;
  handleActivate: (item: UniversalSearchItem) => void;
  runWebSearch: (query: string, engineId?: SearchEngineId, active?: boolean) => Promise<void>;
}

export function useKeyboardNav(options: KeyboardNavOptions) {
  const {
    activeIndex, flatItems, firstWebItemIndex, normalizedQuery,
    currentEngine, enabledEngines, setActiveIndex, setQuery,
    setDebouncedQuery, close, handleActivate, runWebSearch,
  } = options;

  /**
   * 将高频变化的键盘导航状态缓存到 ref 中，
   * 使 handleKeyDown 的依赖稳定，避免频繁重建导致 Input 重新渲染。
   */
  const navStateRef = useRef({
    activeIndex, flatItems, firstWebItemIndex, normalizedQuery, currentEngine, enabledEngines,
  });

  const updateNavStateRef = useCallback(() => {
    navStateRef.current = {
      activeIndex, flatItems, firstWebItemIndex, normalizedQuery, currentEngine, enabledEngines,
    };
  }, [activeIndex, flatItems, firstWebItemIndex, normalizedQuery, currentEngine, enabledEngines]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      updateNavStateRef();
      const {
        activeIndex: idx, flatItems: items, firstWebItemIndex: webIdx,
        normalizedQuery: nq, currentEngine: engine, enabledEngines: engines,
      } = navStateRef.current;

      // Cmd/Ctrl+K：关闭 Modal
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
        e.preventDefault();
        close();
        return;
      }

      // Cmd/Ctrl+1..9：直接用第 N 个启用引擎进行 web 搜索
      if ((e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key) && nq !== "") {
        const engineIdx = Number.parseInt(e.key, 10) - 1;
        const target = engines[engineIdx];
        if (target !== undefined) {
          e.preventDefault();
          void runWebSearch(nq, target);
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && nq !== "") {
        e.preventDefault();
        void runWebSearch(nq, engine);
        return;
      }

      if (e.altKey && e.key === "Enter" && nq !== "") {
        e.preventDefault();
        void runWebSearch(nq, engine, false);
        return;
      }

      if (e.key === "Tab" && webIdx >= 0) {
        e.preventDefault();
        setActiveIndex(webIdx);
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((index) => items.length === 0 ? 0 : (index + 1) % items.length);
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((index) => items.length === 0 ? 0 : (index - 1 + items.length) % items.length);
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const activeItem = items[idx];
        if (activeItem !== undefined) {
          handleActivate(activeItem);
          return;
        }
        if (nq !== "") void runWebSearch(nq, engine);
      }
    },
    [close, handleActivate, runWebSearch, setActiveIndex, setDebouncedQuery, setQuery, updateNavStateRef],
  );

  return { handleKeyDown };
}
