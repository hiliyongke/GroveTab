import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/index.less";

// 兜底：确保 popup 作用域标记存在（即便 HTML 压缩器把 data-popup 属性丢了，
// 运行时也会补上，让 [data-popup] 作用域的样式必然命中）。
if (typeof document !== "undefined" && !document.body.hasAttribute("data-popup")) {
  document.body.setAttribute("data-popup", "true");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
