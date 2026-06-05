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
  createRoot(document.getElementById("root")!).render(<App />);
})();
