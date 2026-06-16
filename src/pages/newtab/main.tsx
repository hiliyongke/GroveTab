import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.less";
import "./styles/app-shell.less";
import { getSettings } from "@/repositories";

void (async () => {
  const settings = await getSettings();
  // overrideNewTab 关闭时：重定向到 Chrome 原生新标签页（仅对新开的 tab 生效）
  if (settings.overrideNewTab === false) {
    try {
      const tab = await chrome.tabs.getCurrent();
      if (tab?.id) {
        await chrome.tabs.update(tab.id, { url: "chrome://new-tab-page/" });
      }
    } catch {
      // 兜底
      location.replace("about:blank");
    }
    return;
  }

  // 开发模式：接入 axe-core 持续无障碍审计，违规项实时打印到控制台。
  // 生产构建中 import.meta.env.DEV 为 false，整块被树摇移除，零体积影响。
  if (import.meta.env.DEV) {
    try {
      const [{ default: React }, ReactDOM, { default: axe }] = await Promise.all([
        import("react"),
        import("react-dom"),
        import("@axe-core/react"),
      ]);
      await axe(React, ReactDOM, 1000);
    } catch {
      // 审计工具加载失败不应阻塞应用渲染
    }
  }

  createRoot(document.getElementById("root")!).render(<App />);
})();
