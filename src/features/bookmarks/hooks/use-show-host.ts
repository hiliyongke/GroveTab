/**
 * 显示 hostname 偏好设置 Hook
 *
 * 管理是否在书签卡片中显示 hostname（持久化到 localStorage）
 */

import { useCallback, useState, createContext } from "react";
import { loadString, saveString } from "@/shared/utils/storage-array";

const SHOW_HOST_KEY = "app:bookmark-tree:showHost";

function readShowHost(): boolean {
  return loadString(SHOW_HOST_KEY) === "1";
}

function writeShowHost(v: boolean): void {
  saveString(SHOW_HOST_KEY, v ? "1" : "0");
}

/** 上下文：是否显示 hostname */
export const ShowHostContext = createContext<boolean>(false);

export function useShowHost(): {
  showHost: boolean;
  toggleShowHost: () => void;
} {
  const [showHost, setShowHost] = useState<boolean>(() => readShowHost());

  const toggleShowHost = useCallback(() => {
    setShowHost((prev) => {
      const next = !prev;
      writeShowHost(next);
      return next;
    });
  }, []);

  return { showHost, toggleShowHost };
}
