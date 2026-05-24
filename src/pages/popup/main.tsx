import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "../newtab/index.module.less";
import "./styles/index.module.less";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
