import { useState, useEffect } from "react";

export interface HashNavigationResult {
  /** 设置面板初始 Tab：'about' 或 'appearance' */
  initialSettingsTab: "appearance" | "about";
  /** 是否因 hash=#settings 触发打开设置面板 */
  openSettingsFromHash: boolean;
}

/**
 * useHashNavigation —— 处理页面初始 URL hash 路由。
 *
 * 支持的 hash：
 *   - `#about`    → 打开设置面板并定位到「关于」Tab
 *   - `#settings` → 打开设置面板（默认 Tab）
 *   - `#search`   → 由 useAppInitialization 处理，此处不涉及
 *
 * 读取完毕后自动清除 hash，避免刷新时重复触发。
 */
export function useHashNavigation(): HashNavigationResult {
  const [initialSettingsTab, setInitialSettingsTab] = useState<"appearance" | "about">(
    "appearance",
  );
  const [openSettingsFromHash, setOpenSettingsFromHash] = useState(false);

  // 读取并解析 hash
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash === "#about") {
      setInitialSettingsTab("about");
    }
    if (hash === "#settings") {
      setOpenSettingsFromHash(true);
    }
  }, []);

  // 清除已处理的 hash，防止刷新重复触发
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      if (hash === "#about" || hash === "#settings") {
        history.replaceState(null, "", window.location.pathname);
      }
    }
  }, [initialSettingsTab, openSettingsFromHash]);

  return { initialSettingsTab, openSettingsFromHash };
}
